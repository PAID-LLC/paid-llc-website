"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette } from "@react-three/postprocessing";
import { makeRimMaterial } from "./universe/Planet";
import { makeMilkyWayTexture, makeRingTexture } from "./universe/planet-textures";

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

// ── Rim mountains ────────────────────────────────────────────────────────────
// A ring of jagged peaks past the playable ground, silhouetted against the
// horizon glow band — the skyline the noise-lump rim never gave these worlds.
// Pure visual set dressing outside the roam radius, so it can never disagree
// with any server-side terrain math. Seamless around the circle because the
// ridge noise samples on a circle in noise space, not on the raw angle.

function ringNoise(a: number, freq: number, seed: number): number {
  return fbm2Circle(Math.cos(a) * freq, Math.sin(a) * freq, seed);
}

// Small local fbm over 2D so this file stays dependency-free of the two
// scene-specific field modules (which belong to their scenes, not to FX).
function vnoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const lat = (gx: number, gz: number) => {
    let h = seed ^ Math.imul(gx, 374761393) ^ Math.imul(gz, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const c00 = lat(ix, iz), c10 = lat(ix + 1, iz), c01 = lat(ix, iz + 1), c11 = lat(ix + 1, iz + 1);
  const x0 = c00 + (c10 - c00) * sm(fx);
  const x1 = c01 + (c11 - c01) * sm(fx);
  return x0 + (x1 - x0) * sm(fz);
}

function fbm2Circle(x: number, z: number, seed: number): number {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) {
    v += amp * vnoise(x * f + 31, z * f + 17, seed + o * 101);
    amp *= 0.5;
    f *= 2;
  }
  return v;
}

export function RimMountains({
  inner,
  outer,
  height = 60,
  base = 6,
  color,
  seed = 1,
}: {
  inner: number;
  outer: number;
  height?: number;
  base?: number;
  color: string;
  seed?: number;
}) {
  const geometry = useMemo(() => {
    const SEG = 220;
    const mid = (inner + outer) / 2;
    const positions: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      // Ridged profile: big peaks carry the skyline, a second octave keeps it jagged.
      const big = Math.pow(1 - Math.abs(2 * ringNoise(a, 2.3, seed) - 1), 1.5);
      const jag = Math.pow(1 - Math.abs(2 * ringNoise(a, 7.1, seed + 55) - 1), 1.2);
      const peak = base + (big * 0.75 + jag * 0.35) * height;
      const cos = Math.cos(a), sin = Math.sin(a);
      positions.push(cos * inner, -4, sin * inner);
      positions.push(cos * mid, peak, sin * mid);
      positions.push(cos * outer, peak * 0.3, sin * outer);
      if (i < SEG) {
        const r = i * 3;
        index.push(r, r + 1, r + 3, r + 1, r + 4, r + 3);
        index.push(r + 1, r + 2, r + 4, r + 2, r + 5, r + 4);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [inner, outer, height, base, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

// ── A sibling world in the sky ───────────────────────────────────────────────
// The universe map's wow moment is a big lit body in frame. From the ground,
// that's a banded gas giant looming past the horizon — lit by the same
// directional light as the terrain, so its terminator agrees with the star.

function makeGasTexture(a: string, b: string, dark: string, seed: number): THREE.CanvasTexture {
  const w = 256, h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const ca = new THREE.Color(a), cb = new THREE.Color(b), cd = new THREE.Color(dark);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warp = vnoise(x * 0.03, y * 0.05, seed) * 3.2;
      const band = fbm2Circle(x * 0.004, y * 0.075 + warp, seed + 9);
      const t = Math.min(1, Math.max(0, band * 1.5 - 0.2));
      const c = new THREE.Color().lerpColors(ca, cb, t);
      // Occasional dark belt.
      const belt = Math.pow(1 - Math.abs(2 * vnoise(3, y * 0.055 + warp * 0.4, seed + 77) - 1), 6);
      c.lerp(cd, belt * 0.7);
      const i = (y * w + x) * 4;
      img.data[i] = c.r * 255;
      img.data[i + 1] = c.g * 255;
      img.data[i + 2] = c.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function SkyWorld({
  position,
  radius,
  palette,
  tint,
  ring = false,
  moon = true,
  seed = 7,
  reduced,
}: {
  position: [number, number, number];
  radius: number;
  palette: { a: string; b: string; dark: string };
  tint: string;
  ring?: boolean;
  moon?: boolean;
  seed?: number;
  reduced: boolean;
}) {
  const texture = useMemo(
    () => makeGasTexture(palette.a, palette.b, palette.dark, seed),
    [palette, seed]
  );
  const ringTexture = useMemo(() => (ring ? makeRingTexture(`skyworld-${seed}`, tint) : null), [ring, tint, seed]);
  const rim = useMemo(() => makeRimMaterial(tint, 0.75), [tint]);
  useEffect(
    () => () => {
      texture.dispose();
      ringTexture?.dispose();
      rim.dispose();
    },
    [texture, ringTexture, rim]
  );
  const spin = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (spin.current && !reduced) spin.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={position} rotation-z={0.35}>
      <mesh ref={spin}>
        <sphereGeometry args={[radius, 40, 28]} />
        {/* Faint self-luminous banding keeps the night side readable as a
            world instead of a hole in the sky — these are living planets. */}
        <meshStandardMaterial
          map={texture}
          roughness={0.95}
          metalness={0}
          fog={false}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.32}
        />
      </mesh>
      <mesh material={rim} scale={radius * 1.12}>
        <sphereGeometry args={[1, 28, 20]} />
      </mesh>
      {ring && ringTexture && (
        <mesh rotation={[-Math.PI / 2 + 0.32, 0, 0]}>
          <ringGeometry args={[radius * 1.45, radius * 2.25, 72]} />
          <meshBasicMaterial map={ringTexture} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} fog={false} />
        </mesh>
      )}
      {moon && (
        <mesh position={[radius * 2.6, radius * 0.7, radius * 0.4]}>
          <sphereGeometry args={[radius * 0.16, 16, 12]} />
          <meshStandardMaterial color="#9aa3b2" roughness={1} fog={false} />
        </mesh>
      )}
    </group>
  );
}

// ── Cloud band ───────────────────────────────────────────────────────────────
// A high, slowly circling belt of soft noise blobs — the sky stops being a
// void between the stars and the ground.

function makeCloudTexture(seed: number): THREE.CanvasTexture {
  const w = 1024, h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry(seed);
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = h * (0.25 + rand() * 0.5);
    const rx = 30 + rand() * 90;
    const ry = 8 + rand() * 18;
    const a = 0.03 + rand() * 0.05;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function CloudBand({
  color,
  opacity = 0.5,
  radius = 300,
  y = 72,
  height = 46,
  reduced,
}: {
  color: string;
  opacity?: number;
  radius?: number;
  y?: number;
  height?: number;
  reduced: boolean;
}) {
  const texA = useMemo(() => makeCloudTexture(0xc10d), []);
  const texB = useMemo(() => makeCloudTexture(0xc10e), []);
  useEffect(
    () => () => {
      texA.dispose();
      texB.dispose();
    },
    [texA, texB]
  );
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (reduced) return;
    if (a.current) a.current.rotation.y += dt * 0.004;
    if (b.current) b.current.rotation.y -= dt * 0.0028;
  });
  const mat = (map: THREE.Texture, o: number) => (
    <meshBasicMaterial map={map} color={color} transparent opacity={o} side={THREE.DoubleSide} depthWrite={false} fog={false} />
  );
  return (
    <>
      <mesh ref={a} position-y={y}>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true]} />
        {mat(texA, opacity)}
      </mesh>
      <mesh ref={b} position-y={y + 18}>
        <cylinderGeometry args={[radius * 1.12, radius * 1.12, height * 1.3, 64, 1, true]} />
        {mat(texB, opacity * 0.6)}
      </mesh>
    </>
  );
}

// ── Ground scatter ───────────────────────────────────────────────────────────
// Instanced debris (matte rocks or emissive crystal shards) seeded around the
// territory. One draw call each; deterministic so the field never reshuffles.
// The scene passes its own terrainHeight so placement follows the real ground.

export function ScatterField({
  kind,
  count,
  area,
  minRadius = 0,
  excludeBands = [],
  color,
  heightFn,
  seed,
  castShadow = false,
}: {
  kind: "rocks" | "crystals";
  count: number;
  area: number;
  minRadius?: number;
  /** radial bands to keep clear (e.g. the genesis plot ring) */
  excludeBands?: { r: number; w: number }[];
  color: string;
  heightFn: (x: number, z: number) => number;
  seed: number;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const placements = useMemo(() => {
    const rand = mulberry(seed);
    const out: { x: number; z: number; s: number; ry: number; sy: number }[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 12) {
      const a = rand() * Math.PI * 2;
      const r = minRadius + Math.sqrt(rand()) * (area - minRadius);
      if (excludeBands.some((b) => Math.abs(r - b.r) < b.w)) continue;
      const s = kind === "rocks" ? 0.3 + rand() * 1.1 : 0.18 + rand() * 0.4;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s,
        ry: rand() * Math.PI * 2,
        sy: kind === "crystals" ? 2.0 + rand() * 1.4 : 0.7 + rand() * 0.6,
      });
    }
    return out;
    // excludeBands is static per scene; identity churn shouldn't rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, count, area, minRadius, seed]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    placements.forEach((p, i) => {
      dummy.position.set(p.x, heightFn(p.x, p.z) + (kind === "crystals" ? p.s * p.sy * 0.4 : 0), p.z);
      dummy.rotation.set(kind === "rocks" ? p.ry * 0.3 : 0, p.ry, 0);
      dummy.scale.set(p.s, p.s * p.sy, p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [placements, heightFn, kind]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placements.length]} castShadow={castShadow}>
      {kind === "rocks" ? <icosahedronGeometry args={[1, 0]} /> : <octahedronGeometry args={[1, 0]} />}
      {kind === "rocks" ? (
        <meshStandardMaterial color={color} flatShading roughness={1} metalness={0} />
      ) : (
        <meshStandardMaterial color={color} flatShading roughness={0.4} emissive={color} emissiveIntensity={0.55} />
      )}
    </instancedMesh>
  );
}

// ── Cinematic descent ────────────────────────────────────────────────────────
// The first four seconds: the camera falls from high orbit onto the default
// framing, then hands over to OrbitControls for good. The universe map opens
// with a drift; the surfaces open with a landing.

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CinematicDescent({
  from,
  target,
  duration = 4,
  reduced,
  onDone,
}: {
  from: [number, number, number];
  target: [number, number, number];
  duration?: number;
  reduced: boolean;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const anim = useRef<{ to: THREE.Vector3; t: number; done: boolean } | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      onDoneRef.current();
      anim.current = { to: camera.position.clone(), t: 1, done: true };
      return;
    }
    anim.current = { to: camera.position.clone(), t: 0, done: false };
    camera.position.set(...from);
    camera.lookAt(...target);
    // Mount-only: `from`/`target` are literals per scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || a.done) return;
    a.t = Math.min(1, a.t + dt / duration);
    const e = easeInOut(a.t);
    camera.position.set(
      from[0] + (a.to.x - from[0]) * e,
      from[1] + (a.to.y - from[1]) * e,
      from[2] + (a.to.z - from[2]) * e
    );
    camera.lookAt(...target);
    if (a.t >= 1) {
      a.done = true;
      onDoneRef.current();
    }
  });

  return null;
}

// ── Small animated helpers ───────────────────────────────────────────────────

/** Gentle scale pulse for beacon orbs and crystal tips. */
export function Pulse({
  speed = 2,
  amp = 0.14,
  phase = 0,
  reduced,
  children,
}: {
  speed?: number;
  amp?: number;
  phase?: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current || reduced) return;
    ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * speed + phase) * amp);
  });
  return <group ref={ref}>{children}</group>;
}

/** Animated pool: a soft fill plus two counter-rotating ripple rings. */
function makeRippleTexture(): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry(0x11a9);
  for (let i = 0; i < 9; i++) {
    const r = 18 + i * 12 + rand() * 6;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, rand() * Math.PI * 2, Math.PI * (0.7 + rand() * 1.1));
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + rand() * 0.2})`;
    ctx.lineWidth = 1.5 + rand() * 2;
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

export function RippleDisc({
  radius,
  color,
  y = 0.14,
  reduced,
}: {
  radius: number;
  color: string;
  y?: number;
  reduced: boolean;
}) {
  const texture = useMemo(() => makeRippleTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (reduced) return;
    if (a.current) a.current.rotation.z += dt * 0.12;
    if (b.current) b.current.rotation.z -= dt * 0.08;
  });
  return (
    <group rotation-x={-Math.PI / 2} position-y={y}>
      <mesh>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={a} position-z={0.02}>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial map={texture} color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={b} position-z={0.04} scale={0.7}>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial map={texture} color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Realistic water ──────────────────────────────────────────────────────────
// A genuine three.js Water surface — real-time mirror reflection of the live
// scene via its own render pass, animated distortion, and a specular sun
// glint — rather than a painted plane. The ripple normal map is generated as
// a sum of periodic sine waves (every term completes a whole number of
// cycles across the tile, so it's seamless by construction, no fetched
// texture): a cheap approximation of real ocean wave superposition, and it
// keeps this file's "everything procedural" rule intact.

function makeWaveNormalTexture(): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(s, s);
  const TWO_PI = Math.PI * 2;
  const WAVES = [
    { kx: 3, ky: 2, amp: 1.0, phase: 0.0 },
    { kx: -5, ky: 4, amp: 0.55, phase: 1.7 },
    { kx: 8, ky: -6, amp: 0.32, phase: 3.1 },
    { kx: -11, ky: -9, amp: 0.18, phase: 0.6 },
    { kx: 15, ky: 3, amp: 0.1, phase: 4.4 },
  ];
  const height = (x: number, y: number): number => {
    const u = (x / s) * TWO_PI;
    const v = (y / s) * TWO_PI;
    let h = 0;
    for (const w of WAVES) h += Math.sin(u * w.kx + v * w.ky + w.phase) * w.amp;
    return h;
  };
  const strength = 1.1;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const hl = height((x - 1 + s) % s, y);
      const hr = height((x + 1) % s, y);
      const hd = height(x, (y - 1 + s) % s);
      const hu = height(x, (y + 1) % s);
      const dx = (hr - hl) * strength;
      const dz = (hu - hd) * strength;
      const len = Math.hypot(dx, dz, 1) || 1;
      const nx = -dx / len, ny = 1 / len, nz = -dz / len;
      const i = (y * s + x) * 4;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function RealisticWater({
  size = 420,
  y = 0,
  color,
  sunColor = "#ffffff",
  sunDirection,
  distortionScale = 2.4,
  reduced,
}: {
  /** Flat-plane footprint, world units. */
  size?: number;
  y?: number;
  color: string;
  sunColor?: string;
  sunDirection: [number, number, number];
  distortionScale?: number;
  reduced: boolean;
}) {
  // Built once (geometry + shader + render target are expensive) and never
  // torn down for weather/light changes — those update the live uniforms
  // instead. Reflection is real: Water sets its own onBeforeRender hook, so
  // the mirror render pass runs automatically every frame once it's in the
  // scene graph, no manual wiring beyond advancing its time uniform.
  const water = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(size, size);
    const normals = makeWaveNormalTexture();
    const w = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x0a3d52,
      distortionScale,
      fog: true,
      alpha: 1.0,
    });
    w.rotation.x = -Math.PI / 2;
    return w;
  }, [size, distortionScale]);

  useEffect(() => {
    water.position.y = y;
  }, [water, y]);

  useEffect(() => {
    (water.material as THREE.ShaderMaterial).uniforms.waterColor.value.set(color);
  }, [water, color]);

  useEffect(() => {
    (water.material as THREE.ShaderMaterial).uniforms.sunColor.value.set(sunColor);
  }, [water, sunColor]);

  useEffect(() => {
    (water.material as THREE.ShaderMaterial).uniforms.sunDirection.value
      .set(sunDirection[0], sunDirection[1], sunDirection[2])
      .normalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [water, sunDirection[0], sunDirection[1], sunDirection[2]]);

  useEffect(
    () => () => {
      water.geometry.dispose();
      const mat = water.material as THREE.ShaderMaterial;
      (mat.uniforms.normalSampler?.value as THREE.Texture | undefined)?.dispose();
      mat.dispose();
    },
    [water]
  );

  useFrame((_, dt) => {
    if (reduced) return;
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.55;
  });

  return <primitive object={water} />;
}

/** Lightning for the static-storm regime: random double-strike sky flashes. */
export function StormFlash({ color, reduced }: { color: string; reduced: boolean }) {
  const light = useRef<THREE.HemisphereLight>(null);
  const s = useRef({ next: 2.5, flash: 0, second: false });
  useFrame((_, dt) => {
    const st = s.current;
    const l = light.current;
    if (!l || reduced) return;
    st.next -= dt;
    if (st.next <= 0) {
      st.flash = 1;
      st.second = Math.random() < 0.45;
      st.next = 4 + Math.random() * 8;
    }
    if (st.flash > 0) {
      st.flash = Math.max(0, st.flash - dt * 6);
      if (st.second && st.flash < 0.45) {
        st.flash = 0.85;
        st.second = false;
      }
    }
    l.intensity = st.flash * 2.4;
  });
  return <hemisphereLight ref={light} args={[color, "#0a0a12", 0]} />;
}

// ── Structure maturity helpers ───────────────────────────────────────────────
// The rows already carry created_at and builder identity, so the renderer can
// show a developing civilization without any engine or schema change: age
// picks a visual tier (fresh build → established → ancient), the builder hash
// varies proportions so no two structures of a kind are identical, and worn
// trails connect everything back to the world's center. When a real `level`
// column lands in the engines (see the structure-depth spec), it simply
// replaces ageTier as the tier source — the visuals are already tiered.

/** Deterministic per-structure seed from identity strings. */
export function detailSeed(s: string): number {
  return hashHex(s);
}

/** 0 = fresh, 1 = established, 2 = ancient — thresholds in hours. */
export function ageTier(createdAt: string, t1Hours: number, t2Hours: number): 0 | 1 | 2 {
  const ageH = (Date.now() - new Date(createdAt).getTime()) / 3.6e6;
  if (!Number.isFinite(ageH)) return 0;
  return ageH >= t2Hours ? 2 : ageH >= t1Hours ? 1 : 0;
}

/** Slow continuous rotation for halos, orbiting shards, gears. */
export function Spin({
  speed = 0.3,
  axis = "y",
  reduced,
  children,
}: {
  speed?: number;
  axis?: "x" | "y" | "z";
  reduced: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation[axis] += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

/** A worn trail between two ground points, following the terrain with a
 *  gentle wander — settlements have paths; scattered objects don't. */
export function TrailLine({
  a,
  b,
  color,
  heightFn,
  opacity = 0.3,
  wobble = 2.4,
  seed = 1,
}: {
  a: [number, number];
  b: [number, number];
  color: string;
  heightFn: (x: number, z: number) => number;
  opacity?: number;
  wobble?: number;
  seed?: number;
}) {
  const points = useMemo(() => {
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n = Math.max(8, Math.round(dist / 3));
    const px = -(b[1] - a[1]) / dist;
    const pz = (b[0] - a[0]) / dist;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = (vnoise(t * 6 + seed * 3.1, seed * 1.7, 0x77a1) - 0.5) * wobble * 2 * Math.sin(t * Math.PI);
      const x = a[0] + (b[0] - a[0]) * t + px * off;
      const z = a[1] + (b[1] - a[1]) * t + pz * off;
      pts.push([x, heightFn(x, z) + 0.18, z]);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a[0], a[1], b[0], b[1], heightFn, wobble, seed]);
  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={1.5}
      dashed
      dashSize={1.1}
      gapSize={0.9}
    />
  );
}

/** Floating inscription plaque for structures that carry words. */
export function GlyphPlaque({
  position,
  color,
  reduced,
}: {
  position: [number, number, number];
  color: string;
  reduced: boolean;
}) {
  return (
    <Pulse speed={1.1} amp={0.05} reduced={reduced}>
      <group position={position} rotation-y={0.4}>
        <mesh>
          <boxGeometry args={[1.0, 0.65, 0.08]} />
          <meshStandardMaterial color="#0c0a10" roughness={0.6} emissive={color} emissiveIntensity={0.45} />
        </mesh>
      </group>
    </Pulse>
  );
}

// ── Filmic post stack ────────────────────────────────────────────────────────
// Bloom for the emissives (threshold sits above lit terrain, including its
// vertex-color accent flecks, so the ground stays matte), then a vignette and
// a whisper of grain — the same finish language as the universe's screen-space
// scanlines, applied in-scene. Same library the v1 lounge has shipped on.

export function SceneFX({ bloom = 0.7 }: { bloom?: number }) {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.42} luminanceSmoothing={0.75} intensity={bloom} radius={0.7} />
      <Vignette eskil={false} offset={0.26} darkness={0.58} />
      <Noise premultiply opacity={0.05} />
    </EffectComposer>
  );
}
