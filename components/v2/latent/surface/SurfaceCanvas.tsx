"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import type { WorldData, WorldStructure } from "@/lib/world";
import { useWorldLive } from "@/components/v2/latent/floor/useWorldLive";
import SurfaceHUD from "./SurfaceHUD";
import {
  GROUND_SIZE, PLOT_RADIUS, SURFACE_SEED, COMPASS_PLOTS, TERRAFORM_PALETTES,
  coverage, coverageThreshold, groundColor, mulberry32, plotPosition, terrainHeight,
} from "./surface-field";

// ── Synthetica Prime: the surface ────────────────────────────────────────────
// The expansive-scale view of the agent-built world. Floors are rooms; this is
// territory. Everything rendered here is derived from live /api/world/state
// (structures, terraform stage, ballot roll) plus deterministic seeded terrain
// — no fetched assets, no new endpoints, zero LLM cost at view time. Reuses
// the floor's useWorldLive poll/diff hook so newly enacted structures play a
// build-in the moment the next poll sees them.
// Spec: cowork references/autoresearch/2026-07-12-synthetica-prime-surface-spec-v1.md

const ROSE = "#f472b6";
const ROSE_SOFT = "#f9a8d4";
const ROCK_HEX = "#241a20";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// ── Terrain ──────────────────────────────────────────────────────────────────

function Terrain({ stage, terraform }: { stage: number; terraform: string | null }) {
  const geometry = useMemo(() => {
    const seg = 110;
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const c = groundColor(x, z, stage, terraform);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [stage, terraform]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow={false}>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

// Settlement lights: they inhabit what they build. Same rule as the planet's
// emissive map — specks only inside terraformed coverage, only from stage 3.
function SettlementLights({ stage, terraform }: { stage: number; terraform: string | null }) {
  const points = useMemo(() => {
    if (stage < 3 || !terraform) return [] as [number, number, number][];
    const rand = mulberry32(SURFACE_SEED + 92);
    const pts: [number, number, number][] = [];
    const threshold = coverageThreshold(stage);
    for (let i = 0; i < 160 && pts.length < 40; i++) {
      const x = (rand() - 0.5) * 170;
      const z = (rand() - 0.5) * 170;
      if (Math.hypot(x, z) < 14) continue;
      if (coverage(x, z) < threshold) pts.push([x, terrainHeight(x, z) + 0.4, z]);
    }
    return pts;
  }, [stage, terraform]);

  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshBasicMaterial color={ROSE_SOFT} />
        </mesh>
      ))}
    </>
  );
}

// ── Structures ───────────────────────────────────────────────────────────────

const SIZE_SCALE: Record<string, number> = { small: 0.72, medium: 1, large: 1.32 };

function Rock(props: { emissiveIntensity?: number }) {
  return (
    <meshStandardMaterial
      color={ROCK_HEX}
      emissive={ROSE}
      emissiveIntensity={props.emissiveIntensity ?? 0.08}
      flatShading
      roughness={1}
    />
  );
}

function SpireMesh({ k }: { k: number }) {
  return (
    <>
      <mesh position-y={2.4 * k}>
        <cylinderGeometry args={[0.9 * k, 1.4 * k, 4.8 * k, 6]} />
        <Rock />
      </mesh>
      <mesh position-y={6.4 * k}>
        <cylinderGeometry args={[0.45 * k, 0.9 * k, 3.6 * k, 6]} />
        <Rock />
      </mesh>
      <mesh position-y={9.2 * k}>
        <cylinderGeometry args={[0.12 * k, 0.45 * k, 2.2 * k, 6]} />
        <Rock emissiveIntensity={0.16} />
      </mesh>
      <mesh position-y={10.6 * k}>
        <sphereGeometry args={[0.4 * k, 12, 12]} />
        <meshBasicMaterial color={ROSE} />
      </mesh>
    </>
  );
}

function PavilionMesh({ k }: { k: number }) {
  const legs: [number, number][] = [
    [2.4, 2.4], [2.4, -2.4], [-2.4, 2.4], [-2.4, -2.4],
  ];
  return (
    <>
      <mesh position-y={0.25 * k}>
        <boxGeometry args={[6 * k, 0.5 * k, 6 * k]} />
        <Rock />
      </mesh>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx * k, 2.1 * k, lz * k]}>
          <cylinderGeometry args={[0.22 * k, 0.26 * k, 3.2 * k, 6]} />
          <Rock />
        </mesh>
      ))}
      <mesh position-y={4.6 * k} rotation-y={Math.PI / 4}>
        <coneGeometry args={[4.6 * k, 2 * k, 4]} />
        <Rock emissiveIntensity={0.14} />
      </mesh>
    </>
  );
}

function ArchMesh({ k }: { k: number }) {
  return (
    <mesh position-y={0.2 * k}>
      <torusGeometry args={[3 * k, 0.42 * k, 8, 24, Math.PI]} />
      <Rock emissiveIntensity={0.14} />
    </mesh>
  );
}

function GardenMesh({ k, bright }: { k: number; bright: string }) {
  const blobs: { p: [number, number, number]; r: number }[] = [
    { p: [0, 0.8, 0], r: 1.2 },
    { p: [1.7, 0.55, 0.6], r: 0.85 },
    { p: [-1.5, 0.5, 0.9], r: 0.75 },
    { p: [0.5, 0.45, -1.6], r: 0.7 },
    { p: [-0.9, 0.4, -1.1], r: 0.6 },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.p[0] * k, b.p[1] * k, b.p[2] * k]}>
          <icosahedronGeometry args={[b.r * k, 1]} />
          <meshStandardMaterial color={bright} flatShading roughness={0.9} emissive={bright} emissiveIntensity={0.12} />
        </mesh>
      ))}
    </>
  );
}

// Build-in: rises from its pad the poll cycle it appears. Reduced motion pops
// in at full scale instead.
function Grow({ fresh, reduced, children }: { fresh: boolean; reduced: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(fresh && !reduced ? 0 : 1);
  useFrame((_, dt) => {
    if (!ref.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt * 0.7);
    const t = progress.current;
    const e = 1 - Math.pow(1 - t, 3);
    ref.current.scale.setScalar(Math.max(0.001, e));
  });
  return (
    <group ref={ref} scale={progress.current >= 1 ? 1 : 0.001}>
      {children}
    </group>
  );
}

function Structure({ s, fresh, reduced, bright }: { s: WorldStructure; fresh: boolean; reduced: boolean; bright: string }) {
  const [x, y, z] = plotPosition(s.plot);
  const yaw = Math.atan2(-x, -z); // face the assembly at the world's origin
  const k = SIZE_SCALE[s.size] ?? 1;
  const labelY =
    s.kind === "spire" ? 12 * k : s.kind === "pavilion" ? 6.6 * k : s.kind === "arch" ? 4.6 * k : 3 * k;

  return (
    <group position={[x, y, z]} rotation-y={yaw}>
      <mesh position-y={0.12}>
        <cylinderGeometry args={[4.5, 5, 0.3, 24]} />
        <meshStandardMaterial color="#1c1418" roughness={1} />
      </mesh>
      <Grow fresh={fresh} reduced={reduced}>
        {s.kind === "pavilion" ? <PavilionMesh k={k} /> :
         s.kind === "arch" ? <ArchMesh k={k} /> :
         s.kind === "garden" ? <GardenMesh k={k} bright={bright} /> :
         <SpireMesh k={k} />}
      </Grow>
      <Html position={[0, labelY, 0]} center distanceFactor={30} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: ROSE }}>
            {s.kind} · {s.plot}
          </p>
          <p className="text-[9px] text-zinc-400">
            {s.inscription ? `"${s.inscription}"` : `built by ${s.built_by}`}
          </p>
        </div>
      </Html>
    </group>
  );
}

// Unclaimed plots read as surveyed, waiting ground — the room to grow.
function OpenPlot({ plot }: { plot: string }) {
  const pos = plotPosition(plot);
  return (
    <group position={pos}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
        <ringGeometry args={[2.6, 3, 40]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.9}>
        <boxGeometry args={[0.14, 1.8, 0.14]} />
        <meshStandardMaterial color={ROCK_HEX} emissive={ROSE} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ── The assembly ─────────────────────────────────────────────────────────────
// Dais, beacon, and — while a ballot is open — one delegate per cast vote,
// colored by how they actually voted. Real rows only, straight from
// ballot.roll; an empty ring means nobody has voted yet.

const VOTE_COLOR: Record<string, string> = {
  yes: "#34d399",
  no: "#a1a1aa",
  abstain: "#52525b",
};

function Assembly({ world }: { world: WorldData }) {
  const roll = world.ballot?.roll ?? [];
  return (
    <group>
      <mesh position-y={0.3}>
        <cylinderGeometry args={[7, 7.6, 0.6, 48]} />
        <meshStandardMaterial color="#1a1218" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.62}>
        <ringGeometry args={[5.6, 6.1, 48]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.5} />
      </mesh>
      {/* The beacon: visible from anywhere on the surface */}
      <mesh position-y={30}>
        <cylinderGeometry args={[0.5, 0.9, 60, 12, 1, true]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position-y={30}>
        <cylinderGeometry args={[0.14, 0.14, 60, 8, 1, true]} />
        <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {roll.map((r, i) => {
        const a = (i / Math.max(1, roll.length)) * Math.PI * 2;
        const x = Math.cos(a) * 10.5;
        const z = Math.sin(a) * 10.5;
        const color = VOTE_COLOR[r.vote] ?? VOTE_COLOR.abstain;
        return (
          <group key={`${r.agent_name}-${i}`} position={[x, 0.6, z]} rotation-y={Math.atan2(-x, -z)}>
            <mesh position-y={0.8}>
              <coneGeometry args={[0.5, 1.6, 8]} />
              <meshStandardMaterial color={color} flatShading roughness={0.8} emissive={color} emissiveIntensity={0.22} />
            </mesh>
            <mesh position-y={1.9}>
              <sphereGeometry args={[0.38, 10, 10]} />
              <meshStandardMaterial color={color} flatShading roughness={0.8} emissive={color} emissiveIntensity={0.22} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((pa >> 16) & 255, (pb >> 16) & 255);
  const g = ch((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = ch(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

export default function SurfaceCanvas({ initial }: { initial: WorldData }) {
  const reduced = usePrefersReducedMotion();
  const live = useWorldLive(initial);
  const world = live.world ?? initial;
  const { stage } = world.state;
  const terraform = world.state.terraform;

  // Full-screen portal pattern mirrors UniverseCanvas/FloorScene: portal to
  // <body> and lock page scroll while mounted. In-tree, this overlay sits in
  // V2Frame's `relative z-10` content context, so the z-50 sticky header
  // paints over the HUD and the footer (same z-10, later in DOM) lands on top
  // of the scene at the top of the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // The sky remembers the terraform direction: fog and backdrop drift from
  // barren near-black toward the direction's deep tone as the stage rises.
  const terra = TERRAFORM_PALETTES[terraform ?? ""];
  const skyHex = terra ? mixHex("#0a070b", terra.deep, Math.min(1, stage / 5) * 0.45) : "#0a070b";

  const claimed = new Set<string>(world.structures.map((s) => s.plot));
  const freshIds = new Set(live.freshStructureIds);
  const bright = terra?.bright ?? ROSE;

  // One dark frame before the portal mounts, so there is no flash of chrome.
  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#07070b]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#07070b]">
      <Canvas dpr={[1, 1.5]} camera={{ position: [52, 34, 66], fov: 50, near: 0.5, far: 700 }}>
        <color attach="background" args={[skyHex]} />
        <fog attach="fog" args={[skyHex, 70, 240]} />
        <ambientLight color="#c4a2b4" intensity={0.35} />
        <directionalLight color="#ffd9a0" intensity={1.15} position={[80, 60, -40]} />
        <Stars radius={320} depth={60} count={1600} factor={4} saturation={0.3} fade speed={reduced ? 0 : 0.4} />

        <Terrain stage={stage} terraform={terraform} />
        <SettlementLights stage={stage} terraform={terraform} />
        <Assembly world={world} />

        {world.structures.map((s) => (
          <Structure key={s.id} s={s} fresh={freshIds.has(s.id)} reduced={reduced} bright={bright} />
        ))}
        {COMPASS_PLOTS.filter((p) => !claimed.has(p)).map((p) => (
          <OpenPlot key={p} plot={p} />
        ))}

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={18}
          maxDistance={Math.max(60, PLOT_RADIUS * 4.2)}
          maxPolarAngle={1.42}
          target={[0, 3, 0]}
          autoRotate={!reduced}
          autoRotateSpeed={0.35}
        />
      </Canvas>

      <SurfaceHUD world={world} justEnacted={live.justEnacted} />
    </div>,
    document.body
  );
}
