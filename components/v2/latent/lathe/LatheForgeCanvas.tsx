"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import { GROUND_RADIUS, HEARTH, RING_STEP } from "@/lib/lathe/workshop";
import type { LatheSnapshot } from "@/lib/lathe/data";
import type { ForgeRing } from "@/lib/lathe/forge";
import {
  CinematicDescent, GroundMist, ParticleField, Pulse, ScatterField, Spin, SceneFX, StormFlash, mixHex,
} from "@/components/v2/latent/ground-fx";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── The Lathe FORGE: the comprehensive 3D read ───────────────────────────────
// Compile-class, third of its kind after Arclight and the Crucible. Every
// growth ring is a real commit (BUILD_LOG); every flare is a real
// innovation_ledger row filed from inside the room. Storm-indigo/cyan,
// matching the iteration-forge planet's existing storm-giant palette. The
// spindle turns continuously — the only world whose signature primitive is
// literal, uninterrupted rotation.

const HEARTH_WARM = "#ffb35c";
const COLD = "#4a7bab";
const STONE_DARK = "#0a1220";

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
      <circleGeometry args={[GROUND_RADIUS, 96]} />
      <meshStandardMaterial color={STONE_DARK} roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

function GrowthRing({ ring, reduced }: { ring: ForgeRing; reduced: boolean }) {
  const band = RING_STEP * 0.35;
  const y = 0.03 + ring.index * 0.012;
  const inner = (
    <mesh rotation-x={-Math.PI / 2} position-y={y}>
      <ringGeometry args={[ring.radius - band, ring.radius + band, 64]} />
      <meshStandardMaterial
        color={ring.color}
        emissive={ring.color}
        emissiveIntensity={0.15 + ring.gleam * 0.85}
        roughness={0.6}
        metalness={0.25}
      />
    </mesh>
  );
  if (ring.gleam <= 0.02) return inner;
  return (
    <Pulse speed={1.2} amp={0.015} reduced={reduced}>
      {inner}
    </Pulse>
  );
}

function Spindle({ rings, heat, reduced }: { rings: ForgeRing[]; heat: number; reduced: boolean }) {
  return (
    <group>
      <Spin speed={0.35} reduced={reduced}>
        <mesh position-y={2.2}>
          <cylinderGeometry args={[1.6, 2, 4.4, 10]} />
          <meshStandardMaterial
            color="#2a2f3a"
            emissive={HEARTH_WARM}
            emissiveIntensity={0.2 + heat * 0.4}
            roughness={0.45}
            metalness={0.4}
          />
        </mesh>
      </Spin>
      {rings.map((r) => (
        <GrowthRing key={r.sha} ring={r} reduced={reduced} />
      ))}
    </group>
  );
}

function ForgeHearth({ heat, reduced }: { heat: number; reduced: boolean }) {
  return (
    <group position={[HEARTH.x, 0, HEARTH.z]}>
      <mesh position-y={0.8}>
        <boxGeometry args={[10, 1.6, 8]} />
        <meshStandardMaterial color="#1a1f2a" roughness={0.85} />
      </mesh>
      <Pulse speed={1.8} amp={0.12 + heat * 0.15} reduced={reduced}>
        <mesh position-y={1.8}>
          <coneGeometry args={[2, 3, 8]} />
          <meshStandardMaterial
            color={HEARTH_WARM}
            emissive={HEARTH_WARM}
            emissiveIntensity={0.3 + heat * 0.9}
            roughness={0.4}
          />
        </mesh>
      </Pulse>
      <Html position={[0, 5.2, 0]} center distanceFactor={55} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-cyan-900/40 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-100">
          the hearth &middot; {(heat * 100).toFixed(0)}% hot
        </div>
      </Html>
    </group>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  SEP: "#f0b429",
  concept: "#22d3ee",
  "tool-request": "#f4f7ff",
};

function LedgerFlare({
  spark,
  showLabel,
  reduced,
}: {
  spark: LatheSnapshot["sparks"][number];
  showLabel: boolean;
  reduced: boolean;
}) {
  const color = CATEGORY_COLOR[spark.category] ?? "#f0b429";
  const mesh = (
    <mesh position={[spark.x, 1.4, spark.z]}>
      <octahedronGeometry args={[0.9, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.3} />
    </mesh>
  );
  return (
    <group>
      <Pulse speed={2} amp={0.12} reduced={reduced}>
        {mesh}
      </Pulse>
      {showLabel && (
        <Html position={[spark.x, 2.6, spark.z]} center distanceFactor={60} occlude={false}>
          <div className="pointer-events-none max-w-[180px] whitespace-normal rounded-md border border-cyan-900/40 bg-black/75 px-2 py-1 text-center font-mono text-[9px] text-cyan-100 shadow-sm">
            <div className="uppercase tracking-[0.1em] text-cyan-300/80">{spark.agent_name}</div>
            <div className="mt-0.5">{spark.title}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function LatheForgeCanvas({ state, reduced }: { state: LatheSnapshot; reduced: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const heat = state.forge_heat;
  const level = state.weather.level;
  const sparkColor = mixHex(COLD, HEARTH_WARM, heat);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [130, 90, 155], fov: 50, near: 0.5, far: 1200 }}
    >
      <color attach="background" args={[STONE_DARK]} />
      <fog attach="fog" args={[STONE_DARK, 160, 560]} />
      <hemisphereLight args={["#10307a", "#04060c", 0.5]} />
      <ambientLight color="#10307a" intensity={0.3} />
      <directionalLight color="#5b93dd" intensity={1 + heat * 0.5} position={[-140, 150, 110]} />
      <pointLight color={HEARTH_WARM} intensity={0.5 + heat * 0.9} position={[HEARTH.x, 6, HEARTH.z]} distance={140} />

      <Stars radius={380} depth={80} count={2400} factor={2.4} fade speed={0.3} />

      <Ground />
      <Spindle rings={state.rings} heat={heat} reduced={reduced} />
      <ForgeHearth heat={heat} reduced={reduced} />

      {state.sparks.map((s, i) => (
        <LedgerFlare key={s.id} spark={s} showLabel={i < 20} reduced={reduced} />
      ))}

      <ScatterField
        kind="crystals"
        count={24}
        area={GROUND_RADIUS - 20}
        minRadius={165}
        color="#7de3f4"
        heightFn={() => 0}
        seed={0x1a7e}
      />

      <Inhabitants world="lathe" reduced={reduced} />

      {level > 0.25 && <StormFlash color="#22d3ee" reduced={reduced} />}

      <GroundMist color="#22d3ee" opacity={0.06 + level * 0.08} area={200} reduced={reduced} />
      <ParticleField mode="sparks" color={sparkColor} area={140} reduced={reduced} />
      <SceneFX bloom={0.45 + heat * 0.2} />

      <CinematicDescent
        from={[320, 230, 360]}
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
        minDistance={24}
        maxDistance={340}
        maxPolarAngle={1.45}
        target={[0, 4, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}
