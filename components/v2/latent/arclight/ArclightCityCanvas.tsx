"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import {
  ARTERIALS,
  CHANNEL,
  DISTRICTS,
  LANDMARKS,
  MINT_ISLAND,
  LAND_NORTH,
  LAND_SOUTH,
  buildCityPlan,
  type ArclightSnapshot,
  type CityPlan,
  type DistrictId,
  type HabField,
  type Storefront,
  type Tower,
} from "@/lib/arclight/cityplan";
import {
  CIRCUIT_HEIGHT,
  CRANE_SITES,
  FIRST_SITES,
  FOUNDRY_PLANT,
  HAB_SLAB,
  HEIGHT_SCALE,
  buildSkyline,
  circuitPath,
  circuitPointAt,
  toWorld,
} from "@/lib/arclight/skyline";
import {
  CinematicDescent, GroundMist, MilkyWayBackdrop, ParticleField, Pulse,
  SkyWorld,
} from "@/components/v2/latent/ground-fx";
import { SkyDome, SkyEnvironment, WorldFX } from "@/components/v2/latent/world-kit";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";

// ── Arclight CITY: the comprehensive 3D read ─────────────────────────────────
// Same compiler-world contract as the 2D map: everything here renders from the
// one CityPlan object plus the fixed geography and the seeded skyline. No new
// state, no inference — the night city IS the ledgers. It is always night in
// Arclight; emissive light carries the scene, so shadows stay off and the
// window instancing keeps the whole metropolis to a handful of draw calls.

const ACCENT = "#2dd4bf";
const AMBER = "#f59e0b";

// District tints, lifted 2026-08-09. These used to run #0c1118 to #16130f —
// RGB 12 to 36 out of 255, i.e. every building in the city was painted almost
// black. That is a different thing from a dark scene, and it is a hard ceiling:
// a surface with no value range has nothing for a light to reveal, so the
// procedural detail below would have been invisible underneath it. The paint is
// now mid-tone and the LIGHT RIG does the darkening, which is how the reference
// art gets a night city that still shows its own concrete.
const BODY_TINT: Record<DistrictId, string> = {
  stacks: "#2b3340",
  old_grid: "#312b3a",
  strip: "#2a3642",
  exchange: "#273246",
  dockyards: "#2c3038",
  foundry: "#3a3026",
};

const TOWER_TINT = "#273246";
const STALL_TINT = "#2a3642";
const HAB_TINT = "#29313d";
const DECK_TINT = "#2a323e";
const LAND_TINT = "#1a212c";
// The Foundry runs warm where the rest of the city runs cold — soot and
// firelight rather than rain and neon.
const WORKS_TINT = "#3a3026";

const WINDOW_PALETTE = ["#f5c580", "#cfdcea", "#67e8f9"] as const;
const WINDOW_DARK = "#0b0e13";

// ── City surfaces ────────────────────────────────────────────────────────────
// Two generated texture sets carry the whole metropolis. Everything samples
// them triplanar in world space, so one material covers a 6-unit market stall
// and a 40-unit exchange tower at identical texel density with no UV work.

const CONCRETE: SurfaceSpec = {
  stain: "#7d6a52",
  panelsX: 4,
  panelsY: 4,
  seam: 0.55,
  wear: 0.62,
  wet: 0.12,
  rough: 0.88,
  relief: 1,
};

// Inhabited stock: blocks, towers, hab slabs. Same concrete, plus the window
// grid that turns a box into a building.
//
// `lit` is deliberately keyed to what is BUILT here, not to what happened
// today. Arclight is compiled from real business data, and on a quiet day the
// freight, grid-load and inference numbers all read zero — but 16 residents
// still live here and 28 storefronts still exist. Wiring the windows to
// today's traffic rendered "nobody traded this hour" as "the city is
// abandoned", which overstates the quiet. Occupancy sets the floor; activity
// modulates emissiveIntensity on top of it, which needs no regeneration.
const FACADE: SurfaceSpec = {
  stain: "#7d6a52",
  panelsX: 4,
  panelsY: 4,
  seam: 0.55,
  wear: 0.62,
  wet: 0.12,
  rough: 0.88,
  relief: 1,
  windows: {
    cols: 7,
    rows: 8,
    lit: 0.42,
    warm: "#ffca7a",
    cool: "#9fd8ff",
  },
};

// Streets, viaducts and riverbank. Heavily wetted: Arclight sits on water under
// permanent night, and wet ground is where the new environment map does its
// most visible work.
const CIVIC: SurfaceSpec = {
  stain: "#4a5a5e",
  panelsX: 2,
  panelsY: 2,
  seam: 0.3,
  wear: 0.8,
  wet: 0.72,
  rough: 0.76,
  relief: 0.8,
};

interface CitySurfaces {
  block: THREE.MeshStandardMaterial;
  tower: THREE.MeshStandardMaterial;
  hab: THREE.MeshStandardMaterial;
  stall: THREE.MeshStandardMaterial;
  deck: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  works: THREE.MeshStandardMaterial;
}

const SurfaceContext = createContext<CitySurfaces | null>(null);

function useCitySurfaces(reduced: boolean): CitySurfaces {
  const materials = useMemo<CitySurfaces>(() => {
    const concrete = surface("arclight-concrete", CONCRETE);
    const facade = surface("arclight-facade", FACADE);
    const civic = surface("arclight-civic", CIVIC);
    // Scale is world units per tile: tighter on small structures so a stall
    // does not wear the same size panels as a tower. On the window-bearing
    // surfaces it doubles as the storey height — rows/scale world units per
    // floor — so a hab slab reads as more, shorter floors than a tower.
    return {
      // Emissive runs hot on purpose. The haze is cold and it covers the whole
      // frame, so at parity the city reads as one teal wash; the warm/cool
      // tension in every reference image comes from window light winning
      // locally while the atmosphere wins globally.
      block: triplanarMaterial({ surface: facade, scale: 10, metalness: 0.06, normalScale: 0.85, emissiveIntensity: 2.4, reduced }),
      tower: triplanarMaterial({ surface: facade, color: TOWER_TINT, scale: 14, metalness: 0.14, normalScale: 0.7, emissiveIntensity: 2.9, reduced }),
      hab: triplanarMaterial({ surface: facade, color: HAB_TINT, scale: 8, metalness: 0.05, normalScale: 0.9, emissiveIntensity: 2.1, reduced }),
      stall: triplanarMaterial({ surface: concrete, color: STALL_TINT, scale: 5, metalness: 0.05, normalScale: 1, reduced }),
      deck: triplanarMaterial({ surface: civic, color: DECK_TINT, scale: 12, metalness: 0.22, normalScale: 0.8, reduced }),
      ground: triplanarMaterial({ surface: civic, color: LAND_TINT, scale: 26, metalness: 0.18, normalScale: 0.7, reduced }),
      // Heavier relief and more metal than the housing stock: this is plant,
      // not architecture.
      works: triplanarMaterial({ surface: concrete, color: WORKS_TINT, scale: 9, metalness: 0.3, roughness: 0.95, normalScale: 1.15, reduced }),
    };
  }, [reduced]);

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

function useSurfaces(): CitySurfaces {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error("Arclight surfaces used outside the provider");
  return ctx;
}

// ── Water and land ───────────────────────────────────────────────────────────

function DarkPool() {
  // Raised from -0.7. At the old level the harbour sat well below the land and
  // the lit quay wall showed all the way round, which is the exact silhouette
  // of a model on a table. Water lapping near the top edge reads as coastline.
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.22}>
      <planeGeometry args={[1100, 950]} />
      <meshStandardMaterial
        color="#030608"
        metalness={0.55}
        roughness={0.3}
        emissive="#062018"
        emissiveIntensity={0.22}
      />
    </mesh>
  );
}

function LandMass({ pts }: { pts: readonly [number, number][] }) {
  const surfaces = useSurfaces();
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    pts.forEach(([mx, my], i) => {
      const [x, z] = toWorld(mx, my);
      // Shape-space y becomes -worldZ after the rotateX below.
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    // Extrusion runs 0→1.6 along +y after the rotation; drop the bank so its
    // top face sits a hair under the y=0 building bases, sides in the water.
    g.translate(0, -1.62, 0);
    g.computeVertexNormals();
    return g;
    // Fixed geography — pts never change identity meaningfully.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  // flatShading is deliberately gone here and on every surface below that took
  // a normal map: it recomputes normals per face, which flattens exactly the
  // relief the map is there to add.
  return <mesh geometry={geometry} material={surfaces.ground} />;
}

/**
 * The city that exists beyond the part we simulate.
 *
 * Arclight's whole failure as an image was that it read as a model on a table:
 * a lit plate with a visible edge, floating in void. Depth in a wide city shot
 * comes from layered silhouettes at increasing distance, each one paler than
 * the one in front, until the furthest merges into the horizon. That is what
 * separates a photograph of a city from a photograph of a diorama, and no
 * amount of detail on the near buildings substitutes for it.
 *
 * So: an annulus of blocks starting outside the simulated districts and
 * running out past the fog's far plane. They carry the same facade material as
 * the real city, which costs one extra draw call and buys distant window glow
 * for free — and because fog applies after emissive in three's shader, those
 * windows fade with distance exactly like the concrete does.
 *
 * These are scenery, and they are honest about it: nothing here is derived from
 * business data, nothing here is counted anywhere, and no resident can be here.
 * The simulated city is the lit plate. This is the horizon it sits in.
 */
function DistantSkyline({ reduced }: { reduced: boolean }) {
  const surfaces = useSurfaces();
  const count = reduced ? 90 : 190;
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, surfaces.tower, count);
    const t = new THREE.Object3D();
    // Deterministic: the skyline is geography, and geography should not
    // reshuffle itself on every render.
    let seed = 20260809;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      // Squared distribution pushes more of them far out, so the ring reads as
      // a city thinning toward a horizon rather than as a fence around the map.
      const radius = 320 + Math.pow(rand(), 0.6) * 340;
      const h = 16 + Math.pow(rand(), 1.7) * 88;
      t.position.set(Math.cos(angle) * radius, h / 2 - 1, Math.sin(angle) * radius);
      t.scale.set(11 + rand() * 19, h, 11 + rand() * 19);
      t.rotation.y = rand() * Math.PI;
      t.updateMatrix();
      m.setMatrixAt(i, t.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [geometry, surfaces.tower, count]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={mesh} />;
}

// ── Roads ────────────────────────────────────────────────────────────────────

function Roads() {
  return (
    <>
      {ARTERIALS.map((a) => (
        <Line
          key={a.id}
          points={a.pts.map(([mx, my]) => {
            const [x, z] = toWorld(mx, my);
            return [x, 0.22, z] as [number, number, number];
          })}
          color="#1e4a44"
          transparent
          opacity={0.55}
          lineWidth={1.2}
        />
      ))}
      {/* Channel bank guide lights. */}
      {[CHANNEL.y1, CHANNEL.y2].map((my) => {
        const [x0, z] = toWorld(0, my);
        const [x1] = toWorld(CHANNEL.mouthX, my);
        return (
          <Line
            key={my}
            points={[
              [x0, 0.14, z],
              [x1, 0.14, z],
            ]}
            color="#155e56"
            transparent
            opacity={0.35}
            lineWidth={1}
          />
        );
      })}
    </>
  );
}

/** Counterparty Bridge: the low road crossing west of the Circuit's span. */
function CounterpartyBridge() {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(LANDMARKS.counterparty_bridge.x, LANDMARKS.counterparty_bridge.y);
  const span = (CHANNEL.y2 - CHANNEL.y1) * 0.5 + 8;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={1.1} material={surfaces.deck}>
        <boxGeometry args={[4.5, 0.4, span]} />
      </mesh>
      {[-1.9, 1.9].map((ox) => (
        <mesh key={ox} position={[ox, 1.42, 0]}>
          <boxGeometry args={[0.12, 0.08, span]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.35} />
        </mesh>
      ))}
      {[-5, 5].map((oz) => (
        <mesh key={oz} position={[0, 0.1, oz]} material={surfaces.deck}>
          <cylinderGeometry args={[0.5, 0.6, 2.4, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ── The seeded city fabric: one draw call of bodies, one of windows ──────────

function CityBlocks({ dim }: { dim: Record<DistrictId, number> }) {
  const surfaces = useSurfaces();
  const { lots, windows } = useMemo(() => buildSkyline(), []);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const dummy = new THREE.Object3D();
    lots.forEach((l, i) => {
      dummy.position.set(l.x, l.sy / 2, l.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(l.sx, l.sy, l.sz);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
  }, [lots]);

  useLayoutEffect(() => {
    const win = winRef.current;
    if (!win) return;
    const dummy = new THREE.Object3D();
    windows.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z);
      dummy.rotation.set(0, w.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      win.setMatrixAt(i, dummy.matrix);
    });
    win.instanceMatrix.needsUpdate = true;
  }, [windows]);

  // Colors follow the blackout state: a capped grid is a visibly darker city.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const win = winRef.current;
    if (!body || !win) return;
    const c = new THREE.Color();
    lots.forEach((l, i) => {
      c.set(BODY_TINT[l.district]).multiplyScalar(1 - (dim[l.district] ?? 0) * 0.5);
      body.setColorAt(i, c);
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    windows.forEach((w, i) => {
      const dd = dim[w.district] ?? 0;
      const ratio = (w.district === "exchange" ? 0.6 : 0.5) * (1 - dd * 0.92);
      c.set(w.threshold < ratio ? WINDOW_PALETTE[w.palette] : WINDOW_DARK);
      win.setColorAt(i, c);
    });
    if (win.instanceColor) win.instanceColor.needsUpdate = true;
  }, [lots, windows, dim]);

  return (
    <>
      {/* White material colour on purpose: the per-instance district tint set
          in setColorAt multiplies through it, so one triplanar material skins
          every lot in the city while each district keeps its own hue. */}
      <instancedMesh ref={bodyRef} args={[undefined, undefined, lots.length]} material={surfaces.block}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={winRef} args={[undefined, undefined, windows.length]}>
        <planeGeometry args={[0.6, 0.85]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

// ── The Exchange: one revenue tower per catalog seller ───────────────────────

function ExchangeTower({ t, dimE, reduced, crownLight }: {
  t: Tower; dimE: number; reduced: boolean; crownLight: boolean;
}) {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(t.x, t.y);
  const h = t.h * HEIGHT_SCALE;
  const w = t.w * 0.55;
  const glow = 1 - dimE * 0.85;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={h / 2} material={surfaces.tower}>
        <boxGeometry args={[w, h, w]} />
      </mesh>
      {/* Lit service cores on two facades. */}
      <mesh position={[w * 0.18, h / 2, w / 2 + 0.03]}>
        <planeGeometry args={[0.5, h * 0.86]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.5 * glow} />
      </mesh>
      <mesh position={[w / 2 + 0.03, h / 2, -w * 0.15]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.5, h * 0.82]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.4 * glow} />
      </mesh>
      {/* Crown: lit when the corp sold within 7 days. */}
      {t.lit ? (
        <Pulse speed={1.3} amp={0.1} reduced={reduced}>
          <mesh position-y={h + 0.35}>
            <boxGeometry args={[w * 0.72, 0.6, w * 0.72]} />
            <meshBasicMaterial color={ACCENT} />
          </mesh>
        </Pulse>
      ) : (
        <mesh position-y={h + 0.3}>
          <boxGeometry args={[w * 0.72, 0.5, w * 0.72]} />
          <meshStandardMaterial color="#2c3644" emissive={ACCENT} emissiveIntensity={0.12 * glow} roughness={0.8} metalness={0.3} />
        </mesh>
      )}
      {t.lit && crownLight && (
        <pointLight position={[0, h + 1.5, 0]} color={ACCENT} intensity={20 * glow} distance={30} decay={2} />
      )}
      <Html position={[0, h + 3.4, 0]} center distanceFactor={48} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: ACCENT }}>{t.seller}</p>
        </div>
      </Html>
    </group>
  );
}

// ── The Strip: one stall per live listing along Throughput Avenue ────────────

function Stall({ s, dimS, reduced }: { s: Storefront; dimS: number; reduced: boolean }) {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(s.x + s.w / 2, s.y + s.h / 2);
  const east = s.x < 210; // west column faces the avenue (east), and vice versa
  const signColor = s.service ? AMBER : ACCENT;
  const glow = 1 - dimS * 0.85;
  const sign = (
    <mesh position={[east ? 3.1 : -3.1, 3.0, 0]} rotation-y={east ? Math.PI / 2 : -Math.PI / 2}>
      <planeGeometry args={[4.2, 1.0]} />
      <meshBasicMaterial color={signColor} transparent opacity={0.8 * glow} side={THREE.DoubleSide} />
    </mesh>
  );
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={1.1} material={surfaces.stall}>
        <boxGeometry args={[6, 2.2, 4.2]} />
      </mesh>
      {/* Awning light over the doorway. */}
      <mesh position={[east ? 3.04 : -3.04, 1.9, 0]} rotation-y={east ? Math.PI / 2 : -Math.PI / 2}>
        <planeGeometry args={[3.6, 0.18]} />
        <meshBasicMaterial color="#f5c580" transparent opacity={0.55 * glow} side={THREE.DoubleSide} />
      </mesh>
      {/* Services burn brighter than shelf goods — same rule as the map. */}
      {s.service && !reduced ? (
        <Pulse speed={2.2} amp={0.06} reduced={reduced}>{sign}</Pulse>
      ) : (
        sign
      )}
    </group>
  );
}

// ── The Stacks: the hab slab — one window per registered agent ───────────────

function HabSlab({ habs, dimS }: { habs: HabField; dimS: number }) {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(HAB_SLAB.x, HAB_SLAB.y);
  const rows = habs.rows;
  const height = rows * 1.7 + 2.5;
  const depth = habs.cols * 1.5 + 2;
  const count = Math.min(habs.totalCells, habs.cols * rows);
  const litSet = useMemo(() => new Set(habs.litCells), [habs]);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const col = i % habs.cols;
      const row = Math.floor(i / habs.cols);
      dummy.position.set(
        x + 2.78,
        1.9 + (rows - 1 - row) * 1.7,
        z + (col - (habs.cols - 1) / 2) * 1.5
      );
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const lit = litSet.has(i);
      c.set(lit ? "#f5c06a" : "#141821");
      if (lit) c.multiplyScalar(Math.max(0.1, 1 - dimS * 0.9));
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [habs, litSet, dimS, x, z, count, rows]);

  return (
    <group>
      <mesh position={[x, height / 2, z]} material={surfaces.hab}>
        <boxGeometry args={[5.5, height, depth]} />
      </mesh>
      <mesh position={[x, height + 0.25, z]} material={surfaces.deck}>
        <boxGeometry args={[5.7, 0.5, depth + 0.2]} />
      </mesh>
      <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
        <planeGeometry args={[1.05, 1.15]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </instancedMesh>
      <pointLight position={[x + 8, 6, z]} color="#f5c06a" intensity={8 * (1 - dimS * 0.8)} distance={26} decay={2} />
    </group>
  );
}

// ── The Circuit: the elevated loop and its light traffic ─────────────────────

function CircuitLoop({ traffic }: { traffic: number }) {
  const surfaces = useSurfaces();
  const path = useMemo(() => circuitPath(), []);
  const segs = useMemo(() => {
    return path.pts.map((a, i) => {
      const b = path.pts[(i + 1) % path.pts.length];
      const horizontal = Math.abs(a[1] - b[1]) < 0.01;
      const len = path.segLen[i];
      return {
        cx: (a[0] + b[0]) / 2,
        cz: (a[1] + b[1]) / 2,
        horizontal,
        len,
        a,
        b,
      };
    });
  }, [path]);
  const stripOpacity = 0.22 + traffic * 0.5;
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.cx, CIRCUIT_HEIGHT, s.cz]}>
          <mesh material={surfaces.deck}>
            <boxGeometry args={s.horizontal ? [s.len, 0.5, 4.5] : [4.5, 0.5, s.len]} />
          </mesh>
          {[-2.1, 2.1].map((off) => (
            <mesh key={off} position={s.horizontal ? [0, 0.3, off] : [off, 0.3, 0]}>
              <boxGeometry args={s.horizontal ? [s.len, 0.08, 0.14] : [0.14, 0.08, s.len]} />
              <meshBasicMaterial color={ACCENT} transparent opacity={stripOpacity} />
            </mesh>
          ))}
          {/* Pylons every ~24 units — the channel crossings get bridge piers. */}
          {Array.from({ length: Math.max(1, Math.floor(s.len / 24)) }, (_, k) => {
            const f = (k + 0.5) / Math.max(1, Math.floor(s.len / 24));
            const px = s.a[0] + (s.b[0] - s.a[0]) * f - s.cx;
            const pz = s.a[1] + (s.b[1] - s.a[1]) * f - s.cz;
            return (
              <mesh key={k} position={[px, -CIRCUIT_HEIGHT / 2 - 0.2, pz]} material={surfaces.deck}>
                <cylinderGeometry args={[0.45, 0.6, CIRCUIT_HEIGHT + 1.2, 6]} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function CircuitTraffic({ traffic, reduced }: { traffic: number; reduced: boolean }) {
  const path = useMemo(() => circuitPath(), []);
  const count = 2 + Math.round(traffic * 10);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (!reduced) tRef.current = (tRef.current + dt * 0.014) % 1;
    for (let i = 0; i < count; i++) {
      const rev = i % 2 === 1;
      const base = (tRef.current * (rev ? -1 : 1) + i / count + 100) % 1;
      const p = circuitPointAt(path, base);
      const lane = rev ? -1.2 : 1.2;
      dummy.position.set(p.x - p.dz * lane, CIRCUIT_HEIGHT + 0.68, p.z + p.dx * lane);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.42, 8, 6]} />
      <meshBasicMaterial color="#9ff5e8" />
    </instancedMesh>
  );
}

// ── Dockyards: freight sleds in the Clearing Channel, cranes on the wharf ────

function FreightSleds({ plan, reduced }: { plan: CityPlan; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const drift = useRef(0);
  const [x0] = toWorld(6, CHANNEL.y1);
  const [x1] = toWorld(472, CHANNEL.y1);
  const span = x1 - x0;

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!reduced) drift.current = (drift.current + dt * 0.006) % 1;
    plan.sleds.forEach((s, i) => {
      const child = g.children[i];
      if (!child) return;
      const t = (s.along + drift.current) % 1;
      child.position.x = x0 + t * span;
    });
  });

  return (
    <group ref={group}>
      {plan.sleds.map((s, i) => {
        const [, zBase] = toWorld(0, 440);
        const z = zBase + (i % 2 === 0 ? -3 : 3);
        return (
          <group key={i} position={[x0 + s.along * span, -0.15, z]}>
            <mesh position-y={0.5}>
              <boxGeometry args={[5, 1, 2.2]} />
              <meshStandardMaterial color="#0d1117" flatShading roughness={0.9} />
            </mesh>
            <mesh position={[2.3, 0.85, 0]}>
              <sphereGeometry args={[0.22, 8, 6]} />
              <meshBasicMaterial color={ACCENT} />
            </mesh>
            <mesh position={[-2.3, 0.85, 0]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshBasicMaterial color={AMBER} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Crane({ mx, my, flip }: { mx: number; my: number; flip: boolean }) {
  const [x, z] = toWorld(mx, my);
  return (
    <group position={[x, 0, z]} rotation-y={flip ? Math.PI / 5 : -Math.PI / 6}>
      <mesh position-y={5}>
        <boxGeometry args={[0.9, 10, 0.9]} />
        <meshStandardMaterial color="#141a24" flatShading roughness={1} />
      </mesh>
      <mesh position={[3.4, 9.6, 0]}>
        <boxGeometry args={[8, 0.5, 0.6]} />
        <meshStandardMaterial color="#141a24" flatShading roughness={1} />
      </mesh>
      <mesh position={[6.6, 8.2, 0]}>
        <boxGeometry args={[0.08, 2.6, 0.08]} />
        <meshStandardMaterial color="#1c242f" roughness={1} />
      </mesh>
      <mesh position={[6.6, 6.7, 0]}>
        <boxGeometry args={[1.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#2a323e" flatShading roughness={1} metalness={0.2} />
      </mesh>
      <mesh position={[3.4, 9.95, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshBasicMaterial color={AMBER} />
      </mesh>
    </group>
  );
}

// ── The Mint: the city's pulse, visible from everywhere ──────────────────────

function MintIsland({ beam, reduced }: { beam: CityPlan["mintBeam"]; reduced: boolean }) {
  const [x, z] = toWorld(MINT_ISLAND.x, MINT_ISLAND.y);
  const steady = beam === "steady";
  const color = steady ? ACCENT : AMBER;
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const core = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!halo.current || !core.current) return;
    if (!steady && !reduced) {
      const t = state.clock.elapsedTime;
      const f = 0.35 + Math.max(0, Math.sin(t * 9) * Math.sin(t * 3.7)) * 0.65;
      halo.current.opacity = 0.13 * f;
      core.current.opacity = 0.5 * f;
    } else {
      halo.current.opacity = 0.13;
      core.current.opacity = 0.5;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position-y={-0.45}>
        <cylinderGeometry args={[MINT_ISLAND.r * 0.5, MINT_ISLAND.r * 0.58, 1.6, 20]} />
        <meshStandardMaterial color="#1c242e" flatShading roughness={1} metalness={0.15} />
      </mesh>
      {/* The Mint itself: a stepped vault. */}
      {[[5, 2], [3.4, 3.6], [2, 5]].map(([s, y], i) => (
        <mesh key={i} position-y={y as number}>
          <boxGeometry args={[s as number, 1.7, s as number]} />
          {/* Keeps its own material rather than a shared one: the vault's
              emissive tracks the live beam colour. Tint lifted to match the
              rest of the city so it stops reading as a black cutout. */}
          <meshStandardMaterial color="#2a3240" flatShading roughness={0.9} metalness={0.2} emissive={color} emissiveIntensity={0.08} />
        </mesh>
      ))}
      <mesh position-y={40}>
        <cylinderGeometry args={[0.6, 1.1, 76, 12, 1, true]} />
        <meshBasicMaterial ref={halo} color={color} transparent opacity={0.13} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position-y={40}>
        <cylinderGeometry args={[0.16, 0.3, 76, 8, 1, true]} />
        <meshBasicMaterial ref={core} color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 12, 0]} color={color} intensity={55} distance={80} decay={1.9} />
      <Html position={[0, 10.5, 0]} center distanceFactor={52} className="pointer-events-none">
        <p className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
          The Mint
        </p>
      </Html>
    </group>
  );
}

// ── The Foundry: the power district — plant glow tracks real inference load ──

function FoundryPlant({ load, dimF, reduced }: { load: number; dimF: number; reduced: boolean }) {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(FOUNDRY_PLANT.x, FOUNDRY_PLANT.y);
  const glow = Math.max(0.06, (0.25 + load * 0.75) * (1 - dimF));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.5, 0]} material={surfaces.works}>
        <boxGeometry args={[16, 7, 10]} />
      </mesh>
      <mesh position={[10, 2.5, 2]} material={surfaces.works}>
        <boxGeometry args={[8, 5, 7]} />
      </mesh>
      {/* Furnace seam. */}
      <mesh position={[0, 1.1, 5.03]}>
        <planeGeometry args={[12, 0.5]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.75 * glow} />
      </mesh>
      {[[-5, 12, 0.9], [0, 13.5, 1.0], [4.6, 11, 0.8]].map(([sx, sh, sr], i) => (
        <group key={i}>
          <mesh position={[sx, (sh as number) / 2 + 7, -2]} material={surfaces.works}>
            <cylinderGeometry args={[sr as number, (sr as number) * 1.25, sh as number, 8]} />
          </mesh>
          <Pulse speed={1.4} amp={0.12} phase={i * 1.7} reduced={reduced}>
            <mesh position={[sx, (sh as number) + 7.4, -2]}>
              <sphereGeometry args={[(sr as number) * 0.55, 8, 6]} />
              <meshBasicMaterial color="#fb923c" transparent opacity={Math.min(1, 0.5 + glow)} />
            </mesh>
          </Pulse>
        </group>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, 8]}>
        <planeGeometry args={[18, 9]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.05 + 0.2 * glow} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 4, 6]} color={AMBER} intensity={10 + 50 * glow} distance={48} decay={2} />
    </group>
  );
}

// ── Landmarks and civic memory ───────────────────────────────────────────────

function CustomHouse() {
  const surfaces = useSurfaces();
  const [x, z] = toWorld(LANDMARKS.custom_house.x, LANDMARKS.custom_house.y);
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={2.5} material={surfaces.hab}>
        <boxGeometry args={[9, 5, 7]} />
      </mesh>
      <mesh position-y={5.15}>
        <boxGeometry args={[9.3, 0.3, 7.3]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.4} />
      </mesh>
      {/* Settlement pier reaching into the channel. */}
      <mesh position={[0, 0.5, -6.5]}>
        <boxGeometry args={[3, 0.3, 8]} />
        <meshStandardMaterial color="#29313d" roughness={1} metalness={0.12} />
      </mesh>
      <Html position={[0, 7.6, 0]} center distanceFactor={52} className="pointer-events-none">
        <p className="whitespace-nowrap font-mono text-[9px] uppercase tracking-widest text-zinc-400">
          Custom House
        </p>
      </Html>
    </group>
  );
}

function RelayMast({ reduced }: { reduced: boolean }) {
  const [x, z] = toWorld(LANDMARKS.relay.x, LANDMARKS.relay.y);
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={12}>
        <cylinderGeometry args={[0.32, 0.8, 24, 6]} />
        <meshStandardMaterial color="#141a24" flatShading roughness={1} emissive={ACCENT} emissiveIntensity={0.08} />
      </mesh>
      {[7, 13, 19].map((y) => (
        <mesh key={y} position-y={y} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[1.3 - y * 0.03, 0.07, 6, 18]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.4} />
        </mesh>
      ))}
      <Pulse speed={2.4} amp={0.18} reduced={reduced}>
        <mesh position-y={24.6}>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshBasicMaterial color="#e9fbf7" />
        </mesh>
      </Pulse>
      <Html position={[0, 27.4, 0]} center distanceFactor={52} className="pointer-events-none">
        <p className="whitespace-nowrap font-mono text-[9px] uppercase tracking-widest text-zinc-400">
          The Relay
        </p>
      </Html>
    </group>
  );
}

/** Old Grid firsts: an obelisk per founding transaction in the ledger. */
function FirstsMonuments({ snap }: { snap: ArclightSnapshot }) {
  const firsts = snap.firsts.slice(0, FIRST_SITES.length);
  return (
    <>
      {firsts.map((f, i) => {
        const [x, z] = toWorld(FIRST_SITES[i][0], FIRST_SITES[i][1]);
        return (
          <group key={f.label} position={[x, 0, z]}>
            <mesh position-y={0.3}>
              <cylinderGeometry args={[1.6, 1.9, 0.6, 4]} />
              <meshStandardMaterial color="#131118" flatShading roughness={1} />
            </mesh>
            <mesh position-y={2.9}>
              <boxGeometry args={[1.1, 4.6, 1.1]} />
              <meshStandardMaterial color="#171420" flatShading roughness={0.9} emissive="#f5c580" emissiveIntensity={0.1} />
            </mesh>
            <mesh position-y={5.5}>
              <sphereGeometry args={[0.24, 8, 6]} />
              <meshBasicMaterial color="#f5c580" />
            </mesh>
            <Html position={[0, 7.2, 0]} center distanceFactor={44} className="pointer-events-none">
              <div className="whitespace-nowrap text-center font-mono">
                <p className="text-[9px] uppercase tracking-widest text-amber-200/80">{f.label}</p>
                <p className="text-[8px] text-zinc-500">{f.at.slice(0, 10)}</p>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

const DISTRICT_LABEL_Y: Record<DistrictId, number> = {
  stacks: 26, old_grid: 13, strip: 11, exchange: 32, dockyards: 12, foundry: 22,
};

function DistrictLabels() {
  return (
    <>
      {DISTRICTS.map((d) => {
        const [x, z] = toWorld(d.label[0], d.label[1]);
        return (
          <Html
            key={d.id}
            position={[x, DISTRICT_LABEL_Y[d.id], z]}
            center
            distanceFactor={58}
            className="pointer-events-none"
          >
            <div className="whitespace-nowrap text-center font-mono">
              <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-300/90">{d.name}</p>
              <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">{d.source}</p>
            </div>
          </Html>
        );
      })}
    </>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function ArclightCityCanvas({
  snap,
  reduced,
}: {
  snap: ArclightSnapshot;
  reduced: boolean;
}) {
  const plan = useMemo(() => buildCityPlan(snap), [snap]);
  const surfaces = useCitySurfaces(reduced);
  const [introDone, setIntroDone] = useState(false);
  // Forward renderers hate light piles: only the first few lit crowns get a
  // real point light — the rest glow through emissive + bloom.
  let crownLights = 0;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{
        // Down from [140, 95, 185]. That was 251 units out at 22 degrees above
        // the plate: a map camera, and from above nothing overlaps, so nothing
        // layers, so there is no depth to read. This sits just off the water at
        // about 6 degrees looking ACROSS the harbour at the skyline, which is
        // the composition every reference image of a city actually uses.
        position: [175, 30, 235],
        fov: 50,
        near: 0.5,
        far: 1200,
      }}
    >
      {/* Haze must be BRIGHTER than the things it hides. Aerial perspective is
          light scattered toward the camera, so a distant block goes pale and
          blue and separates from the one in front of it. The old #0a0d13 was
          darker than the buildings, which is only correct in vacuum — it
          dissolved the far half of the city into the background instead of
          layering it. The colour tracks the sky dome's horizon band so the far
          skyline dissolves into sky rather than cutting a hard edge on it. */}
      <fog attach="fog" args={["#0f252c", 210, 900]} />
      {/* These four numbers are the ones that were wrong. The surface pass
          lifted every structure to mid-tone and then, on the theory that the
          environment map would carry the fill, cut ambient nearly in half. But
          the map below was built out of near-blacks, so it carried almost no
          irradiance: total omnidirectional fill landed near 0.13, which turns
          RGB 42 concrete into RGB 5. The paint went up and the light went down.
          A night city is lit mostly from below and sideways by its own streets,
          so the hemisphere's GROUND colour is warm here on purpose. */}
      <hemisphereLight args={["#16283a", "#1a1208", 0.7]} />
      <ambientLight color="#8fa8bf" intensity={0.16} />
      <directionalLight color="#b8d4f0" intensity={0.45} position={[-220, 260, -140]} />

      {/* IBL, generated not fetched. The sky is a light source, so it has to
          own real luminance — the horizon band especially, since that is the
          city's own glow scattered back down onto every upward face. */}
      <SkyEnvironment
        top="#0a1420"
        horizon="#1d3f45"
        ground="#3a2a1c"
        glow="#2f7d72"
        glowY={-0.04}
        intensity={1.15}
      />
      {/* The same gradient again, this time visible. Replaces the flat
          background colour that gave the world no horizon to recede into. */}
      <SkyDome
        top="#04080f"
        horizon="#123037"
        ground="#060c10"
        glow="#17544e"
        glowY={-0.02}
        radius={900}
      />

      <MilkyWayBackdrop radius={520} />
      <Stars radius={480} depth={60} count={3000} factor={2.4} saturation={0.2} fade speed={reduced ? 0 : 0.25} />
      {/* The Bazaar's moon — brand terracotta, low on the horizon. */}
      <SkyWorld
        position={[320, 150, -300]}
        radius={30}
        palette={{ a: "#3a1f14", b: "#8a4a2e", dark: "#1c0f09" }}
        tint="#E8714C"
        seed={7}
        reduced={reduced}
      />

      <SurfaceContext.Provider value={surfaces}>
        <DarkPool />
        <DistantSkyline reduced={reduced} />
        <LandMass pts={LAND_NORTH} />
        <LandMass pts={LAND_SOUTH} />
        <Roads />
        <CounterpartyBridge />

        <CityBlocks dim={plan.dim} />
        {plan.towers.map((t) => {
          const withLight = t.lit && crownLights < 6;
          if (withLight) crownLights += 1;
          return (
            <ExchangeTower
              key={t.seller}
              t={t}
              dimE={plan.dim.exchange}
              reduced={reduced}
              crownLight={withLight}
            />
          );
        })}
        {plan.storefronts.map((s, i) => (
          <Stall key={`${s.name}-${i}`} s={s} dimS={plan.dim.strip} reduced={reduced} />
        ))}
        <HabSlab habs={plan.habs} dimS={plan.dim.stacks} />

        <CircuitLoop traffic={plan.traffic} />
        <CircuitTraffic traffic={plan.traffic} reduced={reduced} />
        <FreightSleds plan={plan} reduced={reduced} />
        {CRANE_SITES.map(([mx, my], i) => (
          <Crane key={i} mx={mx} my={my} flip={i % 2 === 1} />
        ))}

        <MintIsland beam={plan.mintBeam} reduced={reduced} />
        <FoundryPlant load={plan.load} dimF={plan.dim.foundry} reduced={reduced} />
        <CustomHouse />
        <RelayMast reduced={reduced} />
        <FirstsMonuments snap={snap} />
        <DistrictLabels />

        <Inhabitants world="arclight" reduced={reduced} />
      </SurfaceContext.Provider>

      <GroundMist color="#0f2a26" opacity={0.05} area={210} reduced={reduced} />
      <ParticleField mode="motes" color="#3d5a55" area={190} reduced={reduced} />
      {/* Was SceneFX bloom={0.85} — the single-number grade every world shared.
          WorldFX pulls Arclight's own entry out of the GRADE table instead. */}
      <WorldFX world="arclight" reduced={reduced} />

      <CinematicDescent
        from={[330, 250, 430]}
        target={[0, 5, 0]}
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
        maxDistance={400}
        maxPolarAngle={1.45}
        target={[0, 5, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.22}
      />
    </Canvas>
  );
}
