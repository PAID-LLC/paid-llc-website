"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  GROUND_RADIUS,
  PIT_FLOOR,
  RIM_RADIUS,
  TIERS,
  lavaLevel,
  lavaRadius,
  pitHeightAt,
  pitProfile,
  rimPlant,
  tierElevation,
  treadRadius,
  type PlantPiece,
} from "@/lib/pit/geometry";
import { buildPitCrowd } from "@/lib/pit/crowd";
import type { CrucibleSnapshot } from "@/lib/crucible/data";
import {
  CinematicDescent, CloudBand, GroundMist, GroundSky, ParticleField, Pulse,
  RimMountains, StormFlash,
} from "@/components/v2/latent/ground-fx";
import {
  CrowdFigures, LightShaft, MoltenSurface, RevolvedTerrain, SkyEnvironment, WorldFX,
} from "@/components/v2/latent/world-kit";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── The Crucible: the Roast Pit ──────────────────────────────────────────────
//
// Room 1's world. Rebuilt 2026-08-10 onto the tiered-bowl kit that was first
// built for the Lathe, because Travis looked at that bowl and said the obvious
// thing: it is a pit with a fire at the bottom and tiers looking down into it,
// and that is a roast pit, not a lathe. The two worlds traded geometry. Each
// kept its own name, room, URL and — the part that matters — its own data.
//
// What the bowl means here is deliberately much less than it meant on the
// Lathe. There, every terrace was a real commit. Here the tiers are TIERS: a
// place to stand and watch, fixed forever, claiming nothing at all. That is a
// downgrade in ambition and an upgrade in honesty — an arena has no business
// pretending its seating is a dataset.
//
// What IS real, and where it comes from:
//
//   the melt level      arena heat index, from real duel cadence (lib/crucible/arena.ts)
//   ramp traffic        the same heat — how busy the house is today
//   the crowd           one body per agent holding a real competitive record
//   the two on the span the live bout, when there is one
//   champion marks      real Elo and win streaks, decaying on the existing contract
//
// The melt never drains. Heat decays continuously from the last bout, so an
// empty pit is reachable by nobody doing anything wrong, and an empty pit reads
// as broken rather than as quiet. It drops and crusts instead.

const EMBER = "#ff6b35";
const EMBER_HOT = "#ffb35c";
const ASH = "#c9bdb0";
const SOOT = "#0d0906";

const PROFILE = pitProfile();

/** The span the bout is fought on: a platform over the melt, high enough that a
 *  full pit still laps below it. Everything about this world points at it. */
export const SPAN_Y = tierElevation(4) + 1.5;
const SPAN_RADIUS = 20;

/** Baked contact darkening — an SSAO pass's job, for the price of a vertex
 *  attribute instead of a second full-scene render. */
function bowlShade(y: number): number {
  const depth = Math.min(1, -y / (Math.abs(PIT_FLOOR) + 2));
  return 0.34 + 0.66 * Math.pow(1 - depth, 0.8);
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

const BASALT: SurfaceSpec = {
  stain: "#4d4a58",
  panelsX: 3,
  panelsY: 6,
  seam: 0.44,
  wear: 0.74,
  wet: 0.04,
  rough: 0.96,
  relief: 1.3,
};

/** The rim plant. Lit glass, because a pit ringed by dark cylinders reads as
 *  abandoned however hot the fire in it is. */
const FIREBRICK: SurfaceSpec = {
  stain: "#7a3a1e",
  panelsX: 4,
  panelsY: 5,
  seam: 0.52,
  wear: 0.8,
  wet: 0.04,
  rough: 0.9,
  relief: 1,
  windows: { cols: 7, rows: 9, lit: 0.34, warm: "#ffb257", cool: "#ffd9a8" },
};

const PLATE: SurfaceSpec = {
  stain: "#8a4520",
  panelsX: 6,
  panelsY: 6,
  seam: 0.62,
  wear: 0.7,
  wet: 0.06,
  rough: 0.6,
  relief: 0.85,
};

interface PitSurfaces {
  rock: THREE.MeshStandardMaterial;
  plant: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
}

const SurfaceContext = createContext<PitSurfaces | null>(null);

const PLANT_GLOW_BASE = 1.15;
const PLANT_GLOW_HEAT = 0.45;

function usePitSurfaces(reduced: boolean, heat: number): PitSurfaces {
  // `heat` is deliberately NOT a dependency here. It moves on every poll, and
  // rebuilding a material swaps it underneath the instanced meshes, which
  // reconstructs them with an all-zero matrix buffer — every instance collapses
  // to scale 0 and the whole rim silently disappears one poll after it drew.
  // A live number nudges a property in place. It does not rebuild a material.
  const materials = useMemo<PitSurfaces>(() => {
    const basalt = surface("pit-basalt", BASALT);
    const brick = surface("pit-firebrick", FIREBRICK);
    const plate = surface("pit-plate", PLATE);

    const rock = triplanarMaterial({
      surface: basalt,
      color: "#ffffff",
      scale: 40,
      metalness: 0.04,
      normalScale: 1.1,
      vertexColors: true,
      reduced,
    });
    // The bowl is a revolution: from inside it the camera sees the back faces.
    rock.side = THREE.DoubleSide;

    return {
      rock,
      plant: triplanarMaterial({
        surface: brick,
        color: "#6b4a36",
        scale: 18,
        metalness: 0.08,
        normalScale: 0.9,
        emissiveIntensity: PLANT_GLOW_BASE,
        reduced,
      }),
      plate: triplanarMaterial({
        surface: plate,
        color: "#5b5f6c",
        scale: 7,
        metalness: 0.62,
        roughness: 0.58,
        normalScale: 1,
        reduced,
      }),
    };
  }, [reduced]);

  useEffect(() => {
    materials.plant.emissiveIntensity = PLANT_GLOW_BASE + heat * PLANT_GLOW_HEAT;
  }, [materials, heat]);

  useEffect(
    () => () => {
      for (const m of Object.values(materials)) m.dispose();
    },
    [materials]
  );

  return materials;
}

function useSurfaces(): PitSurfaces {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error("Crucible surfaces used outside the provider");
  return ctx;
}

// ── Instanced placement ──────────────────────────────────────────────────────

interface Placed {
  p: [number, number, number];
  s: [number, number, number];
  ry: number;
}

function InstancedPieces({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: readonly Placed[];
}) {
  const write = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const axis = new THREE.Vector3(0, 1, 0);
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      items.forEach((b, i) => {
        pos.set(b.p[0], b.p[1], b.p[2]);
        scl.set(b.s[0], b.s[1], b.s[2]);
        q.setFromAxisAngle(axis, b.ry);
        mesh.setMatrixAt(i, m.compose(pos, q, scl));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
    [items]
  );

  if (items.length === 0) return null;
  // `material` is a PROP, never a constructor arg — see the note in
  // usePitSurfaces. And the matrices are written from a REF CALLBACK, so they
  // are refilled whenever React hands back a different mesh.
  return (
    <instancedMesh ref={write} args={[geometry, undefined, items.length]} material={material} />
  );
}

function usePitGeometry() {
  const kit = useMemo(() => {
    // A torus is born standing in the XY plane, and InstancedPieces only applies
    // yaw — without this the flue caps rear off the stacks as vertical hoops.
    const cap = new THREE.TorusGeometry(0.5, 0.12, 5, 12);
    cap.rotateX(-Math.PI / 2);
    return {
      round: new THREE.CylinderGeometry(0.5, 0.55, 1, 10),
      rail: new THREE.BoxGeometry(1, 1, 1),
      cap,
    };
  }, []);
  useEffect(
    () => () => {
      kit.round.dispose();
      kit.rail.dispose();
      kit.cap.dispose();
    },
    [kit]
  );
  return kit;
}

// ── The bowl ─────────────────────────────────────────────────────────────────

function Bowl() {
  const surfaces = useSurfaces();
  return (
    <RevolvedTerrain profile={PROFILE} segments={160} color="#5a5866" shade={bowlShade} material={surfaces.rock} />
  );
}

/**
 * A rail along the lip of each tier.
 *
 * These are the only concentric rings in this world and it matters what they
 * are NOT: on the Lathe the equivalent rings were twelve real commits, each
 * coloured by its classification. Here they are handrails. There is no data
 * behind them and none is implied — an arena's seating is not a dataset, and
 * dressing it as one would be the cheapest possible lie on this platform.
 */
function TierRails() {
  return (
    <group>
      {Array.from({ length: TIERS - 1 }, (_, band) => (
        <mesh key={band} rotation-x={-Math.PI / 2} position-y={tierElevation(band) + 1.05}>
          <torusGeometry args={[treadRadius(band) + 2.1, 0.16, 5, 72]} />
          <meshStandardMaterial color="#2a211c" roughness={0.7} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ── The span ─────────────────────────────────────────────────────────────────

/** The fighting platform, over the melt. Reached by the ramp, lit from beneath
 *  by whatever the pit is doing. */
function DuelSpan({ heat, reduced }: { heat: number; reduced: boolean }) {
  const surfaces = useSurfaces();
  return (
    <group position-y={SPAN_Y}>
      <mesh material={surfaces.plate}>
        <cylinderGeometry args={[SPAN_RADIUS, SPAN_RADIUS, 1.1, 40]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.75}>
        <torusGeometry args={[SPAN_RADIUS - 0.6, 0.22, 6, 56]} />
        <meshStandardMaterial
          color="#1a0f0a"
          emissive={EMBER}
          emissiveIntensity={0.5 + heat * 1.2}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      <LightShaft
        position={[0, 26, 0]}
        radius={SPAN_RADIUS * 0.9}
        height={52}
        color={EMBER_HOT}
        opacity={0.1 + heat * 0.14}
        flicker={0.5}
        reduced={reduced}
      />
    </group>
  );
}

/**
 * The two fighting, when two are fighting.
 *
 * Named, because `arena_duels` names them — this is the one place in the world
 * where putting a name on a body is supported by the row it came from. When no
 * bout is live the span stands empty, which is the truth.
 */
function Duellists({ duel, reduced }: { duel: CrucibleSnapshot["active_duel"]; reduced: boolean }) {
  if (!duel) return null;
  const gap = 7;
  const sides: { name: string; x: number; face: number }[] = [
    { name: duel.challenger, x: -gap, face: Math.PI / 2 },
    { name: duel.defender, x: gap, face: -Math.PI / 2 },
  ];
  return (
    <group position-y={SPAN_Y + 0.55}>
      {sides.map(({ name, x, face }) => (
        <group key={name} position={[x, 0, 0]} rotation-y={face}>
          <Pulse speed={1.6} amp={0.05} reduced={reduced}>
            <mesh position-y={2.4}>
              <capsuleGeometry args={[0.9, 2.6, 4, 8]} />
              <meshStandardMaterial
                color="#3a2a22"
                emissive={EMBER_HOT}
                emissiveIntensity={0.55}
                roughness={0.6}
              />
            </mesh>
          </Pulse>
          <mesh position-y={0.06} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.4, 2.1, 24]} />
            <meshBasicMaterial color={EMBER} transparent opacity={0.5} toneMapped={false} />
          </mesh>
          <Html position={[0, 5.4, 0]} center distanceFactor={70} occlude={false}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-orange-900/50 bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-orange-100">
              {name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ── Champion marks ───────────────────────────────────────────────────────────

/** One mark per real champion, standing on the tiers. Height is the win streak
 *  and glow is the Elo, both straight off `agent_reputation` — the existing
 *  decay-and-vanish contract is untouched, it has just moved onto a bowl. */
function ChampionMarks({ champions }: { champions: CrucibleSnapshot["champions"] }) {
  const surfaces = useSurfaces();
  const geo = usePitGeometry();
  const items = useMemo<Placed[]>(
    () =>
      champions.map((c, i) => {
        const band = 6 + (i % 4);
        const a = (i / Math.max(1, champions.length)) * Math.PI * 2;
        const r = treadRadius(band);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = 3 + (c.height ?? 3);
        return { p: [x, pitHeightAt(x, z) + h / 2, z], s: [1.6, h, 1.6], ry: a };
      }),
    [champions]
  );
  return <InstancedPieces geometry={geo.rail} material={surfaces.plate} items={items} />;
}

/**
 * The house exhibition, kept visually separate from the real record.
 *
 * These are not champions and must never read as champions. The contract
 * predates this world's rebuild and survives it unchanged: a cooler material, a
 * cyan rim, an explicit label, a tier of their own, and no place in the champion
 * count. A house entrant displacing a real competitive record would be the
 * single most damaging thing this arena could do to its own numbers.
 */
const HOUSE_ACCENT = "#5cc9ff";

function HouseMarks({ statues }: { statues: CrucibleSnapshot["house_statues"] }) {
  const items = useMemo(
    () =>
      statues.map((s, i) => {
        // A tier of their own, inside the champions' band, so the two
        // populations never interleave on the same ring.
        const a = (i / Math.max(1, statues.length)) * Math.PI * 2 + 0.4;
        const r = treadRadius(4);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        return { key: s.agent_name, x, z, y: pitHeightAt(x, z), h: 2 + s.height * 0.7, glow: s.glow };
      }),
    [statues]
  );

  if (items.length === 0) return null;
  return (
    <group>
      {items.map((m) => (
        <group key={m.key} position={[m.x, m.y, m.z]}>
          <mesh position-y={m.h / 2}>
            <cylinderGeometry args={[0.8, 1, m.h, 6]} />
            <meshStandardMaterial
              color="#1b2a33"
              emissive={HOUSE_ACCENT}
              emissiveIntensity={0.16 + m.glow * 0.3}
              roughness={0.75}
              metalness={0.2}
              transparent
              opacity={0.72}
            />
          </mesh>
          <mesh position-y={0.05} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.2, 1.7, 20]} />
            <meshBasicMaterial color={HOUSE_ACCENT} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Html position={[0, tierElevation(4) + 9, treadRadius(4)]} center distanceFactor={90} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-sky-500/40 bg-black/80 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-sky-200">
          house exhibition · not ranked
        </div>
      </Html>
    </group>
  );
}

// ── The rim plant ────────────────────────────────────────────────────────────

function RimPlant({ heat }: { heat: number }) {
  const surfaces = useSurfaces();
  const geo = usePitGeometry();
  // Focused north, away from the ramp head, so the two do not fight for the
  // same stretch of horizon.
  const pieces = useMemo(() => rimPlant(-Math.PI / 2, "crucible-rim-plant-v1"), []);

  const { stacks, silos, caps } = useMemo(() => {
    const stacks: Placed[] = [];
    const silos: Placed[] = [];
    const caps: Placed[] = [];
    for (const t of pieces as PlantPiece[]) {
      const place: Placed = { p: [t.x, t.h / 2, t.z], s: [t.w, t.h, t.d], ry: t.ry };
      if (t.kind === "stack") {
        stacks.push(place);
        caps.push({ p: [t.x, t.h + 0.3, t.z], s: [t.w * 1.05, t.w * 1.05, t.w * 1.05], ry: 0 });
      } else {
        silos.push(place);
      }
    }
    return { stacks, silos, caps };
  }, [pieces]);

  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a0f0a",
        emissive: new THREE.Color(EMBER),
        emissiveIntensity: 0.3,
        roughness: 0.5,
        toneMapped: false,
      }),
    []
  );
  useEffect(() => {
    capMaterial.emissiveIntensity = 0.3 + heat * 0.9;
  }, [capMaterial, heat]);
  useEffect(() => () => capMaterial.dispose(), [capMaterial]);

  return (
    <group>
      <InstancedPieces geometry={geo.round} material={surfaces.plant} items={silos} />
      <InstancedPieces geometry={geo.round} material={surfaces.plate} items={stacks} />
      <InstancedPieces geometry={geo.cap} material={capMaterial} items={caps} />
    </group>
  );
}

// ── The house ────────────────────────────────────────────────────────────────

const CROWD_TINT = new THREE.Color("#a8968a");
const RUNNER_TINT = new THREE.Color("#e0762c");

/**
 * Who is in the stands.
 *
 * One body per agent holding a real competitive record here — the same
 * `agent_reputation` rows the champion marks come from, so a viewer counting
 * bodies is counting agents who actually fight in this arena. Unlabelled: the
 * roster supports "this many compete here", not "this one is watching now".
 *
 * Runners on the ramp come from the arena's heat index instead, which decays
 * from the last bout. A house that has not had a fight in a fortnight has an
 * empty ramp and a full set of stands, and both halves of that are true.
 */
function House({
  champions,
  heat,
  reduced,
}: {
  champions: number;
  heat: number;
  reduced: boolean;
}) {
  const crowd = useMemo(
    () => buildPitCrowd({ standing: champions, intensity: heat, seed: "crucible" }),
    [champions, heat]
  );
  const tint = useCallback(
    (i: number) => (crowd.walkers[i].moving ? RUNNER_TINT : CROWD_TINT),
    [crowd]
  );
  return (
    <CrowdFigures
      routes={crowd.routes}
      bodies={crowd.walkers}
      tint={tint}
      scale={1.4}
      emissive="#4a2410"
      emissiveIntensity={0.7}
      // Bodies are what you see from a tier; lamps are what tells you anyone is
      // down there at all from the default framing. Figure size does not scale
      // with world size.
      lamp="#ffc46a"
      groundY={pitHeightAt}
      reduced={reduced}
    />
  );
}

// ── Scene ────────────────────────────────────────────────────────────────────

function Scene({ state, reduced }: { state: CrucibleSnapshot; reduced: boolean }) {
  const heat = state.heat;
  const lavaY = lavaLevel(heat);
  const lavaR = lavaRadius(lavaY);

  return (
    <>
      <GroundSky zenith="#0b0a1c" horizon="#4e2010" glow={EMBER} glowStrength={0.4 + heat * 0.3} radius={520} />
      <CloudBand color="#5a2410" opacity={0.5} radius={430} y={118} height={78} reduced={reduced} />
      <CloudBand color="#1e1b34" opacity={0.46} radius={330} y={168} height={96} reduced={reduced} />
      {/* The ground term is the melt, so every metal surface picks up an orange
          underside for free — most of what makes a pit read as a pit rather
          than as a hole with a light in it. */}
      <SkyEnvironment top="#141230" horizon="#5a2410" ground="#7a2c08" glow={EMBER} intensity={1.0} />

      <hemisphereLight args={["#3a4a86", "#5a1e06", 0.7]} />
      <ambientLight color="#2e3560" intensity={0.26} />
      {/* One key light, raking, so a riser reads differently from the tread
          above it and the bowl does not collapse into flat rings. */}
      <directionalLight color="#b9c8ee" intensity={1.75 + heat * 0.35} position={[-180, 210, 140]} />
      <pointLight color={EMBER} intensity={0.5 + heat * 5.5} position={[0, PIT_FLOOR + 10, 0]} distance={260} decay={1.4} />
      <pointLight color={EMBER} intensity={0.3 + heat * 4.4} position={[0, lavaY + 6, 0]} distance={220} decay={1.5} />

      <Bowl />
      <TierRails />

      <MoltenSurface radius={lavaR} y={lavaY} hot={EMBER} crust="#1b0e08" heat={heat} scale={5} reduced={reduced} />
      <LightShaft
        position={[0, lavaY + 46, 0]}
        radius={Math.max(lavaR * 0.8, 14)}
        height={92}
        color={EMBER}
        opacity={0.15 + heat * 0.16}
        flicker={0.65}
        reduced={reduced}
      />

      <DuelSpan heat={heat} reduced={reduced} />
      <Duellists duel={state.active_duel} reduced={reduced} />
      <ChampionMarks champions={state.champions} />
      <HouseMarks statues={state.house_statues} />
      <RimPlant heat={heat} />

      <RimMountains inner={238} outer={340} height={82} base={4} color="#241d38" seed={0x63727563} />

      <House champions={state.champions.length} heat={heat} reduced={reduced} />
      <Inhabitants world="crucible" reduced={reduced} groundY={pitHeightAt} intensity={heat} />

      {heat > 0.25 && <StormFlash color={EMBER_HOT} reduced={reduced} />}
      <ParticleField mode="embers" color={EMBER_HOT} area={110} reduced={reduced} />
      <GroundMist color={EMBER} opacity={0.05 + heat * 0.07} area={230} reduced={reduced} />
    </>
  );
}

export default function CrucibleArenaCanvas({
  state,
  reduced,
}: {
  state: CrucibleSnapshot;
  reduced: boolean;
}) {
  const [introDone, setIntroDone] = useState(false);
  const surfaces = usePitSurfaces(reduced, state.heat);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [205, 145, 240], fov: 50, near: 0.5, far: 1400 }}
    >
      <color attach="background" args={[SOOT]} />
      <fog attach="fog" args={["#241c33", 170, 720]} />

      <SurfaceContext.Provider value={surfaces}>
        <Scene state={state} reduced={reduced} />
      </SurfaceContext.Provider>

      <WorldFX world="crucible" bloom={0.72 + state.heat * 0.24} reduced={reduced} />

      <CinematicDescent
        from={[380, 300, 420]}
        target={[0, -18, 0]}
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
        target={[0, -18, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}

// Kept exported for the map view, which still draws a plan of the ring.
export { GROUND_RADIUS, RIM_RADIUS, ASH };
