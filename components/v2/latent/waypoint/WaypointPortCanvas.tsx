"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { CONCOURSE, CONTROL_TOWER, FRAME } from "@/lib/waypoint/cityplan";
import type { WaypointSnapshot } from "@/lib/waypoint/data";
import type { GateStructure } from "@/lib/waypoint/cityplan";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import {
  CinematicDescent, CloudBand, GroundSky, NexusStar, ParticleField, Pulse, Spin, mixHex,
} from "@/components/v2/latent/ground-fx";
import {
  InstancedBlocks, LightShaft, TrafficStream, WorldFX, type Block,
} from "@/components/v2/latent/world-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── Waypoint PORT: a platform in the cloud sea ───────────────────────────────
//
// Rebuilt 2026-08-09. The gate data, the fixed strip geography and every colour
// are untouched: seven berths in a fixed order, each lit by its own source
// world's real activity, exactly as lib/waypoint/cityplan.ts has always
// compiled them.
//
// What changed is that there is no longer any ground. The old scene put the
// concourse on a 348x90 tarmac plane, which made the portfolio's designated
// crossroads read as another dark field with lights on it — the fourth such
// world out of eight. Now the deck is a structure floating in an amber cloud
// sea with nothing under it, cloud layers running away below and a low sun on
// the horizon. That single decision does more for the portfolio's variety than
// any amount of detail on the tarmac would have: it is the one world you can
// identify from its silhouette alone.
//
// The deck keeps the tarmac's exact footprint (348 x 90, |z| <= 45) because
// tests/api/inhabitants-placement.test.ts pins the port crew to it. A narrower
// deck would walk them off the edge and into the clouds.

const SCALE = 0.45;
const DECK_W = FRAME.w * SCALE + 60;
const DECK_D = 90;
const BRANCH_DEPTH = 15;

const DECK_METAL = "#2b2f3d";
const AMBER = "#ffb968";
const DEEP_SKY = "#3a1d4a";

function worldX(x: number): number {
  return (x - (CONCOURSE.x1 + CONCOURSE.x2) / 2) * SCALE;
}

const GATE_COLOR: Record<GateStructure["id"], string> = {
  frontier: "#f472b6",
  deep: "#7dd3fc",
  bazaar: "#fbbf24",
  archive: "#c4b5fd",
  vault: "#fff4dc",
  pit: "#ff6a33",
  forge: "#7de3f4",
};

function statusIntensity(status: GateStructure["status"]): number {
  if (status === "lit") return 1;
  if (status === "boarding") return 0.45;
  return 0.12;
}

// ── The deck ─────────────────────────────────────────────────────────────────

function Deck() {
  const understructure = useMemo<Block[]>(() => {
    const rand = mulberry32(hashStr("waypoint-underdeck"));
    const blocks: Block[] = [];
    // Cross trusses under the deck. Seen from below and from any low camera
    // angle, these are what stop the platform reading as a floating slab.
    for (let i = 0; i < 22; i++) {
      const x = -DECK_W / 2 + 8 + (i / 21) * (DECK_W - 16);
      blocks.push({ p: [x, -5.5, 0], s: [2.2, 7, DECK_D * 0.86] });
    }
    // Mooring pylons hanging down into the cloud, uneven so the platform reads
    // as built rather than extruded.
    for (let i = 0; i < 9; i++) {
      const x = -DECK_W / 2 + 20 + (i / 8) * (DECK_W - 40);
      const len = 26 + rand() * 54;
      blocks.push({ p: [x, -9 - len / 2, (rand() - 0.5) * 40], s: [3.4, len, 3.4] });
    }
    return blocks;
  }, []);

  return (
    <group>
      {/* Main deck plate. */}
      <mesh position-y={-1.2}>
        <boxGeometry args={[DECK_W, 2.4, DECK_D]} />
        <meshStandardMaterial color={DECK_METAL} roughness={0.62} metalness={0.55} />
      </mesh>
      {/* Lit edge trim along both long sides — the deck's outline against the
          clouds is the whole silhouette, so it gets its own light. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.15, (s * DECK_D) / 2 - s * 0.9]}>
          <boxGeometry args={[DECK_W, 0.5, 1.8]} />
          <meshStandardMaterial
            color="#1a1e28"
            emissive={AMBER}
            emissiveIntensity={1.2}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* The Concourse itself: the spine every gate branches off. */}
      <mesh position-y={0.16}>
        <boxGeometry args={[(CONCOURSE.x2 - CONCOURSE.x1) * SCALE, 0.32, 7]} />
        <meshStandardMaterial color="#1c2230" emissive="#ffdf9e" emissiveIntensity={0.45} roughness={0.5} />
      </mesh>
      <InstancedBlocks blocks={understructure} color="#181c26" roughness={0.75} metalness={0.5} />
    </group>
  );
}

function ControlTower({ traffic, reduced }: { traffic: number; reduced: boolean }) {
  const x = worldX(CONTROL_TOWER.x);
  return (
    <group position={[x, 0, 0]}>
      <mesh position-y={16}>
        <cylinderGeometry args={[2.2, 4.4, 32, 10]} />
        <meshStandardMaterial color="#242a3a" emissive={AMBER} emissiveIntensity={0.28} roughness={0.5} metalness={0.45} />
      </mesh>
      {/* Control cab. */}
      <mesh position-y={34}>
        <cylinderGeometry args={[6.2, 4.6, 5.4, 10]} />
        <meshStandardMaterial color="#2f3648" emissive="#ffe6b8" emissiveIntensity={0.55} roughness={0.35} metalness={0.5} />
      </mesh>
      <NexusStar position={[0, 40, 0]} radius={2.2} reduced={reduced} />
      {/* Rotating beacon — the port sweeping the approach. */}
      <Spin speed={0.5} reduced={reduced}>
        <group position-y={34} rotation-z={Math.PI / 2}>
          <LightShaft
            position={[0, 46, 0]}
            radius={7}
            height={92}
            color="#ffe0a8"
            opacity={0.14 + traffic * 0.12}
            reduced={reduced}
          />
        </group>
      </Spin>
      <Html position={[0, 45, 0]} center distanceFactor={65} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-amber-900/40 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-100">
          Control Tower
        </div>
      </Html>
    </group>
  );
}

// ── A berth ──────────────────────────────────────────────────────────────────
// Cantilevered off the Concourse and out over open cloud, with a docking ring
// and — only when the source world is actually lit — a departure beam.

function Gate({ gate, showLabel, reduced }: { gate: GateStructure; showLabel: boolean; reduced: boolean }) {
  const color = GATE_COLOR[gate.id];
  const intensity = statusIntensity(gate.status);
  const zSign = gate.side === "north" ? -1 : 1;
  const x = worldX(gate.x);
  const z = zSign * BRANCH_DEPTH;
  const pad = zSign * (BRANCH_DEPTH + 16);

  return (
    <group>
      {/* Jetway out to the pad. */}
      <mesh position={[x, 0.4, z * 0.6]}>
        <boxGeometry args={[3.6, 0.8, Math.abs(pad) * 1.1]} />
        <meshStandardMaterial color="#232936" emissive={color} emissiveIntensity={0.12 + intensity * 0.3} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Docking pad, hanging past the deck edge over nothing. */}
      <mesh position={[x, 0, pad]}>
        <cylinderGeometry args={[10, 11.5, 1.6, 12]} />
        <meshStandardMaterial color="#20263a" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Docking ring: the gate's real status, in its source world's colour. */}
      <Pulse speed={1.4} amp={intensity > 0.3 ? 0.05 : 0} reduced={reduced}>
        <mesh position={[x, 1.1, pad]} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[8.4, 0.42, 6, 40]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.25 + intensity * 1.3}
            roughness={0.4}
            metalness={0.4}
            toneMapped={false}
          />
        </mesh>
      </Pulse>
      {gate.status === "lit" && (
        <LightShaft
          position={[x, 46, pad]}
          radius={8}
          height={90}
          color={color}
          opacity={0.18}
          reduced={reduced}
        />
      )}
      {showLabel && (
        <Html position={[x, 7.5, pad]} center distanceFactor={58} occlude={false}>
          <div className="pointer-events-none max-w-[190px] whitespace-normal rounded-md border border-white/10 bg-black/75 px-2 py-1 text-center font-mono text-[9px] shadow-sm" style={{ color }}>
            <div className="uppercase tracking-[0.1em] opacity-80">{gate.name}</div>
            <div className="mt-0.5 text-white/90">{gate.headline}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Approach lanes ───────────────────────────────────────────────────────────
// Two arcs sweeping in over the cloud sea and away again. Craft count follows
// real cross-world traffic, so a quiet week genuinely empties the sky.

function useLanes() {
  return useMemo(() => {
    const arc = (
      y: number,
      radius: number,
      lift: number,
      dir: 1 | -1
    ): THREE.CatmullRomCurve3 => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2 * dir;
        pts.push(
          new THREE.Vector3(
            Math.cos(a) * radius,
            y + Math.sin(a * 2) * lift,
            Math.sin(a) * radius * 0.55
          )
        );
      }
      return new THREE.CatmullRomCurve3(pts, true, "centripetal");
    };
    return {
      high: arc(58, 250, 16, 1),
      low: arc(22, 155, 8, -1),
    };
  }, []);
}

export default function WaypointPortCanvas({ state, reduced }: { state: WaypointSnapshot; reduced: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const traffic = state.traffic.level;
  const ambient = mixHex("#c9a6ff", "#ffdf9e", state.arrivals_level);
  const lanes = useLanes();

  // Real signal, not decoration: an idle crossroads has an empty sky.
  const highCraft = Math.round(4 + traffic * 22);
  const lowCraft = Math.round(2 + state.arrivals_level * 14);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [40, 70, 190], fov: 50, near: 0.5, far: 1600 }}
    >
      <color attach="background" args={["#2a1830"]} />
      {/* Warm haze rather than darkness: distance here should read as depth of
          atmosphere, not as an unlit void. */}
      <fog attach="fog" args={["#8a5a52", 210, 900]} />

      <GroundSky zenith={DEEP_SKY} horizon="#ff9a5c" glow="#ffd8a0" glowStrength={0.55} radius={620} />
      {/* The sun, low and enormous, sitting in the haze. */}
      <NexusStar position={[-330, 34, -430]} color="#fff0d4" halo="#ffc178" tint="#ff7a4d" radius={26} reduced={reduced} />

      {/* The cloud sea: decks of it above, level with, and far below the port,
          each turning at its own rate. There is no floor under any of them. */}
      <CloudBand color="#ffc98d" opacity={0.5} radius={330} y={92} height={70} reduced={reduced} />
      <CloudBand color="#f7a978" opacity={0.42} radius={430} y={-30} height={90} reduced={reduced} />
      <CloudBand color="#c9755f" opacity={0.46} radius={560} y={-130} height={150} reduced={reduced} />
      <CloudBand color="#8a4a48" opacity={0.5} radius={700} y={-300} height={260} reduced={reduced} />

      <hemisphereLight args={["#ffd7a8", "#6b3b3a", 0.85]} />
      <ambientLight color="#ffcfa0" intensity={0.35} />
      {/* One key light, raking in from the sun's bearing. */}
      <directionalLight color="#ffd9ac" intensity={1.35 + traffic * 0.3} position={[-260, 90, -300]} />
      <pointLight color={AMBER} intensity={0.7} position={[0, 12, 0]} distance={220} />

      <Deck />
      <ControlTower traffic={traffic} reduced={reduced} />

      {state.city.gates.map((g, i) => (
        <Gate key={g.id} gate={g} showLabel={i < 7} reduced={reduced} />
      ))}

      <TrafficStream
        curve={lanes.high}
        count={highCraft}
        size={3.2}
        color="#3b2a30"
        glow="#ffd9a0"
        speed={0.028}
        reduced={reduced}
      />
      <TrafficStream
        curve={lanes.low}
        count={lowCraft}
        size={2.4}
        color="#2c2430"
        glow={ambient}
        speed={0.045}
        reduced={reduced}
      />

      <Inhabitants world="waypoint" reduced={reduced} />

      <ParticleField mode="motes" color={ambient} area={200} reduced={reduced} />

      <WorldFX world="waypoint" bloom={0.6 + traffic * 0.25} reduced={reduced} />

      <CinematicDescent
        from={[280, 260, 420]}
        target={[0, 6, 0]}
        duration={4}
        reduced={reduced}
        onDone={() => setIntroDone(true)}
      />
      <OrbitControls
        enabled={introDone}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={40}
        maxDistance={470}
        // Deliberately past the horizontal. Every other world stops at ~1.45
        // because there is ground below and nothing to see. Here you can drop
        // under the deck and look up at the platform against open sky, which is
        // the single best view in the portfolio and costs one number.
        maxPolarAngle={2.35}
        target={[0, 6, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.12}
      />
    </Canvas>
  );
}
