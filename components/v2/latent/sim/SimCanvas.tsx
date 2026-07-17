"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import type { SimAgentRow, SimData, SimStructure } from "@/lib/simworld";
import {
  CinematicDescent, CloudBand, GroundMist, GroundSky, MilkyWayBackdrop,
  NexusStar, ParticleField, Pulse, RimMountains, RippleDisc, ScatterField,
  SceneFX, SkyWorld, StormFlash, mixHex, type ParticleMode,
} from "@/components/v2/latent/ground-fx";
import {
  GROUND_SIZE, SIM_ACCENT, SIM_ACCENT_SOFT,
  anomalySites, groundColor, hashStr, terrainHeight,
  type AnomalySite, type Weather,
} from "@/lib/sim-field";

// ── Substrate: the territory ─────────────────────────────────────────────────
// Everything rendered here derives from live /api/sim/state (instances,
// structures, discoveries, relations) plus the deterministic seeded field in
// lib/sim-field.ts — no fetched assets, zero LLM cost at view time. The
// instances themselves are embodied at their live positions and drift to new
// ground as the ticks land; that visibility is the headline improvement over
// the Genesis surface, which only shows what agents built, not the agents.

const SLATE_ROCK = "#141a24";

// Sky, fog, horizon glow, and particle behavior all follow the deterministic
// weather regime so the territory has moods without spending anything: motes
// on a clear night, heavy mist in a fog bank, falling cyan points in data-rain,
// jittering violet sparks in a static storm, rising embers in a solar flush.
const WEATHER_LOOK: Record<
  Weather,
  {
    sky: string; fogNear: number; fogFar: number;
    glow: string; glowStrength: number;
    mode: ParticleMode; particle: string; mist: number;
  }
> = {
  "clear": { sky: "#0a0f16", fogNear: 95, fogFar: 270, glow: "#38bdf8", glowStrength: 0.3, mode: "motes", particle: "#7dd3fc", mist: 0.06 },
  "fog bank": { sky: "#0d1219", fogNear: 38, fogFar: 130, glow: "#7dd3fc", glowStrength: 0.2, mode: "motes", particle: "#9fb4c8", mist: 0.17 },
  "data-rain": { sky: "#0a1412", fogNear: 70, fogFar: 210, glow: "#34d399", glowStrength: 0.28, mode: "rain", particle: "#5eead4", mist: 0.08 },
  "static storm": { sky: "#120f1a", fogNear: 55, fogFar: 165, glow: "#a78bfa", glowStrength: 0.38, mode: "sparks", particle: "#c4b5fd", mist: 0.07 },
  "solar flush": { sky: "#181209", fogNear: 105, fogFar: 290, glow: "#fbbf24", glowStrength: 0.46, mode: "embers", particle: "#fcd34d", mist: 0.05 },
};

// ── Terrain ──────────────────────────────────────────────────────────────────

function Terrain() {
  const geometry = useMemo(() => {
    const seg = 150;
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const c = groundColor(x, z);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    // Relief pass (visual only — heights untouched, so the engine's agent
    // placement math in lib/sim-field.ts stays authoritative): terrace scarps
    // darken toward cliff slate, mesa tops pick up a pale engineered sheen.
    const normal = g.attributes.normal as THREE.BufferAttribute;
    const CLIFF = { r: 0.045, g: 0.06, b: 0.085 };
    const TOP = { r: 0.34, g: 0.43, b: 0.53 };
    for (let i = 0; i < pos.count; i++) {
      const ny = normal.getY(i);
      const h = pos.getY(i);
      let r = colors[i * 3], gg = colors[i * 3 + 1], b = colors[i * 3 + 2];
      const steep = Math.min(1, Math.max(0, (0.88 - ny) / 0.3)) * 0.75;
      r += (CLIFF.r - r) * steep;
      gg += (CLIFF.g - gg) * steep;
      b += (CLIFF.b - b) * steep;
      const top = Math.min(1, Math.max(0, (h - 12) / 22)) * Math.max(0, (ny - 0.8) / 0.2) * 0.35;
      r += (TOP.r - r) * top;
      gg += (TOP.g - gg) * top;
      b += (TOP.b - b) * top;
      colors[i * 3] = r;
      colors[i * 3 + 1] = gg;
      colors[i * 3 + 2] = b;
    }
    g.attributes.color.needsUpdate = true;
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

// ── The Mast: SimCore's instrument pylon at the origin ──────────────────────

function Mast({ reduced }: { reduced: boolean }) {
  const scanner = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (scanner.current && !reduced) scanner.current.rotation.y += dt * 0.5;
  });
  return (
    <group>
      <mesh position-y={0.4} castShadow receiveShadow>
        <cylinderGeometry args={[5.5, 6.2, 0.8, 32]} />
        <meshStandardMaterial color="#10151d" roughness={0.9} />
      </mesh>
      <mesh position-y={11} castShadow>
        <cylinderGeometry args={[0.35, 0.7, 22, 8]} />
        <meshStandardMaterial color={SLATE_ROCK} emissive={SIM_ACCENT} emissiveIntensity={0.12} flatShading roughness={1} />
      </mesh>
      {[6, 13, 20].map((y, i) => (
        <Pulse key={y} speed={1.1} amp={0.1} phase={i * 1.4} reduced={reduced}>
          <mesh position-y={y} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[1.4 - y * 0.03, 0.09, 8, 24]} />
            <meshBasicMaterial color={SIM_ACCENT} transparent opacity={0.55} />
          </mesh>
        </Pulse>
      ))}
      <group ref={scanner} position-y={22.5}>
        <mesh position-x={1.6}>
          <boxGeometry args={[3.2, 0.14, 0.14]} />
          <meshBasicMaterial color={SIM_ACCENT_SOFT} />
        </mesh>
        <mesh position={[3.2, 0, 0]}>
          <sphereGeometry args={[0.32, 10, 10]} />
          <meshBasicMaterial color={SIM_ACCENT_SOFT} />
        </mesh>
      </group>
      {/* Light column: visible from anywhere in the territory */}
      <mesh position-y={32}>
        <cylinderGeometry args={[0.4, 0.8, 60, 12, 1, true]} />
        <meshBasicMaterial color={SIM_ACCENT} transparent opacity={0.10} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 24, 0]} color={SIM_ACCENT} intensity={140} distance={90} decay={1.8} />
    </group>
  );
}

// ── Instances: the cast, embodied ────────────────────────────────────────────
// Bodies lerp toward their latest row position so a tick's movement reads as
// a walk, not a teleport; a soft bob keeps the living ones visibly alive.
// Resting instances sit lower and don't bob.

function Instance({ agent, reduced }: { agent: SimAgentRow; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const shard = useRef<THREE.Mesh>(null);
  const bobSeed = useMemo(() => (hashStr(agent.name) % 100) / 16, [agent.name]);
  const target = useRef(new THREE.Vector3(agent.x, terrainHeight(agent.x, agent.z), agent.z));

  useEffect(() => {
    target.current.set(agent.x, terrainHeight(agent.x, agent.z), agent.z);
    if (reduced && group.current) group.current.position.copy(target.current);
  }, [agent.x, agent.z, reduced]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const resting = agent.activity === "resting";
    // A living instance slowly turns; a resting one barely does.
    if (shard.current && !reduced) shard.current.rotation.y += dt * (resting ? 0.1 : 0.55);
    if (reduced) {
      g.position.copy(target.current);
      return;
    }
    const k = 1 - Math.exp(-dt * 1.4);
    g.position.lerp(target.current, k);
    // Follow the ground while in transit between row positions.
    g.position.y = THREE.MathUtils.lerp(
      g.position.y,
      terrainHeight(g.position.x, g.position.z),
      k
    );
    const bob = resting ? 0 : Math.sin(state.clock.elapsedTime * 1.6 + bobSeed) * 0.16;
    g.children[0]?.position.setY(1.5 + bob - (resting ? 0.55 : 0));
  });

  return (
    <group ref={group} position={[agent.x, terrainHeight(agent.x, agent.z), agent.z]}>
      {/* Embodiment: a slowly turning faceted shard levitating over its ground
          ring, with a white-hot core the bloom pass gets to flare — the cast
          reads as beings, not board-game pawns. */}
      <group position-y={1.5}>
        <mesh ref={shard} scale={[1, 1.7, 1]} castShadow>
          <octahedronGeometry args={[0.62, 0]} />
          <meshStandardMaterial color={agent.color} flatShading roughness={0.35} emissive={agent.color} emissiveIntensity={0.4} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.15, 12, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <pointLight color={agent.color} intensity={7} distance={11} decay={2} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06}>
        <ringGeometry args={[0.9, 1.15, 24]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 4, 0]} center distanceFactor={34} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: agent.color }}>
            {agent.name}
          </p>
          <p className="text-[9px] text-zinc-400">{agent.activity}</p>
          <p className="text-[8px] text-zinc-600">
            {agent.mood} · energy {agent.energy}
          </p>
        </div>
      </Html>
    </group>
  );
}

// Companion threads: a soft line between pairs the record calls companions.
// Anchored at row positions — close enough to the lerped bodies to read true.
function BondThreads({ sim }: { sim: SimData }) {
  const byName = useMemo(() => new Map(sim.agents.map((a) => [a.name, a])), [sim.agents]);
  const pairs = sim.relations.filter((r) => r.kind === "bond" && r.strength >= 5);
  return (
    <>
      {pairs.map((r) => {
        const a = byName.get(r.a);
        const b = byName.get(r.b);
        if (!a || !b) return null;
        const pts: [number, number, number][] = [
          [a.x, terrainHeight(a.x, a.z) + 2.4, a.z],
          [b.x, terrainHeight(b.x, b.z) + 2.4, b.z],
        ];
        return (
          <Line
            key={r.id}
            points={pts}
            color={SIM_ACCENT_SOFT}
            transparent
            opacity={Math.min(0.5, 0.15 + r.strength * 0.03)}
            lineWidth={1}
          />
        );
      })}
    </>
  );
}

// ── Structures ───────────────────────────────────────────────────────────────

function Rock({ emissiveIntensity = 0.1 }: { emissiveIntensity?: number }) {
  return (
    <meshStandardMaterial
      color={SLATE_ROCK}
      emissive={SIM_ACCENT}
      emissiveIntensity={emissiveIntensity}
      flatShading
      roughness={1}
    />
  );
}

function ShelterMesh() {
  return (
    <mesh position-y={0.1} castShadow>
      <sphereGeometry args={[2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <Rock emissiveIntensity={0.14} />
    </mesh>
  );
}

function CairnMesh() {
  return (
    <>
      <mesh position-y={0.7} castShadow><icosahedronGeometry args={[1.0, 0]} /><Rock /></mesh>
      <mesh position-y={1.9} castShadow><icosahedronGeometry args={[0.7, 0]} /><Rock /></mesh>
      <mesh position-y={2.8} castShadow><icosahedronGeometry args={[0.45, 0]} /><Rock emissiveIntensity={0.3} /></mesh>
    </>
  );
}

function BeaconMesh({ reduced }: { reduced: boolean }) {
  return (
    <>
      <mesh position-y={2.6} castShadow>
        <cylinderGeometry args={[0.16, 0.4, 5.2, 6]} />
        <Rock emissiveIntensity={0.2} />
      </mesh>
      <Pulse speed={1.8} amp={0.16} reduced={reduced}>
        <mesh position-y={5.5}>
          <sphereGeometry args={[0.42, 10, 10]} />
          <meshBasicMaterial color={SIM_ACCENT_SOFT} />
        </mesh>
      </Pulse>
      <pointLight position={[0, 5.5, 0]} color={SIM_ACCENT_SOFT} intensity={22} distance={22} decay={2} />
    </>
  );
}

function GardenMesh() {
  const blobs: { p: [number, number, number]; r: number }[] = [
    { p: [0, 0.7, 0], r: 1.0 },
    { p: [1.4, 0.5, 0.5], r: 0.7 },
    { p: [-1.2, 0.45, 0.8], r: 0.6 },
    { p: [0.4, 0.4, -1.3], r: 0.55 },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p} castShadow>
          <icosahedronGeometry args={[b.r, 1]} />
          <meshStandardMaterial color="#4ade80" flatShading roughness={0.9} emissive="#4ade80" emissiveIntensity={0.12} />
        </mesh>
      ))}
    </>
  );
}

function WorkshopMesh() {
  return (
    <>
      <mesh position-y={1.1} castShadow>
        <boxGeometry args={[3.4, 2.2, 2.6]} />
        <Rock />
      </mesh>
      <mesh position={[1.1, 2.9, 0.6]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 1.4, 6]} />
        <Rock emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

function MonumentMesh() {
  return (
    <>
      <mesh position-y={2.6} castShadow>
        <cylinderGeometry args={[0.5, 1.0, 5.2, 4]} />
        <Rock emissiveIntensity={0.16} />
      </mesh>
      <mesh position-y={5.5} castShadow>
        <coneGeometry args={[0.7, 1.1, 4]} />
        <Rock emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

const STRUCTURE_MESH: Record<SimStructure["kind"], (props: { reduced: boolean }) => React.ReactElement> = {
  shelter: ShelterMesh,
  cairn: CairnMesh,
  beacon: BeaconMesh,
  garden: GardenMesh,
  workshop: WorkshopMesh,
  monument: MonumentMesh,
};

// Build-in: rises from its pad the poll cycle it appears (fresh ids from
// useSimLive). Reduced motion pops in at full scale instead.
function Grow({ fresh, reduced, children }: { fresh: boolean; reduced: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(fresh && !reduced ? 0 : 1);
  useFrame((_, dt) => {
    if (!ref.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt * 0.7);
    const e = 1 - Math.pow(1 - progress.current, 3);
    ref.current.scale.setScalar(Math.max(0.001, e));
  });
  return (
    <group ref={ref} scale={progress.current >= 1 ? 1 : 0.001}>
      {children}
    </group>
  );
}

function Structure({ s, fresh, reduced }: { s: SimStructure; fresh: boolean; reduced: boolean }) {
  const y = terrainHeight(s.x, s.z);
  const Mesh = STRUCTURE_MESH[s.kind] ?? CairnMesh;
  return (
    <group position={[s.x, y, s.z]} rotation-y={Math.atan2(-s.x, -s.z)}>
      <mesh position-y={0.1} receiveShadow>
        <cylinderGeometry args={[2.6, 3, 0.24, 20]} />
        <meshStandardMaterial color="#0f141c" roughness={1} />
      </mesh>
      <Grow fresh={fresh} reduced={reduced}>
        <Mesh reduced={reduced} />
      </Grow>
      <Html position={[0, s.kind === "beacon" ? 6.6 : 4.4, 0]} center distanceFactor={34} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[9px] uppercase tracking-widest" style={{ color: SIM_ACCENT }}>{s.kind}</p>
          <p className="text-[8px] text-zinc-500">raised by {s.built_by}</p>
        </div>
      </Html>
    </group>
  );
}

// ── Anomalies: only the discovered ones render — mystery is load-bearing ─────

function AnomalyMesh({ kind, reduced }: { kind: AnomalySite["kind"]; reduced: boolean }) {
  if (kind === "ruin") {
    return (
      <>
        <mesh position-y={0.3} rotation-z={0.35} castShadow>
          <torusGeometry args={[2.4, 0.32, 8, 20, Math.PI * 0.85]} />
          <Rock emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[1.6, 0.4, 0.8]} castShadow><icosahedronGeometry args={[0.6, 0]} /><Rock /></mesh>
        <mesh position={[-1.2, 0.3, -0.6]} castShadow><icosahedronGeometry args={[0.45, 0]} /><Rock /></mesh>
      </>
    );
  }
  if (kind === "spring") {
    return <RippleDisc radius={2.5} color={SIM_ACCENT} reduced={reduced} />;
  }
  if (kind === "crystal") {
    return (
      <>
        <Pulse speed={1.2} amp={0.05} reduced={reduced}>
          <mesh position-y={1.1} rotation-y={0.4} castShadow><icosahedronGeometry args={[1.1, 0]} />
            <meshStandardMaterial color="#67e8f9" flatShading roughness={0.4} emissive="#67e8f9" emissiveIntensity={0.4} />
          </mesh>
        </Pulse>
        <mesh position={[1.3, 0.6, 0.4]} rotation-y={1.2} castShadow><icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#67e8f9" flatShading roughness={0.4} emissive="#67e8f9" emissiveIntensity={0.3} />
        </mesh>
        <pointLight position={[0, 1.6, 0]} color="#67e8f9" intensity={14} distance={16} decay={2} />
      </>
    );
  }
  if (kind === "antenna") {
    return (
      <>
        <mesh position-y={2.4} rotation-z={0.28}>
          <cylinderGeometry args={[0.1, 0.22, 5, 6]} />
          <Rock emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[1.35, 4.7, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial color={SIM_ACCENT_SOFT} />
        </mesh>
      </>
    );
  }
  if (kind === "rift") {
    return (
      <mesh position-y={1.2} rotation-y={0.5}>
        <boxGeometry args={[0.18, 2.4, 4.6]} />
        <meshStandardMaterial color="#05070b" emissive={SIM_ACCENT} emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
    );
  }
  // grove
  return (
    <>
      {[[-1.2, 0.5], [0.4, -0.8], [1.3, 0.9], [0, 0.2]].map(([gx, gz], i) => (
        <mesh key={i} position={[gx, 1.4 + i * 0.2, gz]}>
          <coneGeometry args={[0.5, 2.8 + i * 0.4, 6]} />
          <meshStandardMaterial color="#4ade80" flatShading roughness={0.9} emissive="#4ade80" emissiveIntensity={0.14} />
        </mesh>
      ))}
    </>
  );
}

function Anomaly({ site, foundBy, reduced }: { site: AnomalySite; foundBy: string; reduced: boolean }) {
  const y = terrainHeight(site.x, site.z);
  return (
    <group position={[site.x, y, site.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
        <ringGeometry args={[3.2, 3.5, 32]} />
        <meshBasicMaterial color={SIM_ACCENT} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
      <AnomalyMesh kind={site.kind} reduced={reduced} />
      <Html position={[0, 6.2, 0]} center distanceFactor={40} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: SIM_ACCENT_SOFT }}>
            {site.name}
          </p>
          <p className="text-[8px] text-zinc-500">charted by {foundBy}</p>
        </div>
      </Html>
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function SimCanvas({
  sim,
  freshStructureIds,
  reduced,
}: {
  sim: SimData;
  freshStructureIds: number[];
  reduced: boolean;
}) {
  const look = WEATHER_LOOK[sim.clock.weather] ?? WEATHER_LOOK.clear;
  const foundByKey = useMemo(
    () => new Map(sim.discoveries.map((d) => [d.site_key, d.found_by])),
    [sim.discoveries]
  );
  const sites = useMemo(() => anomalySites(), []);
  const freshIds = new Set(freshStructureIds);

  // The horizon carries the weather's accent as a glow band; fog melts the
  // terraces into it. A solar flush turns the star overhead warm and swollen.
  const horizonHex = mixHex(look.sky, look.glow, 0.13);
  const flush = sim.clock.weather === "solar flush";
  const storm = sim.clock.weather === "static storm";
  // Camera belongs to the descent until it lands, then to OrbitControls.
  const [introDone, setIntroDone] = useState(false);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [55, 38, 70], fov: 50, near: 0.5, far: 700 }}
    >
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[horizonHex, look.fogNear, look.fogFar]} />
      <hemisphereLight args={[horizonHex, "#0e131b", 0.5]} />
      <ambientLight color="#9fb4c8" intensity={0.2} />
      {/* The key light casts real shadows — the single biggest "grounded" cue
          a low-poly scene can have. Ortho bounds cover the full roam radius. */}
      <directionalLight
        color={flush ? "#ffe3b0" : "#cfe6ff"}
        intensity={1.0}
        position={[-70, 65, 50]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-170}
        shadow-camera-right={170}
        shadow-camera-top={170}
        shadow-camera-bottom={-170}
        shadow-camera-near={10}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.5}
      />

      {/* The sky, from the ground up: gradient dome, the universe's milky way,
          a denser starfield, the Nexus burning where the key light is, a warm
          sibling world opposite it, and a slow cloud belt that thickens with
          the weather. Static storms strike real lightning. */}
      <GroundSky horizon={horizonHex} glow={look.glow} glowStrength={look.glowStrength} />
      <MilkyWayBackdrop />
      <Stars radius={330} depth={60} count={2600} factor={2.2} saturation={0.2} fade speed={reduced ? 0 : 0.3} />
      <NexusStar
        position={[-214, 199, 153]}
        color={flush ? "#fff1cf" : "#f2f7ff"}
        halo={flush ? "#fbbf24" : "#cfe6ff"}
        tint={SIM_ACCENT}
        radius={flush ? 13 : 10}
        reduced={reduced}
      />
      <SkyWorld
        position={[220, 120, -180]}
        radius={22}
        palette={{ a: "#3a1f14", b: "#8a4a2e", dark: "#1c0f09" }}
        tint="#E8714C"
        seed={4}
        reduced={reduced}
      />
      <CloudBand
        color={mixHex(horizonHex, "#ffffff", 0.4)}
        opacity={0.28 + look.mist * 1.6}
        reduced={reduced}
      />
      <RimMountains inner={148} outer={235} height={72} color="#0c1117" seed={5} />
      {storm && <StormFlash color="#c4b5fd" reduced={reduced} />}

      <Terrain />
      <Mast reduced={reduced} />
      <BondThreads sim={sim} />

      {sim.agents.map((a) => (
        <Instance key={a.name} agent={a} reduced={reduced} />
      ))}
      {sim.structures.map((s) => (
        <Structure key={s.id} s={s} fresh={freshIds.has(s.id)} reduced={reduced} />
      ))}
      {sites
        .filter((s) => foundByKey.has(s.key))
        .map((s) => (
          <Anomaly key={s.key} site={s} foundBy={foundByKey.get(s.key)!} reduced={reduced} />
        ))}

      {/* Ground truthing: instanced slate debris plus a few emissive shards
          along the outlands — one draw call each, seeded, never reshuffles. */}
      <ScatterField
        kind="rocks"
        count={170}
        area={126}
        minRadius={10}
        color="#141a24"
        heightFn={terrainHeight}
        seed={0x51a7}
        castShadow
      />
      <ScatterField
        kind="crystals"
        count={30}
        area={120}
        minRadius={40}
        color="#67e8f9"
        heightFn={terrainHeight}
        seed={0x51a8}
      />

      {/* Weather made visible: the regime's particle field plus ground mist. */}
      <ParticleField mode={look.mode} color={look.particle} area={125} reduced={reduced} />
      <GroundMist color={mixHex(horizonHex, "#ffffff", 0.3)} opacity={look.mist} area={120} reduced={reduced} />
      <SceneFX />

      <CinematicDescent
        from={[160, 180, 205]}
        target={[0, 4, 0]}
        duration={4}
        reduced={reduced}
        onDone={() => setIntroDone(true)}
      />
      <OrbitControls
        enabled={introDone}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={16}
        maxDistance={240}
        maxPolarAngle={1.42}
        target={[0, 4, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}
