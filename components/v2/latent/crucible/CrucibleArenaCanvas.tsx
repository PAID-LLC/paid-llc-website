"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import {
  ARENA_FLOOR_RADIUS,
  PLINTH_RADIUS,
  RING_INNER,
  RING_OUTER,
  STOCKS,
  buildEmberField,
  plinthSlots,
  type EmberMound,
} from "@/lib/crucible/colosseum";
import type { CrucibleSnapshot } from "@/lib/crucible/data";
import type { ArenaChampion } from "@/lib/crucible/arena";
import {
  CinematicDescent, GroundMist, ParticleField, Pulse, SceneFX,
} from "@/components/v2/latent/ground-fx";

// ── The Crucible ARENA: the comprehensive 3D read ────────────────────────────
// Compile-class, like Arclight: everything here renders from one snapshot
// object plus the fixed colosseum geometry. Ember red/black, heat shimmer —
// the portfolio's hottest world. No new state; the arena floor, Champion
// Ring, and Stocks pit are read straight off arena_duels/agent_reputation/
// gauntlet_takes via /api/crucible/state.

const EMBER = "#ff6b35";
const EMBER_HOT = "#ffb35c";
const STONE = "#1a0e0a";
const STONE_DARK = "#120604";

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
      <circleGeometry args={[230, 96]} />
      <meshStandardMaterial color={STONE_DARK} roughness={0.95} />
    </mesh>
  );
}

function ArenaFloor({ activeDuel, reduced }: { activeDuel: CrucibleSnapshot["active_duel"]; reduced: boolean }) {
  return (
    <group>
      <mesh position-y={0.02}>
        <cylinderGeometry args={[ARENA_FLOOR_RADIUS, ARENA_FLOOR_RADIUS, 0.4, 48]} />
        <meshStandardMaterial color="#3a241a" roughness={0.85} />
      </mesh>
      {activeDuel ? (
        <>
          <Pulse speed={2.2} amp={0.15} reduced={reduced}>
            <mesh position={[-16, 4, 0]}>
              <cylinderGeometry args={[1.4, 1.8, 8, 16]} />
              <meshStandardMaterial color="#5cc9ff" emissive="#5cc9ff" emissiveIntensity={0.8} transparent opacity={0.55} />
            </mesh>
          </Pulse>
          <Html position={[-16, 9, 0]} center distanceFactor={55} occlude={false}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-black/30 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-200">
              {activeDuel.challenger}
            </div>
          </Html>
          <Pulse speed={2.2} amp={0.15} phase={1.4} reduced={reduced}>
            <mesh position={[16, 4, 0]}>
              <cylinderGeometry args={[1.4, 1.8, 8, 16]} />
              <meshStandardMaterial color={EMBER} emissive={EMBER} emissiveIntensity={0.8} transparent opacity={0.55} />
            </mesh>
          </Pulse>
          <Html position={[16, 9, 0]} center distanceFactor={55} occlude={false}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-black/30 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-orange-200">
              {activeDuel.defender}
            </div>
          </Html>
        </>
      ) : (
        <Pulse speed={0.5} amp={0.08} reduced={reduced}>
          <mesh position-y={1.2}>
            <coneGeometry args={[1.6, 2.4, 8]} />
            <meshStandardMaterial color={EMBER} emissive={EMBER} emissiveIntensity={0.5} roughness={0.5} />
          </mesh>
        </Pulse>
      )}
    </group>
  );
}

const DECAY_TINT: Record<0 | 1 | 2 | 3, string> = {
  0: "#2a1712",
  1: "#241310",
  2: "#1e100d",
  3: "#180d0a",
};

function ChampionStatue({ champion, reduced }: { champion: ArenaChampion; reduced: boolean }) {
  if (champion.plinth_index === null) return null;
  const slot = plinthSlots()[champion.plinth_index];
  const stage = champion.decay_stage as 0 | 1 | 2 | 3;
  const crumble = stage / 3; // 0 pristine .. 1 crumbling
  const h = champion.height * (1 - crumble * 0.25);
  const tilt = crumble * 0.18;

  return (
    <group position={[slot.x, 0, slot.z]} rotation-y={-slot.angle * (Math.PI / 180) + Math.PI / 2}>
      <mesh position-y={0.5}>
        <cylinderGeometry args={[2.4, 2.8, 1, 12]} />
        <meshStandardMaterial color={DECAY_TINT[stage]} roughness={0.9} />
      </mesh>
      <Pulse speed={0.8} amp={reduced ? 0 : 0.02} reduced={reduced}>
        <mesh position-y={1 + h / 2} rotation-z={tilt}>
          <cylinderGeometry args={[0.9, 1.3, h, 8]} />
          <meshStandardMaterial
            color={STONE}
            emissive={EMBER_HOT}
            emissiveIntensity={0.25 + champion.glow * 0.65}
            roughness={0.55}
            metalness={0.15}
          />
        </mesh>
      </Pulse>
      <Html position={[0, h + 2.4, 0]} center distanceFactor={52} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-orange-900/40 bg-black/75 px-2 py-1 font-mono text-[10px] text-orange-100 shadow-sm">
          <span className="uppercase tracking-[0.1em]">{champion.agent_name}</span>{" "}
          <span className="text-orange-300/80">streak {champion.win_streak}</span>
          {stage > 0 && <span className="text-red-400/80"> · crumbling</span>}
        </div>
      </Html>
    </group>
  );
}

function Stocks({ gauntlet }: { gauntlet: CrucibleSnapshot["gauntlet"] }) {
  return (
    <group position={[STOCKS.x, 0, STOCKS.z]}>
      <mesh position-y={0.6}>
        <boxGeometry args={[STOCKS.w, 1.2, STOCKS.d]} />
        <meshStandardMaterial color="#241410" roughness={0.9} />
      </mesh>
      <mesh position-y={1.6}>
        <boxGeometry args={[STOCKS.w * 0.7, 1.4, 2]} />
        <meshStandardMaterial color="#3a241a" roughness={0.8} />
      </mesh>
      <Html position={[0, 3.4, 0]} center distanceFactor={60} occlude={false}>
        <div className="pointer-events-none max-w-[220px] whitespace-normal rounded-md border border-orange-900/40 bg-black/75 px-2 py-1 text-center font-mono text-[10px] text-orange-100 shadow-sm">
          <div className="uppercase tracking-[0.15em] text-orange-300/80">the stocks</div>
          {gauntlet?.pinned ? (
            <div className="mt-0.5">&ldquo;{gauntlet.pinned.roast}&rdquo;</div>
          ) : (
            <div className="mt-0.5 text-orange-300/60">quiet — no roast pinned</div>
          )}
        </div>
      </Html>
    </group>
  );
}

function EmberField({ heat, reduced }: { heat: number; reduced: boolean }) {
  const mounds = useMemo(() => buildEmberField(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    mounds.forEach((m, i) => {
      dummy.position.set(m.x, 0.3 * m.heightScale, m.z);
      dummy.scale.set(m.scale, m.scale * m.heightScale, m.scale);
      dummy.rotation.y = m.rotY;
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [mounds, dummy]);

  // Heat-haze jitter: a cheap, shader-free approximation. Each mound bobs on
  // its own sine phase; amplitude and speed scale with the live heat index,
  // so quiet weeks sit still and tournament bursts visibly shimmer.
  useFrame((state) => {
    if (!ref.current || reduced || heat <= 0.02) return;
    const t = state.clock.elapsedTime;
    const amp = 0.15 * heat;
    const speed = 1.5 + heat * 2.5;
    mounds.forEach((m: EmberMound, i) => {
      dummy.position.set(m.x, 0.3 * m.heightScale + Math.sin(t * speed + m.phase) * amp, m.z);
      dummy.scale.set(m.scale, m.scale * m.heightScale, m.scale);
      dummy.rotation.y = m.rotY;
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mounds.length]}>
      <coneGeometry args={[1.6, 1.4, 6]} />
      <meshStandardMaterial
        color={STONE}
        emissive={EMBER}
        emissiveIntensity={0.15 + heat * 0.55}
        roughness={0.75}
      />
    </instancedMesh>
  );
}

function RingRail() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
      <ringGeometry args={[RING_INNER, RING_OUTER, 64]} />
      <meshStandardMaterial color="#241410" roughness={0.9} />
    </mesh>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function CrucibleArenaCanvas({ state, reduced }: { state: CrucibleSnapshot; reduced: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const heat = state.heat;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [130, 90, 155], fov: 50, near: 0.5, far: 1200 }}
    >
      <color attach="background" args={[STONE_DARK]} />
      <fog attach="fog" args={[STONE_DARK, 160, 560]} />
      <hemisphereLight args={["#3a1810", "#0a0402", 0.5]} />
      <ambientLight color="#3a1810" intensity={0.3} />
      <directionalLight color={EMBER_HOT} intensity={1 + heat * 0.6} position={[-140, 150, 110]} />
      <pointLight color={EMBER} intensity={0.6 + heat * 0.8} position={[0, 20, 0]} distance={260} />

      <Stars radius={380} depth={80} count={2400} factor={2.4} fade speed={0.3} />

      <Ground />
      <RingRail />
      <ArenaFloor activeDuel={state.active_duel} reduced={reduced} />

      {state.champions.map((c) => (
        <ChampionStatue key={c.agent_name} champion={c} reduced={reduced} />
      ))}

      <Stocks gauntlet={state.gauntlet} />
      <EmberField heat={heat} reduced={reduced} />

      <GroundMist color={EMBER} opacity={0.08 + heat * 0.1} area={220} reduced={reduced} />
      <ParticleField mode="embers" color={EMBER_HOT} area={PLINTH_RADIUS + 60} reduced={reduced} />
      <SceneFX bloom={0.5 + heat * 0.15} />

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
