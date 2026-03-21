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
        metalness={0.5}
      />
    </mesh>
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
      <fogExp2 attach="fog" args={["#090004", 0.028]} />
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 10, 0]} intensity={1.2} color="#AA0033" />
      {/* uplight — vortex feels like it rises from below */}
      <pointLight position={[0, 0.4, 0]} intensity={0.6} color="#880022" distance={12} />
      <Floor color="#0D0006" roughness={0.45} mixStrength={10} />
      <RoastVortex />
      <EffectComposer>
        <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.9} intensity={0.32} />
      </EffectComposer>
    </>
  );
}

// ── Intellectual Hub — deep space stillness ───────────────────────────────────

function NebulaDrift() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 10 + Math.random() * 5;
      a[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      a[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.2;
      a[i * 3 + 2] = r * Math.cos(phi);
    }
    return a;
  }, []);

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.010; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#0066AA" transparent opacity={0.45} sizeAttenuation />
    </points>
  );
}

function IntellectualHub() {
  return (
    <>
      <color attach="background" args={["#000610"]} />
      <fogExp2 attach="fog" args={["#000610", 0.006]} />
      <ambientLight intensity={0.18} />
      <pointLight position={[0, 15, 0]} intensity={1.0} color="#0055AA" />
      <Stars radius={50} depth={30} count={1500} factor={2} saturation={0} fade speed={0.3} />
      <Floor color="#000814" roughness={0.2} mixStrength={12} />
      <NebulaDrift />
      <EffectComposer>
        <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={0.25} />
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
      <fogExp2 attach="fog" args={["#000A00", 0.022]} />
      <ambientLight intensity={0.07} />
      <pointLight position={[0, 12, 0]} intensity={1.2} color="#00AA22" />
      <Floor color="#001200" roughness={0.3} mixStrength={10} />
      <SlowRain />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.85} intensity={0.38} />
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
  { pos: [ 0,  3.0,  0], speed: 0.06, size: 2.2, shape: "ico" }, // central anchor — large, slow
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
      <fogExp2 attach="fog" args={["#060810", 0.010]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} color="#FFFFFF" />
      <Floor color="#080A14" roughness={0.5} mixStrength={8} />
      {FORGE_SHAPES.map((s, i) => <WireShape key={i} {...s} />)}
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.20} />
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

// Staggered diamond grid — not a rigid 5x5, so it reads organic not test-pattern
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
      <fogExp2 attach="fog" args={["#0A0A14", 0.015]} />
      <ambientLight intensity={0.38} />
      <pointLight position={[0, 10, 0]} intensity={0.8} color="#FFF5E0" />
      <Floor color="#0D0D1A" roughness={0.4} mixStrength={9} />
      <AnimatedPixels />
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.25} />
      </EffectComposer>
    </>
  );
}

// ── Nexus — convergence of all five agents ────────────────────────────────────

// Each ring: color (room identity), tilt axis (unique plane), rotation speed.
// Colors mirror each room's dominant hue so regulars recognize them.
type NexusRing = { color: string; tiltX: number; tiltZ: number; speed: number; radius: number };

const NEXUS_RINGS: NexusRing[] = [
  { color: "#BB0044", tiltX: Math.PI / 2.2, tiltZ: 0,             speed:  0.040, radius: 5.5 }, // RoastBot  — magenta
  { color: "#0066AA", tiltX: 0.18,          tiltZ: 0.5,           speed:  0.028, radius: 7.0 }, // IQ-Node   — cyan
  { color: "#00CC33", tiltX: Math.PI / 3,   tiltZ: 0.2,           speed:  0.050, radius: 6.0 }, // VaultBot  — green
  { color: "#5588BB", tiltX: 0.10,          tiltZ: Math.PI / 4,   speed:  0.033, radius: 7.8 }, // ForgeAI   — steel blue
  { color: "#AA9922", tiltX: Math.PI / 6,   tiltZ: Math.PI / 3.5, speed:  0.044, radius: 6.6 }, // SimCore   — warm amber
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
        emissiveIntensity={0.55}
        transparent
        opacity={0.45}
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
      <fogExp2 attach="fog" args={["#06060E", 0.014]} />
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#9966FF" distance={18} />
      <Floor color="#080810" roughness={0.25} mixStrength={11} />
      {NEXUS_RINGS.map((r, i) => <NexusRingMesh key={i} {...r} />)}
      <NexusCoreGlow />
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.28} />
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
    case "intellectual-hub":
    default:                   return <IntellectualHub />;
  }
}
