"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Html } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import {
  GROUND_RADIUS,
  HEARTH,
  MAX_RINGS,
  PIT_DROP,
  PIT_FLOOR,
  RIM_RADIUS,
  RING_BASE_RADIUS,
  RING_STEP,
  terraceElevation,
  terraceHeightAt,
  terraceProfile,
} from "@/lib/lathe/workshop";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import type { LatheSnapshot } from "@/lib/lathe/data";
import type { ForgeRing } from "@/lib/lathe/forge";
import {
  CinematicDescent, CloudBand, GroundMist, GroundSky, ParticleField, Pulse,
  RimMountains, ScatterField, Spin, StormFlash, mixHex,
} from "@/components/v2/latent/ground-fx";
import {
  InstancedBlocks, LightShaft, MoltenSurface, RevolvedTerrain, WorldFX,
  type Block,
} from "@/components/v2/latent/world-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── The Lathe FORGE: a quarry cut into the build history ─────────────────────
//
// Rebuilt 2026-08-09. The compiler contract is unchanged and remains the point:
// every terrace is a real commit from BUILD_LOG, every spark is a real
// innovation_ledger row filed from inside the room, and the spindle turns for
// as long as the site keeps shipping. What changed is the third dimension.
//
// The previous scene drew those same twelve commits as flat rings on a
// 220-radius disc whose tallest object was about five units. Nothing was wrong
// with it; it just had no vertical extent, so it read as a chart of a world
// rather than a world. Now the same twelve radii carry an elevation — oldest
// commit innermost and DEEPEST, the way sediment works — and the world runs
// from a molten pit floor at y=-53 to the spindle's crown at y=+74.
//
// It stays storm-cyan rather than becoming a lava world, on purpose: the
// iteration-forge planet on the universe map is already a storm giant, and a
// surface that contradicts its own planet is exactly the drift class we spent
// 2026-08-09 fixing in UniverseCanvas. The fire is real, but it is at the
// bottom of the pit where a foundry's fire belongs, under a sky that does not
// change.

const HEARTH_WARM = "#ffb35c";
const MOLTEN = "#ff7a2a";
const COLD = "#4a7bab";
const STORM = "#22d3ee";
const STONE_DARK = "#080e18";
const STONE_ROCK = "#2a3444";

const PROFILE = terraceProfile();
const SPINDLE_TOP = 72;

/** Baked contact darkening: the quarry loses light with depth. This is what an
 *  SSAO pass would mostly be doing here, for the price of a vertex attribute
 *  instead of a second full-scene render. */
function quarryShade(y: number): number {
  const depth = Math.min(1, -y / (Math.abs(PIT_FLOOR) + 2));
  return 0.3 + 0.7 * Math.pow(1 - depth, 0.85);
}

// ── The cut face ─────────────────────────────────────────────────────────────

function Quarry() {
  return (
    <RevolvedTerrain
      profile={PROFILE}
      segments={144}
      color={STONE_ROCK}
      shade={quarryShade}
      roughness={0.95}
      metalness={0.06}
    />
  );
}

/** One glowing lip per commit, sitting on its own terrace's inner edge. The
 *  colour is the commit's classification and the gleam is the forge heat —
 *  both unchanged from the flat version, because both were always the honest
 *  part. */
function RingLip({ ring, reduced }: { ring: ForgeRing; reduced: boolean }) {
  const y = terraceElevation(ring.index) + 0.12;
  const lip = (
    <mesh rotation-x={-Math.PI / 2} position-y={y}>
      <torusGeometry args={[ring.radius, 0.34, 6, 88]} />
      <meshStandardMaterial
        color={ring.color}
        emissive={ring.color}
        emissiveIntensity={0.35 + ring.gleam * 1.3}
        roughness={0.45}
        metalness={0.5}
      />
    </mesh>
  );
  if (ring.gleam <= 0.02) return lip;
  return (
    <Pulse speed={1.2} amp={0.02} reduced={reduced}>
      {lip}
    </Pulse>
  );
}

// ── Molten runnels ───────────────────────────────────────────────────────────
// Ribbons that follow the height field from the rim all the way down into the
// pit. They are what makes the canyon legible from a distance: without them the
// terraces read as concentric circles again, just lower down.

function MoltenChannel({ bearing, width = 2.6 }: { bearing: number; width?: number }) {
  const geometry = useMemo(() => {
    const dx = Math.cos(bearing);
    const dz = Math.sin(bearing);
    const px = -dz;
    const pz = dx;
    const steps = 96;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const r = RING_BASE_RADIUS * 0.4 + (i / steps) * (RIM_RADIUS - RING_BASE_RADIUS * 0.4);
      const x = dx * r;
      const z = dz * r;
      const y = terraceHeightAt(x, z) + 0.18;
      // Runnels narrow as they drop, like real spillways.
      const w = width * (0.55 + 0.45 * (r / RIM_RADIUS));
      positions.push(x + px * w, y, z + pz * w);
      positions.push(x - px * w, y, z - pz * w);
      if (i < steps) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [bearing, width]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={MOLTEN}
        emissive={MOLTEN}
        emissiveIntensity={1.15}
        roughness={0.35}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── The spindle ──────────────────────────────────────────────────────────────
// Rises out of the pit floor and clears the rim by seventy units. It is the
// world's silhouette, and it is the only thing here that literally never stops
// turning — the signature primitive the Lathe has always claimed and, on a flat
// disc, never really showed.

function Spindle({ heat, reduced }: { heat: number; reduced: boolean }) {
  const lower = PIT_FLOOR;
  const seg = (a: number, b: number) => ({ h: b - a, y: (a + b) / 2 });
  const s1 = seg(lower, lower + 42);
  const s2 = seg(lower + 42, 30);
  const s3 = seg(30, SPINDLE_TOP);

  const collars = [-22, -2, 22, 46, 64];

  return (
    <group>
      <mesh position-y={s1.y}>
        <cylinderGeometry args={[7.4, 10.5, s1.h, 14]} />
        <meshStandardMaterial color="#232b38" roughness={0.7} metalness={0.45} />
      </mesh>
      <mesh position-y={s2.y}>
        <cylinderGeometry args={[4.6, 7.4, s2.h, 14]} />
        <meshStandardMaterial color="#2a3341" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position-y={s3.y}>
        <cylinderGeometry args={[2.4, 4.6, s3.h, 12]} />
        <meshStandardMaterial color="#323c4c" roughness={0.5} metalness={0.55} />
      </mesh>

      <Spin speed={0.28} reduced={reduced}>
        {collars.map((y, i) => (
          <mesh key={y} position-y={y} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[9.5 - i * 1.15, 0.55, 5, 20]} />
            <meshStandardMaterial
              color="#0f1620"
              emissive={i < 2 ? HEARTH_WARM : STORM}
              emissiveIntensity={0.5 + heat * 0.7}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        ))}
        <mesh position-y={SPINDLE_TOP + 3}>
          <icosahedronGeometry args={[3.4, 0]} />
          <meshStandardMaterial
            color={HEARTH_WARM}
            emissive={HEARTH_WARM}
            emissiveIntensity={0.8 + heat * 1.4}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      </Spin>
    </group>
  );
}

// ── Lightning ────────────────────────────────────────────────────────────────
// A storm world whose storm is only a light flash is a storm world you have to
// be told about. This draws the bolt.

function Lightning({ reduced }: { reduced: boolean }) {
  const [strike, setStrike] = useState(0);
  const timer = useRef({ next: 3.2, life: 0 });
  const line = useRef<Line2>(null);

  const points = useMemo(() => {
    const rand = mulberry32(hashStr(`bolt-${strike}`));
    const bearing = rand() * Math.PI * 2;
    const dist = 130 + rand() * 130;
    const x0 = Math.cos(bearing) * dist;
    const z0 = Math.sin(bearing) * dist;
    const top = 190 + rand() * 60;
    const pts: [number, number, number][] = [[x0, top, z0]];
    let x = x0;
    let z = z0;
    for (let y = top; y > 20; y -= 14 + rand() * 12) {
      x += (rand() - 0.5) * 26;
      z += (rand() - 0.5) * 26;
      pts.push([x, y, z]);
    }
    return pts;
  }, [strike]);

  useFrame((_, dt) => {
    if (reduced) return;
    const t = timer.current;
    t.next -= dt;
    if (t.next <= 0) {
      t.life = 0.22;
      t.next = 4 + Math.random() * 9;
      setStrike((s) => s + 1);
    }
    if (t.life > 0) t.life = Math.max(0, t.life - dt);
    const mat = line.current?.material;
    if (mat) mat.opacity = t.life > 0 ? Math.min(1, t.life * 5) : 0;
  });

  if (reduced) return null;
  return (
    <Line
      ref={line}
      points={points}
      color="#d8f6ff"
      lineWidth={1.8}
      transparent
      opacity={0}
      toneMapped={false}
    />
  );
}

// ── Foundry furniture ────────────────────────────────────────────────────────

function useWorks(heat: number) {
  return useMemo(() => {
    const rand = mulberry32(hashStr("lathe-works-v2"));
    const gantries: Block[] = [];
    const sheds: Block[] = [];

    // Catwalks spanning the canyon at three heights, each one a long thin box
    // rotated onto its own bearing. Three boxes, not three hundred.
    for (let i = 0; i < 3; i++) {
      const y = 8 - i * 19;
      const span = 2 * (RIM_RADIUS - i * 12);
      gantries.push({ p: [0, y, 0], s: [span, 0.9, 3.4], ry: (i * 61 * Math.PI) / 180 });
    }

    // Support legs standing on whatever terrace they land on, plus loading
    // platforms out on the treads.
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const band = Math.floor(rand() * (MAX_RINGS - 2));
      const r = RING_BASE_RADIUS + band * RING_STEP + RING_STEP * (0.15 + rand() * 0.3);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ground = terraceHeightAt(x, z);
      const h = 3 + rand() * 9;
      gantries.push({ p: [x, ground + h / 2, z], s: [1.1, h, 1.1], ry: a });
      if (rand() < 0.42) {
        gantries.push({
          p: [x, ground + h + 0.3, z],
          s: [3.2 + rand() * 3, 0.5, 2.4 + rand() * 2],
          ry: a,
        });
      }
    }

    // The works on the rim plateau: sheds, stacks and stock piles, kept clear of
    // the spark annulus so ledger rows are never buried by scenery.
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2;
      const r = 168 + rand() * 38;
      const w = 5 + rand() * 11;
      const h = 3 + rand() * 14;
      sheds.push({
        p: [Math.cos(a) * r, h / 2, Math.sin(a) * r],
        s: [w, h, w * (0.6 + rand() * 0.7)],
        ry: a + (rand() - 0.5) * 0.8,
      });
    }

    return { gantries, sheds, glow: 0.15 + heat * 0.25 };
  }, [heat]);
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
            toneMapped={false}
          />
        </mesh>
      </Pulse>
      <LightShaft
        position={[0, 16, 0]}
        radius={5.5}
        height={30}
        color={HEARTH_WARM}
        opacity={0.16 + heat * 0.16}
        flicker={0.5}
        reduced={reduced}
      />
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
  const works = useWorks(heat);

  // Lava fills the bowl to a level, so its radius follows from the pit's own
  // geometry rather than being a second number that can drift out of step.
  const lavaY = PIT_FLOOR + 4.2;
  const lavaR = ((lavaY - PIT_FLOOR) / PIT_DROP) * RING_BASE_RADIUS;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [150, 105, 175], fov: 50, near: 0.5, far: 1400 }}
    >
      <color attach="background" args={[STONE_DARK]} />
      <fog attach="fog" args={["#0a1524", 150, 700]} />

      {/* Storm sky. No stars and no galaxy: the cloud deck is closed. */}
      <GroundSky zenith="#03060d" horizon="#0e2c44" glow={STORM} glowStrength={0.34 + level * 0.3} radius={520} />
      <CloudBand color="#12324a" opacity={0.5 + level * 0.22} radius={430} y={118} height={78} reduced={reduced} />
      <CloudBand color="#0b2135" opacity={0.4} radius={330} y={168} height={96} reduced={reduced} />

      <hemisphereLight args={["#17406f", "#1d0c06", 0.55]} />
      <ambientLight color="#123055" intensity={0.26} />
      {/* The one key light: a break in the storm, raking across the terraces. */}
      <directionalLight color="#7fb4e8" intensity={1.15 + heat * 0.35} position={[-180, 210, 140]} />
      {/* Everything else that lights this world comes up out of the ground. */}
      <pointLight color={MOLTEN} intensity={2.2 + heat * 2.4} position={[0, PIT_FLOOR + 12, 0]} distance={190} decay={1.6} />
      <pointLight color={HEARTH_WARM} intensity={0.5 + heat * 0.9} position={[HEARTH.x, 6, HEARTH.z]} distance={140} />

      <Quarry />
      {state.rings.map((r) => (
        <RingLip key={r.sha} ring={r} reduced={reduced} />
      ))}

      {[0, 1, 2, 3, 4].map((i) => (
        <MoltenChannel key={i} bearing={(i * 2 * Math.PI) / 5 + 0.4} />
      ))}

      <MoltenSurface radius={lavaR} y={lavaY} hot={MOLTEN} crust="#1d1117" heat={heat} scale={5} reduced={reduced} />
      {/* The furnace glow leaving the pit — the reason the world reads as deep
          from a camera that cannot see the bottom. */}
      <LightShaft
        position={[0, PIT_FLOOR + 46, 0]}
        radius={17}
        height={92}
        color={MOLTEN}
        opacity={0.15 + heat * 0.14}
        flicker={0.65}
        reduced={reduced}
      />

      <Spindle heat={heat} reduced={reduced} />

      <InstancedBlocks
        blocks={works.gantries}
        color="#39434f"
        emissive={STORM}
        emissiveIntensity={works.glow}
        roughness={0.55}
        metalness={0.65}
      />
      <InstancedBlocks
        blocks={works.sheds}
        color="#1c2431"
        emissive={STORM}
        emissiveIntensity={works.glow * 0.6}
        roughness={0.8}
        metalness={0.25}
      />

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

      <RimMountains inner={238} outer={340} height={82} base={4} color="#0b1a2a" seed={0x1a7e} />

      <Inhabitants world="lathe" reduced={reduced} groundY={terraceHeightAt} />

      <Lightning reduced={reduced} />
      {level > 0.25 && <StormFlash color={STORM} reduced={reduced} />}
      <ParticleField mode="rain" color="#9fd8ee" area={230} reduced={reduced} />
      <ParticleField mode="embers" color={sparkColor} area={90} reduced={reduced} />
      <GroundMist color={STORM} opacity={0.05 + level * 0.07} area={230} reduced={reduced} />

      <WorldFX world="lathe" bloom={0.82 + heat * 0.22} reduced={reduced} />

      <CinematicDescent
        from={[380, 300, 420]}
        target={[0, -2, 0]}
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
        maxDistance={430}
        maxPolarAngle={1.48}
        target={[0, -2, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}
