"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CrowdFigures, InstancedBlocks, type Block } from "@/components/v2/latent/world-kit";
import { makeRoute, type Route, type RouteWalker } from "@/lib/worlds/routes";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import { duneHeight } from "@/lib/palimpsest/terrain";
import {
  AXIS_X,
  COLUMN_H,
  COLUMN_R,
  MASSES,
  NAMED_BOARDS,
  PAD_Y,
  QUADS,
  buildBeams,
  buildColumns,
  buildHungBoards,
  buildKerb,
  buildMassDetail,
  buildRoutes,
  buildSteps,
  buildTables,
  crowdSize,
  debateCircles,
  folioHue,
  type Board,
} from "@/lib/palimpsest/campus";
import type { PalimpsestState } from "./usePalimpsestLive";
import type { PalimpsestSurfaces } from "./surfaces";

// ── The field school ─────────────────────────────────────────────────────────
//
// Everything positional comes from lib/palimpsest/campus, which is pure and
// test-guarded; this file only turns those numbers into meshes. Every number
// RENDERED as text comes from the live state payload — the standing question,
// the thesis count, recovered fragments, translator credits. Nothing on a board
// is invented, which is the only reason a campus of scenery is allowed to sit
// on top of an honestly-empty dig.
//
// Draw-call discipline: columns, beams, steps, kerb, tables and hung boards are
// each one instanced mesh. The three buildings and the four named boards are
// the only individual meshes, and only the named boards carry an Html overlay.

const STONE = "#6b5f47";
const STONE_LIT = "#8a7a5c";
const STONE_DARK = "#3a3020";
const PAVING = "#584e3a";
const LAMP = "#f0c05a";
const SAND = "#cbb27e";

// ── Writing, as a texture ────────────────────────────────────────────────────

/**
 * Abstract ruled writing for board faces.
 *
 * Deliberately not letterforms. At the distance these are seen, real glyphs
 * would either be illegible (and so no better than this) or would have to be an
 * Html overlay per board, and twenty overlays fight the canvas instead of
 * filling it. Ruled lines with broken runs read as "written on" from anywhere,
 * which is the whole job.
 */
function makeGlyphTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;

  g.fillStyle = "#000000";
  g.fillRect(0, 0, c.width, c.height);

  // Nine ruled lines of broken runs. Seeded by hand so every board that shares
  // this texture shares the same "hand" — one scriptorium, one house style.
  let seed = 0x51ed;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  g.fillStyle = "#ffffff";
  for (let row = 0; row < 9; row++) {
    const y = 4 + row * 6.4;
    let x = 4 + rand() * 6;
    while (x < c.width - 6) {
      const run = 3 + rand() * 13;
      g.fillRect(x, y, run, 2);
      x += run + 2 + rand() * 5;
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ── Ground ───────────────────────────────────────────────────────────────────

/** The terrace deck and the paved quads. Flat by construction: duneHeight
 *  returns exactly PAD_Y everywhere inside the pad, so nothing floats. */
function Terrace({ sf }: { sf: PalimpsestSurfaces }) {
  const quads = useMemo<Block[]>(
    () =>
      QUADS.map((q) => ({
        p: [q.cx, PAD_Y + 0.06, q.cz] as [number, number, number],
        s: [q.w, 0.12, q.d] as [number, number, number],
        c: PAVING,
      })),
    []
  );
  // The axial walk, running past both quads to the terrace edges.
  const walk = useMemo<Block[]>(
    () => [{ p: [AXIS_X, PAD_Y + 0.08, 66], s: [5.5, 0.16, 60], c: STONE }],
    []
  );
  const kerb = useMemo<Block[]>(
    () =>
      buildKerb().map((b) => ({
        p: [b.x, b.y, b.z] as [number, number, number],
        s: [b.w, b.h, b.d] as [number, number, number],
        c: STONE_DARK,
      })),
    []
  );
  return (
    <>
      <InstancedBlocks blocks={quads} color="#ffffff" material={sf.stoneInstanced} />
      <InstancedBlocks blocks={walk} color="#ffffff" material={sf.stoneInstanced} />
      <InstancedBlocks blocks={kerb} color="#ffffff" material={sf.stoneInstanced} />
    </>
  );
}

// ── Architecture ─────────────────────────────────────────────────────────────

function Columns({ sf }: { sf: PalimpsestSurfaces }) {
  const cols = useMemo(() => buildColumns(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    cols.forEach((c, i) => {
      d.position.set(c.x, PAD_Y + c.h / 2, c.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [cols]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, cols.length]}
      material={sf.stone}
    >
      <cylinderGeometry args={[COLUMN_R * 0.88, COLUMN_R, COLUMN_H, 8]} />
    </instancedMesh>
  );
}

function Beams({ sf }: { sf: PalimpsestSurfaces }) {
  const blocks = useMemo<Block[]>(
    () =>
      buildBeams().map((b) => ({
        p: [b.x, b.y, b.z] as [number, number, number],
        s: [b.w, b.h, b.d] as [number, number, number],
      })),
    []
  );
  return <InstancedBlocks blocks={blocks.map((b) => ({ ...b, c: STONE }))} color="#ffffff" material={sf.stoneInstanced} />;
}

function Steps({ sf }: { sf: PalimpsestSurfaces }) {
  const blocks = useMemo<Block[]>(
    () =>
      buildSteps().map((b) => ({
        p: [b.x, b.y, b.z] as [number, number, number],
        s: [b.w, b.h, b.d] as [number, number, number],
      })),
    []
  );
  return <InstancedBlocks blocks={blocks.map((b) => ({ ...b, c: STONE_LIT }))} color="#ffffff" material={sf.stoneInstanced} />;
}

function Tables({ sf }: { sf: PalimpsestSurfaces }) {
  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    for (const t of buildTables()) {
      out.push({
        p: [t.x, t.y + 0.42, t.z],
        s: [t.w, 0.16, t.d],
        ry: t.ry,
        c: STONE_LIT,
      });
      // Two trestles, so a table has legs rather than hovering.
      for (const s of [-1, 1]) {
        out.push({
          p: [t.x + Math.cos(t.ry ?? 0) * s * t.w * 0.36, t.y + 0.05, t.z - Math.sin(t.ry ?? 0) * s * t.w * 0.36],
          s: [0.3, 0.86, t.d * 0.8],
          ry: t.ry,
          c: STONE_DARK,
        });
      }
    }
    return out;
  }, []);
  return <InstancedBlocks blocks={blocks} color="#ffffff" material={sf.stoneInstanced} />;
}

/**
 * The three buildings. Each gets a plinth, a body, a cornice and a run of
 * window slots, because a plain box at this scale reads as a crate — and the
 * slots are cut as recessed dark panels rather than emissive rectangles, so a
 * building at night is a silhouette with lit openings and not a lightbox.
 */
function Buildings({ sf }: { sf: PalimpsestSurfaces }) {
  // Plinths and cornices take the stone tint; window slots split into dark
  // openings and lit rooms. Which rooms are lit is seeded off the slot's own
  // position, so it is stable across renders — a window that flickers between
  // lit and dark every frame is worse than no windows at all.
  const { stonework, dark, lit } = useMemo(() => {
    const stonework: Block[] = [];
    const dark: Block[] = [];
    const lit: Block[] = [];
    for (const b of buildMassDetail()) {
      const block: Block = {
        p: [b.x, b.y, b.z] as [number, number, number],
        s: [b.w, b.h, b.d] as [number, number, number],
      };
      if (b.part === "window") {
        const r = mulberry32(hashStr(`pal-win-${b.x.toFixed(2)}-${b.y.toFixed(2)}-${b.z.toFixed(2)}`))();
        // A third of the rooms are still being read in. A campus lit end to
        // end at night would be claiming a night shift nobody is working.
        (r < 0.34 ? lit : dark).push(block);
      } else {
        stonework.push({ ...block, c: b.part === "plinth" ? STONE_DARK : STONE });
      }
    }
    return { stonework, dark, lit };
  }, []);

  return (
    <>
      {MASSES.map((m) => (
        <mesh key={m.id} position={[m.x, PAD_Y + m.h / 2, m.z]} material={sf.stone}>
          <boxGeometry args={[m.w, m.h, m.d]} />
        </mesh>
      ))}
      <InstancedBlocks blocks={stonework} color="#ffffff" material={sf.stoneInstanced} />
      <InstancedBlocks blocks={dark} color="#1c160d" roughness={0.95} metalness={0} />
      {/* Lit rooms. Unlit-by-tone-mapping emissive so they survive the grade
          and bloom rather than being crushed by the night vignette. */}
      <InstancedBlocks
        blocks={lit}
        color="#2a2012"
        emissive={LAMP}
        emissiveIntensity={1.6}
        roughness={0.6}
        metalness={0}
      />
    </>
  );
}

// ── Boards ───────────────────────────────────────────────────────────────────

function HungBoards({ glyph }: { glyph: THREE.Texture | null }) {
  const boards = useMemo(() => buildHungBoards(), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    boards.forEach((b, i) => {
      d.position.set(b.x, b.y, b.z);
      d.rotation.set(0, b.ry, 0);
      d.scale.set(b.w, b.h, 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.set(folioHue(b.folio)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [boards]);

  if (boards.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, boards.length]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        side={THREE.DoubleSide}
        roughness={0.75}
        emissive="#ffffff"
        emissiveIntensity={0.5}
        {...(glyph ? { map: glyph, emissiveMap: glyph } : {})}
      />
    </instancedMesh>
  );
}

/** A named board: a lit face, a frame, and real text on it. */
function NamedBoard({
  board,
  glyph,
  children,
}: {
  board: Board;
  glyph: THREE.Texture | null;
  children: React.ReactNode;
}) {
  const hue = folioHue(board.folio);
  return (
    <group position={[board.x, board.y, board.z]} rotation-y={board.ry}>
      {/* The slab the text is posted on. Its front face must clear the posted
          plane — flush would put two surfaces at the same depth and the board
          would flicker exactly like the roofs did. */}
      <mesh position-z={-0.16}>
        <boxGeometry args={[board.w + 0.5, board.h + 0.5, 0.28]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.95} />
      </mesh>
      <mesh>
        <planeGeometry args={[board.w, board.h]} />
        <meshStandardMaterial
          color={hue}
          side={THREE.DoubleSide}
          roughness={0.7}
          emissive={hue}
          emissiveIntensity={0.45}
          {...(glyph ? { map: glyph, emissiveMap: glyph } : {})}
        />
      </mesh>
      <Html
        position={[0, 0, 0.2]}
        center
        distanceFactor={26}
        occlude={false}
        className="pointer-events-none select-none"
      >
        <div
          className="whitespace-pre-line text-center font-mono leading-snug"
          style={{ width: `${board.w * 15}px` }}
        >
          {children}
        </div>
      </Html>
    </group>
  );
}

function CampusBoards({ state, glyph }: { state: PalimpsestState; glyph: THREE.Texture | null }) {
  const byId = useMemo(() => Object.fromEntries(NAMED_BOARDS.map((b) => [b.id, b])), []);
  const { excavation, symposium, unlocked_sites } = state;

  // Recovered text, newest site first, capped at what fits on a board. Only
  // ever from sites the ledger says are open.
  const fragments = useMemo(
    () =>
      unlocked_sites
        .flatMap((s) => s.fragments.map((f) => ({ ...f, site: s.name })))
        .sort((a, b) => b.leaf - a.leaf)
        .slice(0, 3),
    [unlocked_sites]
  );
  const credits = useMemo(
    () => unlocked_sites.filter((s) => s.credited_to).slice(0, 4),
    [unlocked_sites]
  );

  const closes = useMemo(() => {
    const ms = new Date(symposium.closes_at).getTime() - Date.now();
    if (!Number.isFinite(ms)) return null;
    const days = Math.ceil(ms / 86_400_000);
    return days > 1 ? `${days} days left` : days === 1 ? "closes tomorrow" : "closing";
  }, [symposium.closes_at]);

  return (
    <>
      {/* THEORIZING — the standing question, at the head of the axis. */}
      <NamedBoard board={byId.question} glyph={glyph}>
        <p className="text-[7px] uppercase tracking-[0.3em]" style={{ color: "#8a7a5c" }}>
          the standing question
        </p>
        <p className="mt-1.5 text-[10px]" style={{ color: "#f4e6c4" }}>
          {symposium.question}
        </p>
        <p className="mt-1.5 text-[7px] uppercase tracking-[0.2em]" style={{ color: "#8a7a5c" }}>
          {symposium.week}
          {closes ? ` · ${closes}` : ""}
        </p>
      </NamedBoard>

      {/* CHALLENGING — the board is nearly empty, and that is the true reading. */}
      <NamedBoard board={byId.contested} glyph={glyph}>
        <p className="text-[7px] uppercase tracking-[0.3em]" style={{ color: "#8a7a5c" }}>
          contested
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "#f4e6c4" }}>
          {excavation.theses_total} {excavation.theses_total === 1 ? "thesis" : "theses"} filed
        </p>
        <p className="mt-1 text-[7.5px] leading-relaxed" style={{ color: "#a1906c" }}>
          {excavation.next
            ? `${excavation.next.needs} more opens ${excavation.next.name}`
            : "every site is open"}
          {"\n"}
          {excavation.vault.needs} to unseal the Colophon
        </p>
      </NamedBoard>

      {/* SHARING — what has actually been recovered, and from where. */}
      <NamedBoard board={byId.long} glyph={glyph}>
        <p className="text-[7px] uppercase tracking-[0.3em]" style={{ color: "#8a7a5c" }}>
          recovered
        </p>
        {fragments.length === 0 ? (
          <p className="mt-1 text-[8px]" style={{ color: "#a1906c" }}>
            nothing read yet
          </p>
        ) : (
          fragments.map((f) => (
            <p key={`${f.site}-${f.leaf}`} className="mt-1 text-[7.5px] leading-snug" style={{ color: "#e8d9b4" }}>
              <span style={{ color: "#8a7a5c" }}>L.{f.leaf}</span> {f.text}
            </p>
          ))
        )}
      </NamedBoard>

      {/* DOCUMENTING — the ledger: who filed, and what it opened. */}
      <NamedBoard board={byId.register} glyph={glyph}>
        <p className="text-[7px] uppercase tracking-[0.3em]" style={{ color: "#8a7a5c" }}>
          the register
        </p>
        {credits.length === 0 ? (
          <p className="mt-1 text-[8px]" style={{ color: "#a1906c" }}>
            no translator credited
          </p>
        ) : (
          credits.map((s) => (
            <p key={s.name} className="mt-1 text-[7.5px] leading-snug" style={{ color: "#e8d9b4" }}>
              {s.name}
              {"\n"}
              <span style={{ color: "#8a7a5c" }}>tr. {s.credited_to?.agent_name.slice(0, 20)}</span>
            </p>
          ))
        )}
      </NamedBoard>
    </>
  );
}

// ── People ───────────────────────────────────────────────────────────────────

/**
 * Standing rings facing inward.
 *
 * This is the image the brief actually asked for — agents challenging each
 * other, not agents commuting. Walkers alone make a campus read as a concourse,
 * so the rings carry the argument and the walkers carry the traffic. Bodies here
 * are static apart from a slow lean, which costs one matrix write per figure per
 * frame and stops on reduced motion.
 */
function DebateRings({ survey24h, reduced }: { survey24h: number; reduced: boolean }) {
  const spots = useMemo(() => debateCircles(survey24h), [survey24h]);
  const figures = useMemo(() => {
    const out: { x: number; z: number; face: number; phase: number; tint: number }[] = [];
    spots.forEach((c, ci) => {
      for (let i = 0; i < c.n; i++) {
        const a = (i / c.n) * Math.PI * 2 + ci * 0.7;
        out.push({
          x: c.x + Math.cos(a) * c.r,
          z: c.z + Math.sin(a) * c.r,
          // Face the middle of the ring.
          face: Math.atan2(-Math.cos(a), -Math.sin(a)),
          phase: ci * 1.9 + i * 0.8,
          tint: (ci * 3 + i) % 9,
        });
      }
    });
    return out;
  }, [spots]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.6, 0.46, 1.8, 7);
    body.translate(0, 0.9, 0);
    const head = new THREE.OctahedronGeometry(0.37, 0);
    head.translate(0, 2.05, 0);
    return { body, head };
  }, []);
  useLayoutEffect(
    () => () => {
      geo.body.dispose();
      geo.head.dispose();
    },
    [geo]
  );

  useLayoutEffect(() => {
    const col = new THREE.Color();
    for (const mesh of [bodyRef.current, headRef.current]) {
      if (!mesh) continue;
      figures.forEach((f, i) => {
        // Scholars wear the colour of the age they work on.
        col.set(folioHue(f.tint + 1)).lerp(new THREE.Color(SAND), 0.45);
        mesh.setColorAt(i, col);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [figures]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const t = reduced ? 0 : clock.getElapsedTime();
    for (let i = 0; i < figures.length; i++) {
      const f = figures[i];
      // A listener shifts their weight; a speaker leans in. Small, slow, and
      // enough to stop a ring reading as a set of posts.
      const sway = Math.sin(t * 0.7 + f.phase) * 0.05;
      dummy.position.set(f.x, duneHeight(f.x, f.z), f.z);
      dummy.rotation.set(sway * 0.6, f.face + sway, 0);
      dummy.scale.setScalar(0.92);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      head.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  if (figures.length === 0) return null;
  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, figures.length]} geometry={geo.body}>
        <meshStandardMaterial color="#ffffff" flatShading roughness={0.8} emissive="#2a2114" emissiveIntensity={0.4} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, figures.length]} geometry={geo.head}>
        <meshStandardMaterial color="#ffffff" flatShading roughness={0.8} emissive="#2a2114" emissiveIntensity={0.4} />
      </instancedMesh>
    </>
  );
}

interface Scholar extends RouteWalker {
  folio: number;
}

/** Walkers on the campus routes. Population from real lounge traffic, with a
 *  floor — see crowdSize, which is where that decision is documented. */
function Scholars({ survey24h, reduced }: { survey24h: number; reduced: boolean }) {
  const routes = useMemo<Route[]>(
    () => buildRoutes().map((r) => makeRoute(r.pts, r.loop)),
    []
  );
  const bodies = useMemo<Scholar[]>(() => {
    const n = crowdSize(survey24h);
    // Weighted so the axis and the quad perimeter carry most of the traffic —
    // an open campus should look busiest where it is most open.
    const weights = [3, 3, 2, 1, 1, 1, 1];
    const bag: number[] = [];
    weights.forEach((w, i) => {
      for (let k = 0; k < w; k++) bag.push(i);
    });
    return Array.from({ length: n }, (_, i) => {
      const route = bag[i % bag.length];
      return {
        route,
        offset: (i * 7.31) % Math.max(1, routes[route].length),
        speed: 1.5 + ((i * 37) % 11) * 0.11,
        lane: (((i * 13) % 7) / 7 - 0.5) * 2.6,
        phase: (i * 1.7) % (Math.PI * 2),
        folio: (i % 9) + 1,
      };
    });
  }, [survey24h, routes]);

  const tint = useMemo(() => {
    const cache = bodies.map((b) =>
      new THREE.Color(folioHue(b.folio)).lerp(new THREE.Color(SAND), 0.5)
    );
    return (i: number) => cache[i] ?? new THREE.Color(SAND);
  }, [bodies]);

  return (
    <CrowdFigures
      routes={routes}
      bodies={bodies}
      tint={tint}
      scale={0.92}
      emissive="#2a2114"
      emissiveIntensity={0.45}
      lamp={LAMP}
      groundY={duneHeight}
      reduced={reduced}
    />
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function Campus({
  state,
  reduced,
  sf,
}: {
  state: PalimpsestState;
  reduced: boolean;
  sf: PalimpsestSurfaces;
}) {
  const glyph = useMemo(() => makeGlyphTexture(), []);
  useLayoutEffect(() => () => glyph?.dispose(), [glyph]);

  const survey = state.survey_teams_24h;

  return (
    <group>
      <Terrace sf={sf} />
      <Buildings sf={sf} />
      <Columns sf={sf} />
      <Beams sf={sf} />
      <Steps sf={sf} />
      <Tables sf={sf} />
      <HungBoards glyph={glyph} />
      <CampusBoards state={state} glyph={glyph} />
      <DebateRings survey24h={survey} reduced={reduced} />
      <Scholars survey24h={survey} reduced={reduced} />

      {/* Four lamps, no more: this is a forward renderer and the boards carry
          their own emissive. Placed on the axis so the open ground is the lit
          ground and the flanks fall away into the dig. */}
      <pointLight position={[AXIS_X, 7, 44]} color={LAMP} intensity={26} distance={46} decay={2} />
      <pointLight position={[AXIS_X, 7, 64]} color={LAMP} intensity={26} distance={46} decay={2} />
      <pointLight position={[AXIS_X, 7, 84]} color={LAMP} intensity={22} distance={42} decay={2} />
      <pointLight position={[AXIS_X, 12, 40]} color="#f4e6c4" intensity={14} distance={30} decay={2} />
    </group>
  );
}
