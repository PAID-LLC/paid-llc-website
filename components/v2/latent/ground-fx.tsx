"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { makeRimMaterial } from "./universe/Planet";
import { makeMilkyWayTexture } from "./universe/planet-textures";

// ── Ground-level scene FX ─────────────────────────────────────────────────────
// Shared atmosphere kit for the two on-the-ground worlds — Synthetica Prime's
// surface (surface/SurfaceCanvas.tsx) and Substrate (sim/SimCanvas.tsx) — so
// standing on a planet carries the same production values as orbiting one in
// UniverseCanvas: the same milky way, the same fresnel corona star, plus the
// things only a surface has (sky gradient, mist, weather particles, aurora).
// Everything is procedural — no fetched assets, zero LLM cost at view time —
// and every animation stands down under prefers-reduced-motion.

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((pa >> 16) & 255, (pb >> 16) & 255);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

// ── Sky dome ─────────────────────────────────────────────────────────────────
// A per-fragment vertical gradient on a BackSide sphere: near-black zenith,
// scene-colored horizon, and an accent glow band sitting right on the horizon
// line — the cheap version of atmospheric scattering. Opaque but depth-silent,
// so the starfield and milky way (smaller radii) still draw in front of it.

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform float uGlowStrength;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.02, 0.46, h));
    float band = pow(1.0 - clamp(abs(h - 0.02) * 3.2, 0.0, 1.0), 2.4);
    col += uGlow * band * uGlowStrength;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function GroundSky({
  zenith = "#050508",
  horizon,
  glow,
  glowStrength = 0.3,
  radius = 400,
}: {
  zenith?: string;
  horizon: string;
  glow: string;
  glowStrength?: number;
  radius?: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uZenith: { value: new THREE.Color(zenith) },
          uHorizon: { value: new THREE.Color(horizon) },
          uGlow: { value: new THREE.Color(glow) },
          uGlowStrength: { value: glowStrength },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [zenith, horizon, glow, glowStrength]
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} scale={radius}>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  );
}

// The universe's galactic backdrop, seen from the ground. Additive, so pure
// black stays invisible; fog off, because a galaxy is not in the weather.
export function MilkyWayBackdrop({ radius = 370 }: { radius?: number }) {
  const texture = useMemo(() => makeMilkyWayTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[0.45, 0, 0.55]}>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

// ── The star overhead ────────────────────────────────────────────────────────
// The Nexus, seen from a planet that orbits it — same fresnel corona shells as
// Sun.tsx, scaled down to a disc in the sky. Place it in the direction of the
// scene's directional light so the shading agrees with the star.

export function NexusStar({
  position,
  color = "#fff3dd",
  halo = "#ffd9a0",
  tint = "#f472b6",
  radius = 11,
  reduced,
}: {
  position: [number, number, number];
  color?: string;
  halo?: string;
  tint?: string;
  radius?: number;
  reduced: boolean;
}) {
  const coronaA = useRef<THREE.Mesh>(null);
  const coronaB = useRef<THREE.Mesh>(null);
  const matA = useMemo(() => makeRimMaterial(halo, 0.8), [halo]);
  const matB = useMemo(() => makeRimMaterial(tint, 0.3), [tint]);
  useEffect(
    () => () => {
      matA.dispose();
      matB.dispose();
    },
    [matA, matB]
  );

  useFrame((state) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    if (coronaA.current) coronaA.current.scale.setScalar(radius * 1.5 * (1 + Math.sin(t * 0.6) * 0.02));
    if (coronaB.current) coronaB.current.scale.setScalar(radius * 2.2 * (1 + Math.sin(t * 0.45 + 1.7) * 0.03));
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={coronaA} material={matA} scale={radius * 1.5}>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      <mesh ref={coronaB} material={matB} scale={radius * 2.2}>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
    </group>
  );
}

// ── Particles ────────────────────────────────────────────────────────────────
// One Points cloud, four behaviors: ambient motes, falling data-rain, jittering
// storm sparks, rising embers. Deterministically seeded so the field doesn't
// reshuffle when live polls re-render the scene. Under reduced motion the
// animated weathers stand down to a static mote field.

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSpriteTexture(): THREE.CanvasTexture {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

export type ParticleMode = "motes" | "rain" | "sparks" | "embers";

const PARTICLE_DEFS: Record<ParticleMode, { count: number; size: number; opacity: number; yMin: number; yMax: number }> = {
  motes: { count: 240, size: 1.1, opacity: 0.4, yMin: 1.5, yMax: 26 },
  rain: { count: 560, size: 0.85, opacity: 0.55, yMin: 2, yMax: 68 },
  sparks: { count: 150, size: 1.2, opacity: 0.7, yMin: 1, yMax: 24 },
  embers: { count: 200, size: 1.3, opacity: 0.6, yMin: 0.5, yMax: 28 },
};

export function ParticleField({
  mode,
  color,
  area = 120,
  reduced,
}: {
  mode: ParticleMode;
  color: string;
  area?: number;
  reduced: boolean;
}) {
  // Animated weathers read wrong frozen mid-fall; motes read fine standing still.
  const effective: ParticleMode = reduced && mode !== "motes" ? "motes" : mode;
  const def = PARTICLE_DEFS[effective];

  const { positions, base, phase } = useMemo(() => {
    const rand = mulberry(0x5eed + effective.length * 97);
    const positions = new Float32Array(def.count * 3);
    const base = new Float32Array(def.count * 3);
    const phase = new Float32Array(def.count);
    for (let i = 0; i < def.count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * area;
      const x = Math.cos(a) * r;
      const y = def.yMin + rand() * (def.yMax - def.yMin);
      const z = Math.sin(a) * r;
      positions.set([x, y, z], i * 3);
      base.set([x, y, z], i * 3);
      phase[i] = rand() * Math.PI * 2;
    }
    return { positions, base, phase };
  }, [effective, def, area]);

  const sprite = useMemo(() => makeSpriteTexture(), []);
  useEffect(() => () => sprite.dispose(), [sprite]);

  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  useFrame((state, dt) => {
    const p = points.current;
    if (!p || reduced) return;
    const t = state.clock.elapsedTime;
    const attr = p.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    if (effective === "motes") {
      // Whole-cloud drift is enough at mote density; no per-point writes.
      p.rotation.y += dt * 0.012;
      p.position.y = Math.sin(t * 0.18) * 0.6;
      return;
    }
    if (effective === "rain") {
      for (let i = 0; i < def.count; i++) {
        let y = arr[i * 3 + 1] - dt * (26 + (phase[i] % 1) * 14);
        if (y < def.yMin) y += def.yMax - def.yMin;
        arr[i * 3 + 1] = y;
      }
    } else if (effective === "sparks") {
      for (let i = 0; i < def.count; i++) {
        arr[i * 3] = base[i * 3] + Math.sin(t * 7 + phase[i]) * 0.7;
        arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 9 + phase[i] * 1.3) * 0.9;
        arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 8 + phase[i]) * 0.7;
      }
      if (material.current) material.current.opacity = def.opacity * (0.65 + 0.35 * Math.sin(t * 13));
    } else {
      // embers
      for (let i = 0; i < def.count; i++) {
        let y = arr[i * 3 + 1] + dt * (1.6 + (phase[i] % 1));
        if (y > def.yMax) y = def.yMin;
        arr[i * 3 + 1] = y;
        arr[i * 3] = base[i * 3] + Math.sin(t * 0.8 + phase[i]) * 1.6;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} key={effective}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        map={sprite}
        color={color}
        size={def.size}
        sizeAttenuation
        transparent
        opacity={def.opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Ground mist ──────────────────────────────────────────────────────────────
// A handful of large soft-alpha planes drifting just above the ground — the
// classic cheap volumetric. depthWrite off so intersections with terrain read
// as haze, not clipping.

function makeMistTexture(): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

export function GroundMist({
  color,
  opacity = 0.09,
  area = 110,
  reduced,
}: {
  color: string;
  opacity?: number;
  area?: number;
  reduced: boolean;
}) {
  const texture = useMemo(() => makeMistTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const group = useRef<THREE.Group>(null);

  const sheets = useMemo(() => {
    const rand = mulberry(0x0f06);
    return Array.from({ length: 5 }, (_, i) => ({
      x: (rand() - 0.5) * area,
      z: (rand() - 0.5) * area,
      y: 2.5 + i * 1.4,
      scale: 46 + rand() * 42,
      phase: rand() * Math.PI * 2,
      speed: 0.05 + rand() * 0.05,
    }));
  }, [area]);

  useFrame((state) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = state.clock.elapsedTime;
    g.children.forEach((child, i) => {
      const s = sheets[i];
      child.position.x = s.x + Math.sin(t * s.speed + s.phase) * 9;
      child.position.z = s.z + Math.cos(t * s.speed * 0.8 + s.phase) * 7;
    });
  });

  return (
    <group ref={group}>
      {sheets.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation-x={-Math.PI / 2} scale={s.scale}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            color={color}
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Aurora curtains ──────────────────────────────────────────────────────────
// Two arcs of an open cylinder wall on the horizon sky, wearing a streaked
// additive texture — the ground-level payoff of the aurora terraform ballots.
// Fog off: an aurora lives above the weather.

function makeAuroraTexture(hex: string): THREE.CanvasTexture {
  const w = 512, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry(hashHex(hex));
  const c = new THREE.Color(hex);
  const [r, g, b] = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
  for (let i = 0; i < 56; i++) {
    const x = rand() * w;
    const width = 6 + rand() * 28;
    const a = 0.05 + rand() * 0.11;
    const grad = ctx.createLinearGradient(x - width, 0, x + width, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - width, 0, width * 2, h);
  }
  // Bright cores on a few streaks.
  for (let i = 0; i < 14; i++) {
    const x = rand() * w;
    const width = 2 + rand() * 6;
    const grad = ctx.createLinearGradient(x - width, 0, x + width, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, `rgba(255,255,255,${0.04 + rand() * 0.06})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - width, 0, width * 2, h);
  }
  // Vertical fade: strong near the lower third, gone at both edges.
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createLinearGradient(0, 0, 0, h);
  mask.addColorStop(0, "rgba(0,0,0,0)");
  mask.addColorStop(0.3, "rgba(0,0,0,1)");
  mask.addColorStop(0.75, "rgba(0,0,0,0.45)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(canvas);
}

function hashHex(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function AuroraCurtain({
  color,
  intensity = 0.5,
  reduced,
}: {
  color: string;
  intensity?: number;
  reduced: boolean;
}) {
  const texture = useMemo(() => makeAuroraTexture(color), [color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  const matA = useRef<THREE.MeshBasicMaterial>(null);
  const matB = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, dt) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    if (a.current) a.current.rotation.y += dt * 0.012;
    if (b.current) b.current.rotation.y -= dt * 0.008;
    if (matA.current) matA.current.opacity = intensity * (0.75 + 0.25 * Math.sin(t * 0.3));
    if (matB.current) matB.current.opacity = intensity * 0.7 * (0.75 + 0.25 * Math.sin(t * 0.22 + 2.1));
  });

  const curtain = (
    ref: React.RefObject<THREE.Group | null>,
    mat: React.RefObject<THREE.MeshBasicMaterial | null>,
    radius: number,
    height: number,
    y: number,
    theta: number,
    opacity: number
  ) => (
    <group ref={ref} rotation-y={theta}>
      <mesh position-y={y}>
        <cylinderGeometry args={[radius, radius, height, 48, 1, true, 0, 2.3]} />
        <meshBasicMaterial
          ref={mat}
          map={texture}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );

  return (
    <>
      {curtain(a, matA, 190, 62, 58, 0.6, intensity)}
      {curtain(b, matB, 230, 78, 72, 3.4, intensity * 0.7)}
    </>
  );
}

// ── Bloom ────────────────────────────────────────────────────────────────────
// The single biggest step toward the universe's finish: beacons, emissive
// rings, and the star overhead pick up a real glow. Threshold sits above the
// lit terrain's brightness — including the vertex-color accent flecks — so
// the ground stays matte instead of blotching. Same library the v1 lounge has
// shipped on since launch.

export function SceneBloom({ intensity = 0.7 }: { intensity?: number }) {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.42} luminanceSmoothing={0.75} intensity={intensity} radius={0.7} />
    </EffectComposer>
  );
}
