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
  PIT_FLOOR,
  RIM_RADIUS,
  RING_BASE_RADIUS,
  RING_STEP,
  foundryTown,
  lavaLevel,
  lavaRadius,
  terraceElevation,
  terraceHeightAt,
  terraceProfile,
  type TownPiece,
} from "@/lib/lathe/workshop";
import { buildCrewLife } from "@/lib/lathe/crewlife";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import type { LatheSnapshot } from "@/lib/lathe/data";
import type { ForgeRing } from "@/lib/lathe/forge";
import {
  CinematicDescent, CloudBand, GroundMist, GroundSky, ParticleField, Pulse,
  RimMountains, ScatterField, Spin, StormFlash, mixHex,
} from "@/components/v2/latent/ground-fx";
import {
  CrowdFigures, LightShaft, MoltenSurface, RevolvedTerrain, SkyEnvironment, WorldFX,
} from "@/components/v2/latent/world-kit";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── The Lathe FORGE: a quarry cut into the build history ─────────────────────
//
// The compiler contract is unchanged and remains the point: every terrace is a
// real commit from BUILD_LOG, every spark is a real innovation_ledger row filed
// from inside the room, and the spindle turns for as long as the site keeps
// shipping.
//
// Rebuilt in three passes. 2026-08-09 gave the world its third dimension — the
// twelve commits stopped being flat rings on a 220-radius disc and became a
// stepped canyon, oldest commit innermost and deepest, the way sediment works.
// 2026-08-10 gave it a SURFACE and a POPULATION, against panel 2 of the
// reference sheet (the volcanic megacity), which is the panel Travis mapped to
// this world.
//
// Three things were measurably wrong before that second pass, and each has a
// specific fix here:
//
//   1. THE MELT WAS A PUDDLE. The pool sat at a fixed 4.2 units above the pit
//      floor, which on this bowl works out at six units across inside a
//      four-hundred-unit world — invisible at every camera distance. A foundry
//      world lit by nothing was reading as a cold quarry. The melt is now a
//      LEVEL keyed to real forge heat, and its radius is read off the bowl's
//      own profile so it cannot float free of the rock holding it.
//   2. NOTHING HAD A SURFACE. 15 declared metalness values with no environment
//      map behind them, which renders as "slightly darker" and nothing else.
//      There is an env map now, and the rock, the plate and the town all carry
//      generated albedo/roughness/normal sets sampled triplanar in world space.
//   3. THE TERRACES READ AS FLAT RINGS AGAIN. Four-unit steps on a 220-unit
//      radius are 1.9% of the width; from any camera that frames the world they
//      vanish. The step is deeper now and the rock is textured, so the risers
//      catch the key light and the canyon reads as one.
//
// It stays storm-cyan overhead rather than becoming a lava sky, on purpose: the
// iteration-forge planet on the universe map is a storm giant, and a surface
// contradicting its own planet is exactly the drift class fixed in
// UniverseCanvas on 2026-08-09. Panel 2 is a volcanic CITY, not a volcanic sky.
// The fire is real and it is now large, but it is at the bottom of the pit where
// a foundry's fire belongs, under a sky that does not change.

const HEARTH_WARM = "#ffb35c";
const MOLTEN = "#ff7a2a";
const COLD = "#4a7bab";
const STORM = "#22d3ee";
const STONE_DARK = "#08111c";
const STONE_ROCK = "#4a4a52";

const PROFILE = terraceProfile();
const SPINDLE_TOP = 72;

/** Baked contact darkening: the quarry loses light with depth. This is what an
 *  SSAO pass would mostly be doing here, for the price of a vertex attribute
 *  instead of a second full-scene render. */
function quarryShade(y: number): number {
  const depth = Math.min(1, -y / (Math.abs(PIT_FLOOR) + 2));
  return 0.34 + 0.66 * Math.pow(1 - depth, 0.8);
}

// ── Surfaces ─────────────────────────────────────────────────────────────────
// Three generated texture sets carry the whole world. Everything samples them
// triplanar in world space, so one material covers a four-unit shed wall and a
// hundred-and-sixty-unit canyon at identical texel density with no UV work.

/** Cut basalt. Strata read as horizontal bands, so the panel grid is taller
 *  than it is wide — on a quarry wall the seams ARE the geology. */
const BASALT: SurfaceSpec = {
  stain: "#6a4a30",
  panelsX: 3,
  panelsY: 6,
  seam: 0.44,
  wear: 0.72,
  wet: 0.05,
  rough: 0.96,
  relief: 1.3,
};

/** The town. Firebrick and soot, plus the window grid that turns a box into a
 *  building — the single strongest "city" cue there is.
 *
 *  `lit` is keyed to what is BUILT, never to today's traffic. The forge heat
 *  decays continuously from the last commit, so wiring windows to it would
 *  render a quiet fortnight as an evacuated town. Occupancy sets the floor;
 *  heat modulates emissiveIntensity on top, which needs no regeneration. */
const FIREBRICK: SurfaceSpec = {
  stain: "#7a4526",
  panelsX: 4,
  panelsY: 5,
  seam: 0.52,
  wear: 0.8,
  wet: 0.04,
  rough: 0.9,
  relief: 1,
  // Seven across an eighteen-unit tile is a 2.6-unit window, so a 20-unit
  // frontage carries about eight of them. The two attempts either side of this
  // both failed for texel density rather than for count: at 1.5 units the town
  // read as pixel art, and at 0.75 a single building carried fourteen hundred
  // windows that aliased into rainbow speckle.
  windows: {
    cols: 7,
    rows: 9,
    lit: 0.34,
    warm: "#ffb257",
    cool: "#8fd4e8",
  },
};

/** Plate steel: the spindle, the gantries, the stacks and the silos. Tight
 *  seams, heavy rust staining, and the one surface here with enough metal in it
 *  to care that there is finally an environment map. */
const PLATE: SurfaceSpec = {
  stain: "#8a5528",
  panelsX: 6,
  panelsY: 6,
  seam: 0.62,
  wear: 0.68,
  wet: 0.08,
  rough: 0.6,
  relief: 0.85,
};

interface ForgeSurfaces {
  rock: THREE.MeshStandardMaterial;
  town: THREE.MeshStandardMaterial;
  shed: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  spindle: THREE.MeshStandardMaterial;
}

const SurfaceContext = createContext<ForgeSurfaces | null>(null);

function useForgeSurfaces(reduced: boolean, heat: number): ForgeSurfaces {
  const materials = useMemo<ForgeSurfaces>(() => {
    const basalt = surface("lathe-basalt", BASALT);
    const brick = surface("lathe-firebrick", FIREBRICK);
    const plate = surface("lathe-plate", PLATE);

    const rock = triplanarMaterial({
      surface: basalt,
      color: "#ffffff",
      // Coarse on purpose. At 24 the seams landed every four world units across
      // a 220-unit canyon and the rock read as corrugation rather than geology.
      scale: 40,
      metalness: 0.04,
      normalScale: 1.1,
      vertexColors: true,
      reduced,
    });
    // The quarry is a revolution: from inside the bowl the camera sees the back
    // of the lathe faces, so both sides have to be lit.
    rock.side = THREE.DoubleSide;

    return {
      rock,
      // Windows run hot for the same reason they do in Arclight: the sky is
      // cold and it covers the whole frame, so at parity the town reads as one
      // teal wash. Warm has to win locally while the atmosphere wins globally.
      town: triplanarMaterial({
        surface: brick,
        color: "#6b5747",
        scale: 18,
        metalness: 0.08,
        normalScale: 0.9,
        emissiveIntensity: 1.15 + heat * 0.45,
        reduced,
      }),
      shed: triplanarMaterial({
        surface: basalt,
        color: "#4b433c",
        scale: 6,
        metalness: 0.1,
        normalScale: 1,
        reduced,
      }),
      plate: triplanarMaterial({
        surface: plate,
        color: "#5b5f66",
        scale: 7,
        metalness: 0.62,
        roughness: 0.58,
        normalScale: 1,
        reduced,
      }),
      spindle: triplanarMaterial({
        surface: plate,
        color: "#6a6f78",
        scale: 13,
        metalness: 0.7,
        roughness: 0.48,
        normalScale: 0.8,
        reduced,
      }),
    };
  }, [reduced, heat]);

  // Materials are per-scene and get disposed; the textures behind them are
  // module-cached, because a visitor bouncing between worlds should not pay to
  // regenerate them each time.
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

// ── The cut face ─────────────────────────────────────────────────────────────

function Quarry() {
  const surfaces = useSurfaces();
  return <RevolvedTerrain profile={PROFILE} segments={160} color={STONE_ROCK} shade={quarryShade} material={surfaces.rock} />;
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
// melt. They are what makes the canyon legible from a distance: without them
// the terraces read as concentric circles again, just lower down.
//
// Both edges sample the height field at their OWN position rather than at the
// centreline. Sampling once and using it for both was why these read as a row
// of orange dashes: on every riser the ribbon cut into the rock and the buried
// stretches vanished, leaving only the parts that happened to clear the slope.

function MoltenChannel({ bearing, from, width = 1.3 }: { bearing: number; from: number; width?: number }) {
  const geometry = useMemo(() => {
    const dx = Math.cos(bearing);
    const dz = Math.sin(bearing);
    const px = -dz;
    const pz = dx;
    const steps = 120;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const r = from + (i / steps) * (RIM_RADIUS - from);
      const x = dx * r;
      const z = dz * r;
      // Runnels narrow as they drop, like real spillways.
      const w = width * (0.5 + 0.5 * (r / RIM_RADIUS));
      const lx = x + px * w;
      const lz = z + pz * w;
      const rx = x - px * w;
      const rz = z - pz * w;
      positions.push(lx, terraceHeightAt(lx, lz) + 0.3, lz);
      positions.push(rx, terraceHeightAt(rx, rz) + 0.3, rz);
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
  }, [bearing, from, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={MOLTEN}
        emissive={MOLTEN}
        emissiveIntensity={0.85}
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
  const surfaces = useSurfaces();
  const lower = PIT_FLOOR;
  const seg = (a: number, b: number) => ({ h: b - a, y: (a + b) / 2 });
  const s1 = seg(lower, lower + 42);
  const s2 = seg(lower + 42, 30);
  const s3 = seg(30, SPINDLE_TOP);

  const collars = [-22, -2, 22, 46, 64];

  return (
    <group>
      <mesh position-y={s1.y} material={surfaces.spindle}>
        <cylinderGeometry args={[7.4, 10.5, s1.h, 16]} />
      </mesh>
      <mesh position-y={s2.y} material={surfaces.spindle}>
        <cylinderGeometry args={[4.6, 7.4, s2.h, 16]} />
      </mesh>
      <mesh position-y={s3.y} material={surfaces.spindle}>
        <cylinderGeometry args={[2.4, 4.6, s3.h, 14]} />
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

// ── The foundry town ─────────────────────────────────────────────────────────
// Panel 2 is a volcanic megacity, and what stood on this rim was thirty-four
// boxes averaging seven units tall on a hundred-and-nine-unit rim — a shanty,
// seen from orbit. The layout is pinned in lib/lathe/workshop.ts; this only
// draws it.
//
// Four instanced meshes for the whole city: two box batches (housed stock with
// window grids, and windowless sheds) and two cylinder batches (stacks and
// silos). The furnace caps on the stacks are the fifth, and they are the only
// part that carries live data.

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
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
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
  }, [items]);

  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} />;
}

function useTownGeometry() {
  const kit = useMemo(() => {
    // A torus is born standing in the XY plane. `InstancedPieces` only applies
    // yaw, so without this the furnace mouths are vertical hoops rearing off
    // the stack tops instead of rings sitting on them.
    const cap = new THREE.TorusGeometry(0.5, 0.12, 5, 12);
    cap.rotateX(-Math.PI / 2);
    return {
      box: new THREE.BoxGeometry(1, 1, 1),
      // Ten sides is enough for a stack at this distance and keeps the whole
      // city inside its draw-call budget.
      round: new THREE.CylinderGeometry(0.5, 0.55, 1, 10),
      cap,
    };
  }, []);
  useEffect(
    () => () => {
      kit.box.dispose();
      kit.round.dispose();
      kit.cap.dispose();
    },
    [kit]
  );
  return kit;
}

function FoundryTown({ heat }: { heat: number }) {
  const surfaces = useSurfaces();
  const geo = useTownGeometry();
  const pieces = useMemo(() => foundryTown(), []);

  const { houses, sheds, round, caps } = useMemo(() => {
    const houses: Placed[] = [];
    const sheds: Placed[] = [];
    const round: Placed[] = [];
    const caps: Placed[] = [];
    for (const t of pieces as TownPiece[]) {
      // Everything out here stands on the flat rim, so the ground is y=0 and
      // the height field is not consulted — but the assertion is worth keeping
      // in mind if the town is ever moved inside RIM_RADIUS.
      const place: Placed = { p: [t.x, t.h / 2, t.z], s: [t.w, t.h, t.d], ry: t.ry };
      if (t.kind === "house") houses.push(place);
      else if (t.kind === "shed") sheds.push(place);
      else {
        round.push(place);
        if (t.kind === "stack") {
          caps.push({ p: [t.x, t.h + 0.3, t.z], s: [t.w * 1.05, t.w * 1.05, t.w * 1.05], ry: 0 });
        }
      }
    }
    return { houses, sheds, round, caps };
  }, [pieces]);

  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a0f0a",
        emissive: new THREE.Color(MOLTEN),
        emissiveIntensity: 0.3 + heat * 0.9,
        roughness: 0.5,
        toneMapped: false,
      }),
    [heat]
  );
  useEffect(() => () => capMaterial.dispose(), [capMaterial]);

  return (
    <group>
      <InstancedPieces geometry={geo.box} material={surfaces.town} items={houses} />
      <InstancedPieces geometry={geo.box} material={surfaces.shed} items={sheds} />
      <InstancedPieces geometry={geo.round} material={surfaces.plate} items={round} />
      {/* The stack mouths. The only part of the town keyed to live data: a cold
          forge banks its furnaces, it does not demolish them. */}
      <InstancedPieces geometry={geo.cap} material={capMaterial} items={caps} />
    </group>
  );
}

// ── Foundry furniture ────────────────────────────────────────────────────────

function useWorks() {
  return useMemo(() => {
    const rand = mulberry32(hashStr("lathe-works-v2"));
    const gantries: Placed[] = [];

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

    return gantries;
  }, []);
}

function Works() {
  const surfaces = useSurfaces();
  const geo = useTownGeometry();
  const gantries = useWorks();
  return <InstancedPieces geometry={geo.box} material={surfaces.plate} items={gantries} />;
}

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

// ── The shift ────────────────────────────────────────────────────────────────
// See lib/lathe/crewlife.ts for what these bodies are allowed to claim. In
// short: one crew member per real commit in the build log, and haul skips
// keyed to real forge heat, with neither able to borrow from the other.

const CREW_TINT = new THREE.Color("#9d9184");
const HAULER_TINT = new THREE.Color("#e08a3c");

function Shift({ commits, heat, reduced }: { commits: number; heat: number; reduced: boolean }) {
  const life = useMemo(() => buildCrewLife({ commits, heat }), [commits, heat]);
  const tint = useCallback(
    (i: number) => (life.walkers[i].hauler ? HAULER_TINT : CREW_TINT),
    [life]
  );
  return (
    <CrowdFigures
      routes={life.routes}
      bodies={life.walkers}
      tint={tint}
      scale={1.4}
      // Warmer than Arclight's slate: everyone down here is standing near an
      // open melt, and a figure that does not pick up the firelight reads as
      // pasted on.
      emissive="#4a2410"
      emissiveIntensity={0.7}
      // The quarry is 440 units across and the shift is twelve strong. The
      // bodies are what you see when you zoom to a terrace; the lamps are what
      // tells you anyone is down there at all from the default framing.
      lamp="#ffc46a"
      groundY={terraceHeightAt}
      reduced={reduced}
    />
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

function Scene({ state, reduced }: { state: LatheSnapshot; reduced: boolean }) {
  const heat = state.forge_heat;
  const level = state.weather.level;
  const sparkColor = mixHex(COLD, HEARTH_WARM, heat);

  // The melt is a LEVEL, and its radius follows from the pit's own profile
  // rather than being a second number that can drift out of step with it.
  const lavaY = lavaLevel(heat);
  const lavaR = lavaRadius(lavaY);

  return (
    <>
      {/* Storm sky. No stars and no galaxy: the cloud deck is closed. */}
      <GroundSky zenith="#061323" horizon="#164a66" glow={STORM} glowStrength={0.4 + level * 0.3} radius={520} />
      <CloudBand color="#1a4763" opacity={0.5 + level * 0.22} radius={430} y={118} height={78} reduced={reduced} />
      <CloudBand color="#12324c" opacity={0.4} radius={330} y={168} height={96} reduced={reduced} />
      {/* Image-based lighting. The ground term is the melt, so every metal
          surface in the world picks up an orange underside for free — which is
          most of what makes a foundry read as a foundry rather than as a
          quarry with a light in it. Before this, all 15 declared metalness
          values in this scene had nothing to reflect and only darkened. */}
      <SkyEnvironment top="#0a1a2c" horizon="#1d4a68" ground="#5c2408" glow={STORM} intensity={1.05} />

      <hemisphereLight args={["#2a5c8f", "#4a1e08", 0.6]} />
      <ambientLight color="#1b3f66" intensity={0.2} />
      {/* The one key light: a break in the storm, raking across the terraces.
          Raking is the point — it is what makes a riser different from a tread
          and stops the canyon collapsing back into concentric rings. */}
      <directionalLight color="#bcd2e4" intensity={1.55 + heat * 0.35} position={[-180, 210, 140]} />
      {/* Everything else that lights this world comes up out of the ground. Two
          lamps, not one: the floor lamp fills the pit, and a second sits at the
          melt's own surface so the terraces ABOVE it are lit from below. */}
      <pointLight color={MOLTEN} intensity={3 + heat * 3.4} position={[0, PIT_FLOOR + 10, 0]} distance={260} decay={1.4} />
      <pointLight color={MOLTEN} intensity={1.6 + heat * 3} position={[0, lavaY + 6, 0]} distance={220} decay={1.5} />
      <pointLight color={HEARTH_WARM} intensity={0.6 + heat * 0.9} position={[HEARTH.x, 8, HEARTH.z]} distance={150} />

      <Quarry />
      {state.rings.map((r) => (
        <RingLip key={r.sha} ring={r} reduced={reduced} />
      ))}

      {[0, 1, 2, 3, 4].map((i) => (
        <MoltenChannel key={i} bearing={(i * 2 * Math.PI) / 5 + 0.4} from={Math.max(lavaR - 1, 2)} />
      ))}

      <MoltenSurface radius={lavaR} y={lavaY} hot={MOLTEN} crust="#1d1117" heat={heat} scale={5} reduced={reduced} />
      {/* The furnace glow leaving the pit — the reason the world reads as deep
          from a camera that cannot see the bottom. */}
      <LightShaft
        position={[0, lavaY + 46, 0]}
        radius={Math.max(lavaR * 0.8, 14)}
        height={92}
        color={MOLTEN}
        opacity={0.15 + heat * 0.16}
        flicker={0.65}
        reduced={reduced}
      />

      <Spindle heat={heat} reduced={reduced} />
      <Works />
      <FoundryTown heat={heat} />
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

      <RimMountains inner={238} outer={340} height={82} base={4} color="#1b3145" seed={0x1a7e} />

      <Shift commits={state.stats.ring_count} heat={heat} reduced={reduced} />
      <Inhabitants world="lathe" reduced={reduced} groundY={terraceHeightAt} />

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
      camera={{ position: [205, 145, 240], fov: 50, near: 0.5, far: 1400 }}
    >
      <color attach="background" args={[STONE_DARK]} />
      {/* Fog resolves toward the sky's own horizon colour, and starts far
          enough out that the town on the far rim is atmospheric rather than
          erased — the far rim IS the skyline in this world. */}
      <fog attach="fog" args={["#12293d", 160, 700]} />

      <SurfaceContext.Provider value={surfaces}>
        <Scene state={state} reduced={reduced} />
      </SurfaceContext.Provider>

      <WorldFX world="lathe" bloom={0.82 + state.forge_heat * 0.22} reduced={reduced} />

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
