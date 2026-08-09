"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
} from "@react-three/postprocessing";

// ── World craft kit ──────────────────────────────────────────────────────────
//
// The second shared layer under the world scenes. ground-fx.tsx supplies the
// *atmosphere* (sky domes, mist, weather, starfields); this file supplies the
// *finish and the mass*: a per-world colour grade, volumetric light, instanced
// structure, and procedural molten/holographic surfaces.
//
// Three rules it exists to enforce:
//
//   1. EVERY WORLD LOOKS DIFFERENT ON PURPOSE, NOT BY ACCIDENT. Before this,
//      every scene called `SceneFX` with one number (bloom) and got the exact
//      same grade. Four of eight worlds ended up reading as "dark ground with
//      glowing bits". A grade lives here per world, so the difference is a
//      reviewable table rather than an emergent one.
//   2. NOTHING IS FETCHED. No GLTF, no image textures, no new dependency —
//      geometry is primitives and revolutions, surfaces are GLSL. World canvases
//      are `ssr:false` client chunks so they never touch the Cloudflare worker
//      bundle, but they are still downloaded by real people on real phones.
//   3. EVERY ANIMATION STANDS DOWN UNDER prefers-reduced-motion, including the
//      post stack. Film grain and a scrolling melt are motion.
//
// Deliberately NOT here: screen-space ambient occlusion. It reads well on the
// terraced and stacked geometry these worlds now have, but it needs a second
// full-scene normal/depth pass, and the frame budget is spent on the scenes
// themselves. Contact darkening is baked into vertex colours instead — same
// result on this geometry, zero passes. `ao` is wired through the preset so
// turning it on later is a one-line change, not a refactor.

// ── Per-world colour grade ───────────────────────────────────────────────────

export interface Grade {
  /** Bloom intensity, and the luminance above which things bloom at all. A low
   *  threshold on a bright world blooms the ground and turns it to soup. */
  bloom: number;
  threshold: number;
  /** Hue rotation in radians, saturation -1..1. */
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  /** Lens aberration in UV units. Above ~0.002 it stops reading as a lens and
   *  starts reading as a bug. */
  aberration: number;
  vignette: number;
  /** Film grain opacity. Animated, so it is dropped under reduced motion. */
  grain: number;
  /** Reserved: screen-space AO. See the note at the top of this file. */
  ao?: boolean;
}

const BASE: Grade = {
  bloom: 0.7,
  threshold: 0.42,
  hue: 0,
  saturation: 0.08,
  brightness: 0,
  contrast: 0.08,
  aberration: 0.0008,
  vignette: 0.56,
  grain: 0.05,
};

/**
 * One entry per world. Read this table top to bottom to see the portfolio's
 * range: three worlds are deliberately bright or hot, the rest are night, and
 * no two share a hue.
 */
export const GRADE: Record<string, Grade> = {
  // Night megacity. The most saturated grade in the portfolio: neon is the
  // whole point, and the harbour water needs the aberration to sell the lens.
  arclight: {
    ...BASE,
    bloom: 0.95,
    threshold: 0.34,
    saturation: 0.2,
    contrast: 0.14,
    aberration: 0.0014,
    vignette: 0.62,
  },
  // Storm foundry. Cyan sky over an orange pit, so the grade has to hold two
  // opposed hues without muddying either — high contrast, restrained saturation.
  lathe: {
    ...BASE,
    bloom: 0.88,
    threshold: 0.38,
    saturation: 0.14,
    contrast: 0.18,
    aberration: 0.0016,
    vignette: 0.66,
    grain: 0.06,
  },
  // Amber cloud port, no ground. Bright and hazy: a dark vignette would put a
  // floor back into a world whose entire idea is that there isn't one.
  waypoint: {
    ...BASE,
    bloom: 0.72,
    threshold: 0.44,
    hue: 0.04,
    saturation: 0.12,
    brightness: 0.03,
    contrast: 0.1,
    vignette: 0.42,
  },
  // Desert colosseum under a red giant. Harsh daylight: bloom threshold sits
  // high so lit sand does not glow, and the grade pulls saturation DOWN — the
  // sun bleaches, it does not enrich.
  crucible: {
    ...BASE,
    bloom: 0.5,
    threshold: 0.58,
    hue: -0.02,
    saturation: -0.04,
    brightness: 0.02,
    contrast: 0.22,
    aberration: 0.0006,
    vignette: 0.46,
  },
  // Ruins under a ringed giant. The one world graded warm-violet.
  palimpsest: {
    ...BASE,
    bloom: 0.78,
    hue: 0.06,
    saturation: 0.1,
    contrast: 0.12,
    aberration: 0.001,
    vignette: 0.6,
  },
  // Daylight civic world. The lightest grade there is; heavy post here would
  // undo the exact thing that makes it the portfolio's counterweight.
  meridian: {
    ...BASE,
    bloom: 0.45,
    threshold: 0.6,
    saturation: 0.06,
    brightness: 0.02,
    contrast: 0.06,
    aberration: 0.0004,
    vignette: 0.36,
    grain: 0.03,
  },
  // Ocean world. Cool and deep; the water already carries the highlights.
  substrate: { ...BASE, bloom: 0.62, threshold: 0.46, hue: -0.05, saturation: 0.12, vignette: 0.54 },
  // Terraform surface, staged by its own progression.
  genesis: { ...BASE, bloom: 0.66, saturation: 0.1 },
};

export function gradeFor(world: string): Grade {
  return GRADE[world] ?? BASE;
}

/**
 * The graded post stack. Replaces `SceneFX` at the world level.
 *
 * Everything after Bloom merges into a single fullscreen pass inside
 * `postprocessing`, so the added grading costs one extra convolution's worth of
 * nothing — the aberration, hue, contrast, vignette and grain all ride along in
 * the pass that was already running.
 */
export function WorldFX({
  world,
  bloom,
  reduced,
  grade,
}: {
  /** Key into GRADE. Unknown keys fall back to a neutral grade. */
  world: string;
  /** Live override for scenes whose bloom already tracks a real signal (the
   *  Lathe's forge heat, Arclight's traffic). Scales the world's own value. */
  bloom?: number;
  reduced: boolean;
  /** Escape hatch for a scene that needs to push one value further. */
  grade?: Partial<Grade>;
}) {
  const g = useMemo(() => ({ ...gradeFor(world), ...grade }), [world, grade]);
  const offset = useMemo(
    () => new THREE.Vector2(g.aberration, g.aberration * 0.6),
    [g.aberration]
  );
  return (
    <EffectComposer>
      <Bloom
        mipmapBlur
        luminanceThreshold={g.threshold}
        luminanceSmoothing={0.75}
        intensity={bloom ?? g.bloom}
        radius={0.72}
      />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.42} />
      <HueSaturation hue={g.hue} saturation={g.saturation} />
      <BrightnessContrast brightness={g.brightness} contrast={g.contrast} />
      <Vignette eskil={false} offset={0.26} darkness={g.vignette} />
      <Noise premultiply opacity={reduced ? 0 : g.grain} />
    </EffectComposer>
  );
}

// ── Volumetric light shaft ───────────────────────────────────────────────────
// An additive cone with a soft edge and a vertical fade. Not real volumetrics
// (no raymarch, no depth read) but it lands the same read for a fraction of the
// cost: a searchlight, a landing beam, a furnace glow leaking up out of a pit.

const SHAFT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormalW = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Edge-on fragments are the ones looking down the length of the cone wall, so
// they accumulate the most "air" — inverting the fresnel gives a shaft that is
// brightest at its silhouette, which is what a real light column does.
const SHAFT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFlicker;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
    float body = pow(clamp(rim, 0.0, 1.0), 1.6);
    float fade = pow(clamp(vUv.y, 0.0, 1.0), 1.35);
    float flick = 1.0 + uFlicker * sin(uTime * 7.0 + vUv.y * 9.0) * 0.5;
    gl_FragColor = vec4(uColor, body * fade * uOpacity * flick);
  }
`;

export function LightShaft({
  position,
  radius,
  height,
  color,
  opacity = 0.28,
  flicker = 0,
  reduced,
}: {
  position: [number, number, number];
  /** Radius at the wide (upper) end. The cone tapers to a point below. */
  radius: number;
  height: number;
  color: string;
  opacity?: number;
  /** 0..1. Furnaces flicker; landing beams do not. */
  flicker?: number;
  reduced: boolean;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uTime: { value: 0 },
          uFlicker: { value: reduced ? 0 : flicker },
        },
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    [color, opacity, flicker, reduced]
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (!reduced) material.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={position} material={material}>
      <coneGeometry args={[radius, height, 18, 1, true]} />
    </mesh>
  );
}

// ── Molten surface ───────────────────────────────────────────────────────────
// Scrolling multi-octave value noise: a cooling crust with hot fissures showing
// through it. Used for the Lathe's pit; deliberately generic so the Crucible's
// forge pits and any future volcanic ground can share it.

const MELT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MELT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  uniform float uScale;
  uniform vec3 uHot;
  uniform vec3 uCrust;
  varying vec2 vUv;

  float h21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
               mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int k = 0; k < 4; k++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uScale;
    // Two drift directions at different rates so the crust shears rather than
    // sliding as one sheet — sliding reads as a moving texture, shearing reads
    // as something molten.
    float a = fbm(p + vec2(uTime * 0.035, uTime * 0.018));
    float b = fbm(p * 2.6 - vec2(uTime * 0.012, uTime * 0.027));
    float n = a + b * 0.3;
    float crust = smoothstep(0.36, 0.74, n);
    vec3 col = mix(uHot, uCrust, crust);
    float veins = pow(1.0 - crust, 2.0);
    col += uHot * veins * (0.5 + 0.5 * uHeat);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function MoltenSurface({
  radius,
  y = 0,
  hot = "#ff8b21",
  crust = "#1b1216",
  heat = 0.6,
  scale = 7,
  reduced,
}: {
  radius: number;
  y?: number;
  hot?: string;
  crust?: string;
  /** 0..1 — drives how far the hot veins push through the crust. */
  heat?: number;
  /** Noise frequency across the disc. Higher = finer crust. */
  scale?: number;
  reduced: boolean;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHeat: { value: heat },
          uScale: { value: scale },
          uHot: { value: new THREE.Color(hot) },
          uCrust: { value: new THREE.Color(crust) },
        },
        vertexShader: MELT_VERT,
        fragmentShader: MELT_FRAG,
      }),
    [hot, crust, heat, scale]
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (!reduced) material.uniforms.uTime.value += dt;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} material={material}>
      <circleGeometry args={[radius, 64]} />
    </mesh>
  );
}

// ── Instanced structure ──────────────────────────────────────────────────────
// One draw call for an arbitrary pile of boxes. Every world's repeated
// furniture (gantries, crates, hab blocks, dock arms, seating) goes through
// this rather than mapping over <mesh>, which is how a scene quietly acquires
// four hundred draw calls.

export interface Block {
  p: [number, number, number];
  s: [number, number, number];
  /** Y rotation in radians. */
  ry?: number;
  /** Per-instance tint, multiplied into the material colour. */
  c?: string;
}

export function InstancedBlocks({
  blocks,
  color,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.7,
  metalness = 0.3,
}: {
  blocks: Block[];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tinted = useMemo(() => blocks.some((b) => b.c), [blocks]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    blocks.forEach((b, i) => {
      pos.set(b.p[0], b.p[1], b.p[2]);
      scl.set(b.s[0], b.s[1], b.s[2]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry ?? 0);
      mesh.setMatrixAt(i, m.compose(pos, q, scl));
      if (tinted) mesh.setColorAt(i, col.set(b.c ?? color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blocks, color, tinted]);

  if (blocks.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} castShadow={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
      />
    </instancedMesh>
  );
}

// ── Traffic ──────────────────────────────────────────────────────────────────
// Craft moving along a spline, all of them in one draw call, each oriented into
// its own direction of travel. This is the difference between a port that is a
// model of a port and a port that is running.
//
// The count is meant to be driven by a real signal — Waypoint's cross-world
// event volume, Arclight's settled jobs — so an idle platform genuinely looks
// idle. Under reduced motion the craft park where they are rather than
// disappearing: a still photograph of traffic is still traffic.

export function TrafficStream({
  curve,
  count,
  size = 1.6,
  color,
  glow,
  speed = 0.05,
  reduced,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  count: number;
  /** Length of a craft; width and height are derived from it. */
  size?: number;
  color: string;
  glow?: string;
  /** Fraction of the curve travelled per second. */
  speed?: number;
  reduced: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
      pos: new THREE.Vector3(),
      tan: new THREE.Vector3(),
      scl: new THREE.Vector3(1, 1, 1),
    }),
    []
  );

  // Uneven spacing, so a lane reads as traffic rather than as a conveyor belt.
  const offsets = useMemo(
    () => Array.from({ length: count }, (_, i) => (i / count + ((i * 0.37) % 1) * 0.04) % 1),
    [count]
  );

  const write = useMemo(
    () => (time: number) => {
      const mesh = ref.current;
      if (!mesh) return;
      const s = scratch;
      for (let i = 0; i < offsets.length; i++) {
        const t = (offsets[i] + time * speed) % 1;
        curve.getPointAt(t, s.pos);
        curve.getTangentAt(t, s.tan);
        s.q.setFromUnitVectors(s.up, s.tan.normalize());
        s.scl.set(size * 0.28, size, size * 0.28);
        mesh.setMatrixAt(i, s.m.compose(s.pos, s.q, s.scl));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    [curve, offsets, size, speed, scratch]
  );

  useEffect(() => {
    write(0);
  }, [write]);

  useFrame((_, dt) => {
    if (reduced) return;
    clock.current += dt;
    write(clock.current);
  });

  if (count <= 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      {/* Capsule, long axis on Y — the quaternion above rotates Y into the
          curve's tangent, so a craft always points where it is going. */}
      <capsuleGeometry args={[0.5, 1.4, 3, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={glow ?? color}
        emissiveIntensity={1.1}
        roughness={0.3}
        metalness={0.4}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/**
 * A revolved profile as one mesh. `profile` is a list of [radius, height]
 * points read outward; the result is a single draw call for terrain that would
 * otherwise cost one mesh per step.
 *
 * Vertex colours bake contact darkening: `shade` receives each profile point's
 * height and returns a 0..1 brightness, so a canyon gets dark at the bottom
 * without an occlusion pass.
 */
export function RevolvedTerrain({
  profile,
  segments = 128,
  color,
  shade,
  roughness = 0.92,
  metalness = 0.08,
}: {
  profile: [number, number][];
  segments?: number;
  color: string;
  shade?: (y: number, r: number) => number;
  roughness?: number;
  metalness?: number;
}) {
  const geometry = useMemo(() => {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y));
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.computeVertexNormals();
    if (shade) {
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const base = new THREE.Color(color);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const k = Math.max(0, shade(y, Math.hypot(x, z)));
        c.copy(base).multiplyScalar(k);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    return geo;
  }, [profile, segments, color, shade]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={shade ? "#ffffff" : color}
        vertexColors={!!shade}
        roughness={roughness}
        metalness={metalness}
        side={THREE.DoubleSide}
        flatShading
      />
    </mesh>
  );
}
