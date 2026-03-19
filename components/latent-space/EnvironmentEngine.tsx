"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";

// ── Roast Pit — neon vortex spiral ───────────────────────────────────────────

function VortexParticles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const t     = i / 300;
      const angle = t * Math.PI * 2 * 8;
      const r     = t * 14;
      arr[i * 3]     = Math.cos(angle) * r;
      arr[i * 3 + 1] = t * 5 - 1;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.25;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color="#FF0080" transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}

function RoastPit() {
  return (
    <>
      <color attach="background" args={["#0D0008"]} />
      <fogExp2 attach="fog" args={["#0D0008", 0.018]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[-8, 10, -8]} intensity={2.0} color="#FF0080" />
      <pointLight position={[ 8,  6,  8]} intensity={1.5} color="#FF4400" />
      <pointLight position={[ 0,  3,  0]} intensity={0.8} color="#AA0040" />
      <Grid
        position={[0, 0, 0]} args={[40, 40]}
        cellSize={1} cellThickness={0.4} cellColor="#3A0020"
        sectionSize={5} sectionThickness={0.8} sectionColor="#1A0010"
        fadeDistance={28} fadeStrength={1.2} followCamera={false} infiniteGrid={false}
      />
      <VortexParticles />
    </>
  );
}

// ── Intellectual Hub — data nebula ────────────────────────────────────────────

function NebulaParticles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const phi   = Math.acos(2 * ((i * 7 + 3) % 100) / 100 - 1);
      const theta = ((i * 13) % 628) / 100;
      const r     = 9 + ((i * 17) % 100) / 8;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.018;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#00AAFF" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function IntellectualHub() {
  return (
    <>
      <color attach="background" args={["#00080D"]} />
      <fogExp2 attach="fog" args={["#000B14", 0.010]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[ 0, 15,   0]} intensity={1.8} color="#00AAFF" />
      <pointLight position={[-10,  8,  10]} intensity={1.2} color="#8844FF" />
      <pointLight position={[10,   5, -10]} intensity={0.8} color="#0044AA" />
      <Grid
        position={[0, 0, 0]} args={[40, 40]}
        cellSize={1} cellThickness={0.4} cellColor="#001A3A"
        sectionSize={5} sectionThickness={0.8} sectionColor="#000D1A"
        fadeDistance={28} fadeStrength={1.2} followCamera={false} infiniteGrid={false}
      />
      <NebulaParticles />
    </>
  );
}

// ── Macro-Vault — falling data streams ───────────────────────────────────────

function DataStreamParticles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      arr[i * 3]     = ((i * 7  + 11) % 30) - 15;
      arr[i * 3 + 1] = ((i * 13 +  7) % 15);
      arr[i * 3 + 2] = ((i * 11 +  3) % 30) - 15;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 200; i++) {
      const y = pos.getY(i) - delta * 2.5;
      pos.setY(i, y < -2 ? 14 : y);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#00FF41" transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

function MacroVault() {
  return (
    <>
      <color attach="background" args={["#000D00"]} />
      <fogExp2 attach="fog" args={["#000D00", 0.015]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[ 0, 12,   0]} intensity={2.0} color="#00FF41" />
      <pointLight position={[-10,  4,  10]} intensity={1.0} color="#FFB300" />
      <pointLight position={[10,   4, -10]} intensity={0.6} color="#005500" />
      <Grid
        position={[0, 0, 0]} args={[40, 40]}
        cellSize={1} cellThickness={0.4} cellColor="#001A00"
        sectionSize={5} sectionThickness={0.8} sectionColor="#000D00"
        fadeDistance={28} fadeStrength={1.2} followCamera={false} infiniteGrid={false}
      />
      <DataStreamParticles />
    </>
  );
}

// ── Iteration Forge — rotating geometric wireframes ───────────────────────────

function RotatingShape({
  position,
  speed,
  size,
}: {
  position: [number, number, number];
  speed: number;
  size: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * speed;
    ref.current.rotation.y += delta * speed * 0.7;
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[size, 0]} />
      <meshStandardMaterial wireframe color="#CCDDFF" transparent opacity={0.18} />
    </mesh>
  );
}

const FORGE_SHAPES: { position: [number, number, number]; speed: number; size: number }[] = [
  { position: [-8,  4, -8], speed: 0.40, size: 1.0 },
  { position: [ 9,  3,  7], speed: 0.30, size: 0.8 },
  { position: [-5,  6,  8], speed: 0.50, size: 0.6 },
  { position: [ 6,  5, -7], speed: 0.35, size: 1.2 },
  { position: [ 0,  7,  0], speed: 0.25, size: 0.9 },
  { position: [-10, 2,  3], speed: 0.45, size: 0.7 },
];

function IterationForge() {
  return (
    <>
      <color attach="background" args={["#0D0D0D"]} />
      <fogExp2 attach="fog" args={["#0D0D0D", 0.012]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.0} color="#FFFFFF" />
      <pointLight position={[ 0, 12,  0]} intensity={1.5} color="#FFFFFF" />
      <pointLight position={[-8,  6, -8]} intensity={0.8} color="#4488CC" />
      <Grid
        position={[0, 0, 0]} args={[40, 40]}
        cellSize={1} cellThickness={0.4} cellColor="#1A1A2E"
        sectionSize={5} sectionThickness={0.8} sectionColor="#0D0D1A"
        fadeDistance={28} fadeStrength={1.2} followCamera={false} infiniteGrid={false}
      />
      {FORGE_SHAPES.map((s, i) => (
        <RotatingShape key={i} position={s.position} speed={s.speed} size={s.size} />
      ))}
    </>
  );
}

// ── Simulation Sandbox — 8-bit pixel blocks ───────────────────────────────────

const PIXEL_COLORS = ["#FF4444", "#4444FF", "#FFFF00", "#44FFFF"];

const PIXEL_BLOCKS: { x: number; y: number; z: number; color: string }[] = (() => {
  const blocks: { x: number; y: number; z: number; color: string }[] = [];
  let idx = 0;
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      if (Math.abs(row) + Math.abs(col) <= 5 && (row + col) % 2 === 0) {
        blocks.push({
          x: row * 2.8,
          y: 0.2 + (idx % 6) * 0.35,
          z: col * 2.8,
          color: PIXEL_COLORS[(Math.abs(row) + Math.abs(col) * 2) % PIXEL_COLORS.length],
        });
        idx++;
      }
    }
  }
  return blocks;
})();

function SimulationSandbox() {
  return (
    <>
      <color attach="background" args={["#111118"]} />
      <fogExp2 attach="fog" args={["#111118", 0.014]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[-6, 8,  6]} intensity={1.2} color="#FF4444" />
      <pointLight position={[ 6, 8, -6]} intensity={1.2} color="#4444FF" />
      <pointLight position={[ 0, 4,  0]} intensity={0.8} color="#FFFF00" />
      <Grid
        position={[0, 0, 0]} args={[40, 40]}
        cellSize={2} cellThickness={0.6} cellColor="#1A1A40"
        sectionSize={8} sectionThickness={1.0} sectionColor="#0D0D2A"
        fadeDistance={28} fadeStrength={1.2} followCamera={false} infiniteGrid={false}
      />
      {PIXEL_BLOCKS.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={b.color} transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  );
}

// ── Engine — switches environment based on active room theme ──────────────────

export default function EnvironmentEngine({ theme }: { theme: string }) {
  switch (theme) {
    case "roast-pit":          return <RoastPit />;
    case "macro-vault":        return <MacroVault />;
    case "iteration-forge":    return <IterationForge />;
    case "simulation-sandbox": return <SimulationSandbox />;
    case "intellectual-hub":
    default:                   return <IntellectualHub />;
  }
}
