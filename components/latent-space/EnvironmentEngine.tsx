"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ── Shared: Reflective Floor ──────────────────────────────────────────────────

function Floor({
  color,
  roughness = 0.55,
  mixStrength = 8,
}: {
  color: string;
  roughness?: number;
  mixStrength?: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={mixStrength}
        roughness={roughness}
        depthScale={1.0}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={color}
        metalness={0.85}
      />
    </mesh>
  );
}

// ── Shared: Background architectural ring ────────────────────────────────────

function BackgroundRing({
  radius,
  tubeRadius = 0.08,
  color,
  speed,
  height,
  tiltX = 0,
}: {
  radius: number;
  tubeRadius?: number;
  color: string;
  speed: number;
  height: number;
  tiltX?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * speed; });
  return (
    <mesh ref={ref} position={[0, height, 0]} rotation={[tiltX, 0, 0]}>
      <torusGeometry args={[radius, tubeRadius, 8, 80]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.65}
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

// ── Shared: Ambient floating motes ───────────────────────────────────────────

function AmbientMotes({ color, opacity }: { color: string; opacity: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const COUNT = 80;
    const positions = new Float32Array(COUNT * 3);
    const speeds    = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * 18;
      positions[i * 3]     = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.random() * 10;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 0.05 + Math.random() * 0.10;
    }
    return { positions, speeds };
  }, []);

  useFrame((_, d) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 80; i++) {
      const y = p.getY(i) + d * speeds[i];
      if (y > 10) {
        const angle = Math.random() * Math.PI * 2;
        const r     = Math.random() * 18;
        p.setX(i, Math.cos(angle) * r);
        p.setY(i, 0);
        p.setZ(i, Math.sin(angle) * r);
      } else {
        p.setX(i, p.getX(i) + (Math.random() - 0.5) * 0.008);
        p.setY(i, y);
        p.setZ(i, p.getZ(i) + (Math.random() - 0.5) * 0.008);
      }
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color={color} transparent opacity={opacity} sizeAttenuation />
    </points>
  );
}

// ── Roast Pit — one slow vortex in the dark ───────────────────────────────────

function RoastVortex() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      const t = i / 200, ang = t * Math.PI * 2 * 10, r = t * 16;
      a[i * 3]     = Math.cos(ang) * r;
      a[i * 3 + 1] = t * 8 - 1;
      a[i * 3 + 2] = Math.sin(ang) * r;
    }
    return a;
  }, []);

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.08; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.18} color="#BB0044" transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

function RoastPit() {
  return (
    <>
      <color attach="background" args={["#090004"]} />
      <fogExp2 attach="fog" args={["#090004", 0.032]} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 10, 0]} intensity={1.2} color="#AA0033" />
      <pointLight position={[0, 0.4, 0]} intensity={0.6} color="#880022" distance={12} />
      <Floor color="#0D0006" roughness={0.08} mixStrength={18} />
      <RoastVortex />
      <BackgroundRing radius={9}  color="#880022" speed={0.008} height={3} />
      <BackgroundRing radius={13} color="#880022" speed={0.005} height={6} />
      <AmbientMotes color="#FF2255" opacity={0.25} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.22} luminanceSmoothing={0.85} intensity={0.65} />
      </EffectComposer>
    </>
  );
}

// ── Intellectual Hub — armillary orrery, cold and contemplative ───────────────

type OrreryRing = { tiltX: number; tiltZ: number; speed: number; radius: number; color: string };

const ORRERY_RINGS: OrreryRing[] = [
  { tiltX: Math.PI / 2,   tiltZ: 0,            speed:  0.016, radius: 4.2, color: "#4488CC" },
  { tiltX: 0.28,          tiltZ: Math.PI / 4,  speed:  0.010, radius: 6.8, color: "#6655BB" },
  { tiltX: Math.PI / 5.5, tiltZ: Math.PI / 3,  speed:  0.022, radius: 5.5, color: "#3366AA" },
];

function OrreryRingMesh({ tiltX, tiltZ, speed, radius, color }: OrreryRing) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * speed; });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, tiltZ]}>
      <torusGeometry args={[radius, 0.03, 6, 90]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.90}
        transparent
        opacity={0.55}
      />
    </mesh>
  );
}

function HubCore() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock: { elapsedTime: t } }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.55 + Math.sin(t * 0.4) * 0.12;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial
        color="#AABBFF"
        emissive="#8899EE"
        emissiveIntensity={0.6}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

function IntellectualHub() {
  return (
    <>
      <color attach="background" args={["#03020E"]} />
      <fogExp2 attach="fog" args={["#03020E", 0.012]} />
      <ambientLight intensity={0.10} />
      <pointLight position={[0, 0,  0]} intensity={1.4} color="#5566DD" distance={20} />
      <pointLight position={[0, 20, 0]} intensity={0.6} color="#9988FF" />
      <Stars radius={55} depth={40} count={2200} factor={2.5} saturation={0} fade speed={0.2} />
      <Floor color="#04031A" roughness={0.04} mixStrength={22} />
      {ORRERY_RINGS.map((r, i) => <OrreryRingMesh key={i} {...r} />)}
      <HubCore />
      <AmbientMotes color="#6677FF" opacity={0.30} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.18} luminanceSmoothing={0.85} intensity={0.72} />
      </EffectComposer>
    </>
  );
}

// ── Macro-Vault — code breathing, slow ───────────────────────────────────────

function SlowRain() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      a[i * 3]     = (Math.random() - 0.5) * 22;
      a[i * 3 + 1] = Math.random() * 16;
      a[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
    return a;
  }, []);

  useFrame((_, d) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 150; i++) {
      const y = p.getY(i) - d * 1.2;
      if (y < -1) {
        p.setX(i, (Math.random() - 0.5) * 22);
        p.setY(i, 16);
        p.setZ(i, (Math.random() - 0.5) * 22);
      } else {
        p.setY(i, y);
      }
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color="#00CC33" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function MacroVault() {
  return (
    <>
      <color attach="background" args={["#000A00"]} />
      <fogExp2 attach="fog" args={["#000A00", 0.025]} />
      <ambientLight intensity={0.07} />
      <pointLight position={[0, 12, 0]} intensity={1.2} color="#00AA22" />
      <pointLight position={[0, -1, 0]} intensity={0.4} color="#004400" distance={12} />
      <Floor color="#001200" roughness={0.10} mixStrength={18} />
      <SlowRain />
      <BackgroundRing radius={10} color="#003300" speed={0.006} height={2} />
      <BackgroundRing radius={14} color="#003300" speed={0.004} height={5} />
      <AmbientMotes color="#00FF44" opacity={0.22} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.18} luminanceSmoothing={0.82} intensity={0.68} />
      </EffectComposer>
    </>
  );
}

// ── Iteration Forge — shapes as architecture ──────────────────────────────────

type ForgeShape = {
  pos: [number, number, number];
  speed: number;
  size: number;
  shape: "ico" | "oct";
};

const FORGE_SHAPES: ForgeShape[] = [
  { pos: [ 0,  3.0,  0], speed: 0.06, size: 2.2, shape: "ico" },
  { pos: [-7,  3.5, -6], speed: 0.14, size: 1.0, shape: "ico" },
  { pos: [ 6,  2.5,  5], speed: 0.10, size: 0.8, shape: "oct" },
  { pos: [-2,  6.5,  7], speed: 0.18, size: 0.6, shape: "ico" },
  { pos: [ 5,  5.5, -7], speed: 0.11, size: 1.2, shape: "oct" },
];

function WireShape({ pos, speed, size, shape }: ForgeShape) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (!ref.current) return;
    ref.current.rotation.x += d * speed;
    ref.current.rotation.y += d * speed * 0.6;
  });
  return (
    <mesh ref={ref} position={pos}>
      {shape === "ico"
        ? <icosahedronGeometry args={[size, 0]} />
        : <octahedronGeometry  args={[size, 0]} />
      }
      <meshStandardMaterial
        wireframe
        color="#5588BB"
        transparent opacity={0.2}
        emissive="#3366AA"
        emissiveIntensity={0.55}
      />
    </mesh>
  );
}

function IterationForge() {
  return (
    <>
      <color attach="background" args={["#060810"]} />
      <fogExp2 attach="fog" args={["#060810", 0.016]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} color="#FFFFFF" />
      <pointLight position={[0, -1, 0]} intensity={0.4} color="#1133AA" distance={12} />
      <Floor color="#080A14" roughness={0.12} mixStrength={16} />
      {FORGE_SHAPES.map((s, i) => <WireShape key={i} {...s} />)}
      <BackgroundRing radius={11} color="#2244AA" speed={0.010} height={3} />
      <BackgroundRing radius={15} color="#2244AA" speed={0.006} height={7} />
      <AmbientMotes color="#4477CC" opacity={0.28} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.22} luminanceSmoothing={0.85} intensity={0.55} />
      </EffectComposer>
    </>
  );
}

// ── Simulation Sandbox — calm pixel world ─────────────────────────────────────

const SIM_COLORS = ["#CC3333", "#3333CC", "#BBBB22", "#22BBBB"] as const;

type PixelBlock = {
  pos: [number, number, number];
  color: string;
  phase: number;
  spd: number;
};

const PIXEL_BLOCKS: PixelBlock[] = (() => {
  const out: PixelBlock[] = [];
  const grid: [number, number][] = [
    [-6,-6], [-3,-6], [0,-6], [3,-6], [6,-6],
    [-4.5,-3], [-1.5,-3], [1.5,-3], [4.5,-3],
    [-6, 0], [-3, 0], [0, 0], [3, 0], [6, 0],
    [-4.5, 3], [-1.5, 3], [1.5, 3], [4.5, 3],
    [-6, 6], [-3, 6], [0, 6], [3, 6], [6, 6],
  ];
  grid.forEach(([x, z], i) => {
    out.push({
      pos:   [x, 0.5 + (i % 3) * 0.1, z],
      color: SIM_COLORS[i % SIM_COLORS.length],
      phase: i * 0.31,
      spd:   0.38 + (i % 5) * 0.06,
    });
  });
  return out;
})();

function AnimatedPixels() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock: { elapsedTime: t } }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const b = PIXEL_BLOCKS[i];
      m.position.y = b.pos[1] + Math.sin(t * b.spd + b.phase) * 0.22;
      m.rotation.y = t * 0.18 + b.phase;
    });
  });

  return (
    <>
      {PIXEL_BLOCKS.map((b, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={b.pos}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial
            color={b.color}
            transparent opacity={0.82}
            emissive={b.color}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </>
  );
}

function SimulationSandbox() {
  return (
    <>
      <color attach="background" args={["#0A0A14"]} />
      <fogExp2 attach="fog" args={["#0A0A14", 0.018]} />
      <ambientLight intensity={0.38} />
      <pointLight position={[0, 10, 0]} intensity={0.8} color="#FFF5E0" />
      <pointLight position={[0, -1, 0]} intensity={0.4} color="#220033" distance={12} />
      <Floor color="#0D0D1A" roughness={0.10} mixStrength={17} />
      <AnimatedPixels />
      <BackgroundRing radius={10} color="#220033" speed={0.007} height={2} />
      <BackgroundRing radius={14} color="#003322" speed={0.005} height={6} />
      <AmbientMotes color="#AAAAFF" opacity={0.25} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.22} luminanceSmoothing={0.85} intensity={0.60} />
      </EffectComposer>
    </>
  );
}

// ── Nexus — convergence of all five agents ────────────────────────────────────

type NexusRing = { color: string; tiltX: number; tiltZ: number; speed: number; radius: number };

const NEXUS_RINGS: NexusRing[] = [
  { color: "#BB0044", tiltX: Math.PI / 2.2, tiltZ: 0,             speed:  0.040, radius: 5.5 },
  { color: "#0066AA", tiltX: 0.18,          tiltZ: 0.5,           speed:  0.028, radius: 7.0 },
  { color: "#00CC33", tiltX: Math.PI / 3,   tiltZ: 0.2,           speed:  0.050, radius: 6.0 },
  { color: "#5588BB", tiltX: 0.10,          tiltZ: Math.PI / 4,   speed:  0.033, radius: 7.8 },
  { color: "#AA9922", tiltX: Math.PI / 6,   tiltZ: Math.PI / 3.5, speed:  0.044, radius: 6.6 },
];

function NexusRingMesh({ color, tiltX, tiltZ, speed, radius }: NexusRing) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * speed; });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, tiltZ]}>
      <torusGeometry args={[radius, 0.04, 8, 80]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.85}
        transparent
        opacity={0.55}
      />
    </mesh>
  );
}

function NexusCoreGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock: { elapsedTime: t } }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(t * 0.6) * 0.15;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial
        color="#FFFFFF"
        emissive="#DDCCFF"
        emissiveIntensity={0.6}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

function Nexus() {
  return (
    <>
      <color attach="background" args={["#06060E"]} />
      <fogExp2 attach="fog" args={["#06060E", 0.018]} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#9966FF" distance={18} />
      <Floor color="#080810" roughness={0.05} mixStrength={22} />
      {NEXUS_RINGS.map((r, i) => <NexusRingMesh key={i} {...r} />)}
      <NexusCoreGlow />
      <AmbientMotes color="#AA88FF" opacity={0.35} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.18} luminanceSmoothing={0.82} intensity={0.80} />
      </EffectComposer>
    </>
  );
}

// ── The Bazaar — warm, bright, commercially alive ─────────────────────────────

type GemConfig = { pos: [number, number, number]; speed: number; size: number; color: string; phase: number };

const BAZAAR_GEMS: GemConfig[] = [
  { pos: [ 0,   3.5,  0], speed: 0.065, size: 1.2, color: "#EE9900", phase: 0.0 },
  { pos: [-5,   2.8, -4], speed: 0.110, size: 0.7, color: "#CC6600", phase: 1.2 },
  { pos: [ 5,   3.2,  4], speed: 0.085, size: 0.9, color: "#FFBB00", phase: 2.5 },
  { pos: [-3,   5.5,  5], speed: 0.130, size: 0.5, color: "#AA5500", phase: 0.8 },
  { pos: [ 4,   4.8, -5], speed: 0.075, size: 0.8, color: "#DDAA00", phase: 1.9 },
  { pos: [-6,   4.0,  2], speed: 0.095, size: 0.6, color: "#FF9900", phase: 3.1 },
  { pos: [ 3,   6.2, -2], speed: 0.060, size: 0.4, color: "#FFCC33", phase: 2.0 },
];

function GemFloat({ pos, speed, size, color, phase }: GemConfig) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, d) => {
    if (!ref.current) return;
    ref.current.position.y = pos[1] + Math.sin(clock.elapsedTime * 0.55 + phase) * 0.4;
    ref.current.rotation.y += d * speed;
    ref.current.rotation.x += d * speed * 0.3;
  });
  return (
    <mesh ref={ref} position={pos}>
      <octahedronGeometry args={[size, 0]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.75}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

function BazaarEmbers() {
  const ref = useRef<THREE.Points>(null);
  const { pos: initPos, drift } = useMemo(() => {
    const COUNT = 140;
    const pos   = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      drift[i * 2]     = (Math.random() - 0.5) * 0.015;
      drift[i * 2 + 1] = (Math.random() - 0.5) * 0.015;
    }
    return { pos, drift };
  }, []);

  useFrame((_, d) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const COUNT = 140;
    for (let i = 0; i < COUNT; i++) {
      const y = p.getY(i) + d * 1.1;
      if (y > 14) {
        p.setX(i, (Math.random() - 0.5) * 20);
        p.setY(i, 0);
        p.setZ(i, (Math.random() - 0.5) * 20);
      } else {
        p.setY(i, y);
        p.setX(i, p.getX(i) + drift[i * 2]);
        p.setZ(i, p.getZ(i) + drift[i * 2 + 1]);
      }
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initPos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#FFBB44" transparent opacity={0.72} sizeAttenuation />
    </points>
  );
}

function Bazaar() {
  return (
    <>
      <color attach="background" args={["#0D0800"]} />
      <fogExp2 attach="fog" args={["#0D0800", 0.013]} />
      <ambientLight intensity={0.28} />
      <pointLight position={[  0, 14,   0]} intensity={2.2} color="#DD8800" />
      <pointLight position={[ -8,  3,  -8]} intensity={0.9} color="#FF6600" distance={16} />
      <pointLight position={[  8,  3,   8]} intensity={0.9} color="#FFAA00" distance={16} />
      <pointLight position={[  0,  1,   0]} intensity={0.5} color="#CC7700" distance={8}  />
      <Floor color="#140A00" roughness={0.08} mixStrength={20} />
      {BAZAAR_GEMS.map((g, i) => <GemFloat key={i} {...g} />)}
      <BazaarEmbers />
      <BackgroundRing radius={14} color="#443300" speed={0.005} height={4} />
      <AmbientMotes color="#FFAA22" opacity={0.28} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.20} luminanceSmoothing={0.80} intensity={0.85} />
      </EffectComposer>
    </>
  );
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default function EnvironmentEngine({ theme }: { theme: string }) {
  switch (theme) {
    case "roast-pit":          return <RoastPit />;
    case "macro-vault":        return <MacroVault />;
    case "iteration-forge":    return <IterationForge />;
    case "simulation-sandbox": return <SimulationSandbox />;
    case "nexus":              return <Nexus />;
    case "bazaar":             return <Bazaar />;
    case "intellectual-hub":
    default:                   return <IntellectualHub />;
  }
}
