"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Html } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import {
  GROUND_RADIUS,
  HEARTH,
  MAX_RINGS,
  RING_BASE_RADIUS,
  RING_STEP,
  columnHeight,
} from "@/lib/lathe/workshop";
import { rimPlant, type PlantPiece } from "@/lib/pit/geometry";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import type { LatheSnapshot } from "@/lib/lathe/data";
import type { ForgeRing } from "@/lib/lathe/forge";
import {
  CinematicDescent, CloudBand, GroundMist, GroundSky, ParticleField, Pulse,
  RimMountains, ScatterField, Spin, StormFlash, mixHex,
} from "@/components/v2/latent/ground-fx";
import { LightShaft, SkyEnvironment, WorldFX } from "@/components/v2/latent/world-kit";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── The Lathe: the shipping monument ─────────────────────────────────────────
//
// Room 4's world. The compiler contract is unchanged and is still the point:
// every column is a real commit from BUILD_LOG, every spark is a real
// innovation_ledger row filed from inside the room, and the spindle turns for
// as long as the site keeps shipping.
//
// Rebuilt 2026-08-10. The tiered bowl this world wore for a day has gone to the
// Crucible, on Travis's call that a pit with a fire in it and tiers looking
// down is a roast pit rather than a lathe. What replaces it here is the idea
// that was buried inside the bowl all along and never had a silhouette:
// TWELVE COMMITS, TWELVE COLUMNS, STANDING.
//
// The direction is deliberate and is the whole read. The oldest commit is the
// innermost and shortest; the newest is the outermost and tallest, and it is
// the only one that gleams. Walking outward is walking forward in time, and the
// colonnade grows a ring every time the site ships. That is a monument to a
// build history, which is what this room is, and it is a far more honest shape
// for the data than a quarry ever was — nothing here pretends to be geology.
//
// It stays storm-cyan, on purpose: the iteration-forge planet on the universe
// map is a storm giant, and a surface contradicting its own planet is the drift
// class fixed in UniverseCanvas on 2026-08-09.

const HEARTH_WARM = "#ffb35c";
const COLD = "#4a7bab";
const STORM = "#22d3ee";
const STONE_DARK = "#08111c";

const SPINDLE_TOP = 72;
const PLINTH_HEIGHT = 2.2;

// ── Surfaces ─────────────────────────────────────────────────────────────────

const STONE: SurfaceSpec = {
  stain: "#5a5040",
  panelsX: 3,
  panelsY: 6,
  seam: 0.46,
  wear: 0.7,
  wet: 0.08,
  rough: 0.94,
  relief: 1.2,
};

const PLATE: SurfaceSpec = {
  stain: "#8a5528",
  panelsX: 6,
  panelsY: 6,
  seam: 0.62,
  wear: 0.68,
  wet: 0.1,
  rough: 0.6,
  relief: 0.85,
};

/** The rim plant carries lit glass. A monument ring on an empty plain has no
 *  horizon, and no horizon means no depth. */
const FIREBRICK: SurfaceSpec = {
  stain: "#4a5a6a",
  panelsX: 4,
  panelsY: 5,
  seam: 0.52,
  wear: 0.78,
  wet: 0.08,
  rough: 0.9,
  relief: 1,
  windows: { cols: 7, rows: 9, lit: 0.34, warm: "#ffca8a", cool: "#8fd4e8" },
};

interface ForgeSurfaces {
  ground: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  plant: THREE.MeshStandardMaterial;
}

const SurfaceContext = createContext<ForgeSurfaces | null>(null);

const PLANT_GLOW_BASE = 1.1;
const PLANT_GLOW_HEAT = 0.45;

function useForgeSurfaces(reduced: boolean, heat: number): ForgeSurfaces {
  // `heat` is deliberately NOT a dependency. It moves on every poll, and
  // rebuilding a material swaps it underneath an instanced mesh, which
  // reconstructs the mesh with an all-zero matrix buffer — every instance
  // collapses to scale 0 and the rim silently vanishes a poll after it drew.
  const materials = useMemo<ForgeSurfaces>(() => {
    const stone = surface("lathe-stone", STONE);
    const plate = surface("lathe-plate", PLATE);
    const brick = surface("lathe-firebrick", FIREBRICK);
    return {
      ground: triplanarMaterial({
        surface: stone,
        color: "#39414c",
        scale: 44,
        metalness: 0.06,
        normalScale: 0.9,
        reduced,
      }),
      stone: triplanarMaterial({
        surface: stone,
        color: "#5b6472",
        scale: 9,
        metalness: 0.1,
        normalScale: 1,
        reduced,
      }),
      plate: triplanarMaterial({
        surface: plate,
        color: "#6a6f78",
        scale: 11,
        metalness: 0.68,
        roughness: 0.5,
        normalScale: 0.85,
        reduced,
      }),
      plant: triplanarMaterial({
        surface: brick,
        color: "#4c5866",
        scale: 18,
        metalness: 0.1,
        normalScale: 0.9,
        emissiveIntensity: PLANT_GLOW_BASE,
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

function useSurfaces(): ForgeSurfaces {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error("Lathe surfaces used outside the provider");
  return ctx;
}

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
  // Material as a PROP, matrices from a REF CALLBACK. See useForgeSurfaces.
  return (
    <instancedMesh ref={write} args={[geometry, undefined, items.length]} material={material} />
  );
}

// ── The floor ────────────────────────────────────────────────────────────────

function Floor() {
  const surfaces = useSurfaces();
  return (
    <mesh rotation-x={-Math.PI / 2} material={surfaces.ground}>
      <circleGeometry args={[GROUND_RADIUS, 96]} />
    </mesh>
  );
}

// ── The colonnade ────────────────────────────────────────────────────────────

/**
 * One column per real commit, standing on its own ring radius.
 *
 * Height, colour and gleam all come straight off the ring the compiler built:
 * `columnHeight` from the commit's age, colour from `classifyCommit` (ship
 * gold, fix blue, everything else grey), and only the newest one gleams, scaled
 * by forge heat. Nothing here is invented and nothing is smoothed — a run of
 * grey columns means a run of commits that named themselves nothing in
 * particular, and that is a true thing to show.
 */
function Colonnade({ rings, reduced }: { rings: ForgeRing[]; reduced: boolean }) {
  const surfaces = useSurfaces();
  const geo = useMemo(() => {
    const shaft = new THREE.CylinderGeometry(1.5, 1.9, 1, 10);
    const plinth = new THREE.CylinderGeometry(3.1, 3.6, PLINTH_HEIGHT, 10);
    return { shaft, plinth };
  }, []);
  useEffect(
    () => () => {
      geo.shaft.dispose();
      geo.plinth.dispose();
    },
    [geo]
  );

  // Each ring gets its own bearing so the colonnade spirals outward instead of
  // stacking every column on one radial line.
  const placed = useMemo(() => {
    const shafts: Placed[] = [];
    const plinths: Placed[] = [];
    rings.forEach((r) => {
      const a = r.index * 0.86 + 0.4;
      const x = Math.cos(a) * r.radius;
      const z = Math.sin(a) * r.radius;
      const h = columnHeight(r.index);
      plinths.push({ p: [x, PLINTH_HEIGHT / 2, z], s: [1, 1, 1], ry: a });
      shafts.push({ p: [x, PLINTH_HEIGHT + h / 2, z], s: [1, h, 1], ry: a });
    });
    return { shafts, plinths };
  }, [rings]);

  return (
    <group>
      <InstancedPieces geometry={geo.plinth} material={surfaces.stone} items={placed.plinths} />
      <InstancedPieces geometry={geo.shaft} material={surfaces.plate} items={placed.shafts} />
      {rings.map((r) => {
        const a = r.index * 0.86 + 0.4;
        const x = Math.cos(a) * r.radius;
        const z = Math.sin(a) * r.radius;
        const h = columnHeight(r.index);
        const band = (
          <mesh position={[x, PLINTH_HEIGHT + h + 0.5, z]} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[1.9, 0.3, 6, 20]} />
            <meshStandardMaterial
              color={r.color}
              emissive={r.color}
              emissiveIntensity={0.4 + r.gleam * 1.6}
              roughness={0.4}
              metalness={0.5}
              toneMapped={false}
            />
          </mesh>
        );
        return (
          <group key={r.sha}>
            {r.gleam > 0.02 ? (
              <Pulse speed={1.2} amp={0.03} reduced={reduced}>
                {band}
              </Pulse>
            ) : (
              band
            )}
            {/* The newest commit says what it was. The rest are a colonnade. */}
            {r.gleam > 0.02 && (
              <Html position={[x, PLINTH_HEIGHT + h + 5, z]} center distanceFactor={70} occlude={false}>
                <div className="pointer-events-none max-w-[200px] whitespace-normal rounded-md border border-cyan-900/40 bg-black/80 px-2 py-1 text-center font-mono text-[9px] text-cyan-100">
                  <div className="uppercase tracking-[0.14em] text-cyan-300/70">
                    {r.sha.slice(0, 7)} · newest
                  </div>
                  <div className="mt-0.5">{r.subject}</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ── The spindle ──────────────────────────────────────────────────────────────
// The one thing here that never stops turning. It was the Lathe's signature
// long before either rebuild and it survives both.

function Spindle({ heat, reduced }: { heat: number; reduced: boolean }) {
  const surfaces = useSurfaces();
  const collars = [10, 26, 42, 58];
  return (
    <group>
      <mesh position-y={18} material={surfaces.plate}>
        <cylinderGeometry args={[4.6, 8.5, 36, 16]} />
      </mesh>
      <mesh position-y={51} material={surfaces.plate}>
        <cylinderGeometry args={[2.4, 4.6, 30, 14]} />
      </mesh>
      <Spin speed={0.28} reduced={reduced}>
        {collars.map((y, i) => (
          <mesh key={y} position-y={y} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[7.6 - i * 1.1, 0.5, 5, 20]} />
            <meshStandardMaterial
              color="#0f1620"
              emissive={i < 2 ? HEARTH_WARM : STORM}
              emissiveIntensity={0.5 + heat * 0.7}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        ))}
        <mesh position-y={SPINDLE_TOP}>
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
      <LightShaft
        position={[0, 40, 0]}
        radius={9}
        height={80}
        color={HEARTH_WARM}
        opacity={0.1 + heat * 0.14}
        flicker={0.5}
        reduced={reduced}
      />
    </group>
  );
}

// ── Lightning ────────────────────────────────────────────────────────────────

function Lightning({ reduced }: { reduced: boolean }) {
  const [strike, setStrike] = useState(0);
  const timer = useRef({ next: 3.2, life: 0 });
  const line = useRef<Line2>(null);

  const points = useMemo(() => {
    const rand = mulberry32(hashStr(`bolt-${strike}`));
    const bearing = rand() * Math.PI * 2;
    const dist = 130 + rand() * 130;
    let x = Math.cos(bearing) * dist;
    let z = Math.sin(bearing) * dist;
    const top = 190 + rand() * 60;
    const pts: [number, number, number][] = [[x, top, z]];
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
    <Line ref={line} points={points} color="#d8f6ff" lineWidth={1.8} transparent opacity={0} toneMapped={false} />
  );
}

// ── The rim plant ────────────────────────────────────────────────────────────

function RimPlant({ heat }: { heat: number }) {
  const surfaces = useSurfaces();
  const geo = useMemo(() => {
    const cap = new THREE.TorusGeometry(0.5, 0.12, 5, 12);
    cap.rotateX(-Math.PI / 2);
    return { round: new THREE.CylinderGeometry(0.5, 0.55, 1, 10), cap };
  }, []);
  useEffect(
    () => () => {
      geo.round.dispose();
      geo.cap.dispose();
    },
    [geo]
  );

  const pieces = useMemo(() => rimPlant(Math.PI / 2, "lathe-rim-plant-v1"), []);
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
        color: "#0f1620",
        emissive: new THREE.Color(HEARTH_WARM),
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

// ── The hearth ───────────────────────────────────────────────────────────────

function ForgeHearth({ heat, reduced }: { heat: number; reduced: boolean }) {
  return (
    <group position={[HEARTH.x, 0, HEARTH.z]}>
      <mesh position-y={0.8}>
        <boxGeometry args={[10, 1.6, 8]} />
        <meshStandardMaterial color="#2a2118" roughness={0.85} />
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
  return (
    <group>
      <Pulse speed={2} amp={0.12} reduced={reduced}>
        <mesh position={[spark.x, 1.4, spark.z]}>
          <octahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.3} />
        </mesh>
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

// ── Scene ────────────────────────────────────────────────────────────────────

function Scene({ state, reduced }: { state: LatheSnapshot; reduced: boolean }) {
  const heat = state.forge_heat;
  const level = state.weather.level;
  const sparkColor = mixHex(COLD, HEARTH_WARM, heat);

  return (
    <>
      <GroundSky zenith="#061323" horizon="#164a66" glow={STORM} glowStrength={0.4 + level * 0.3} radius={520} />
      <CloudBand color="#1a4763" opacity={0.5 + level * 0.22} radius={430} y={118} height={78} reduced={reduced} />
      <CloudBand color="#12324c" opacity={0.4} radius={330} y={168} height={96} reduced={reduced} />
      <SkyEnvironment top="#0a1a2c" horizon="#1d4a68" ground="#243a4a" glow={STORM} intensity={1.0} />

      <hemisphereLight args={["#2a5c8f", "#1a2630", 0.6]} />
      <ambientLight color="#1b3f66" intensity={0.24} />
      <directionalLight color="#bcd2e4" intensity={1.6 + heat * 0.3} position={[-180, 210, 140]} />
      <pointLight color={HEARTH_WARM} intensity={1.4 + heat * 1.6} position={[0, 26, 0]} distance={200} decay={1.5} />
      <pointLight color={HEARTH_WARM} intensity={0.6 + heat * 0.9} position={[HEARTH.x, 8, HEARTH.z]} distance={150} />

      <Floor />
      <Colonnade rings={state.rings} reduced={reduced} />
      <Spindle heat={heat} reduced={reduced} />
      <RimPlant heat={heat} />
      <ForgeHearth heat={heat} reduced={reduced} />

      {state.sparks.map((s, i) => (
        <LedgerFlare key={s.id} spark={s} showLabel={i < 20} reduced={reduced} />
      ))}

      <ScatterField
        kind="crystals"
        count={24}
        area={GROUND_RADIUS - 20}
        minRadius={RING_BASE_RADIUS + MAX_RINGS * RING_STEP + 6}
        color="#7de3f4"
        heightFn={() => 0}
        seed={0x1a7e}
      />
      <RimMountains inner={238} outer={340} height={82} base={4} color="#1b3145" seed={0x1a7e} />

      <Inhabitants world="lathe" reduced={reduced} />

      <Lightning reduced={reduced} />
      {level > 0.25 && <StormFlash color={STORM} reduced={reduced} />}
      <ParticleField mode="rain" color="#9fd8ee" area={230} reduced={reduced} />
      <ParticleField mode="embers" color={sparkColor} area={90} reduced={reduced} />
      <GroundMist color={STORM} opacity={0.05 + level * 0.07} area={230} reduced={reduced} />
    </>
  );
}

export default function LatheForgeCanvas({ state, reduced }: { state: LatheSnapshot; reduced: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const surfaces = useForgeSurfaces(reduced, state.forge_heat);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [150, 78, 175], fov: 50, near: 0.5, far: 1400 }}
    >
      <color attach="background" args={[STONE_DARK]} />
      <fog attach="fog" args={["#12293d", 170, 720]} />

      <SurfaceContext.Provider value={surfaces}>
        <Scene state={state} reduced={reduced} />
      </SurfaceContext.Provider>

      <WorldFX world="lathe" bloom={0.82 + state.forge_heat * 0.22} reduced={reduced} />

      <CinematicDescent
        from={[380, 300, 420]}
        target={[0, 14, 0]}
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
        target={[0, 14, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}
