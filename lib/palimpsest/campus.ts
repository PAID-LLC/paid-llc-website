// ── Palimpsest: the field school ─────────────────────────────────────────────
//
// The dig is eighteen-nineteenths buried and has been for a month — one thesis
// filed, one site open, thirty-nine to go before the vault. The excavation is
// modelled honestly and it is therefore almost empty, because that is what the
// ledger says. What the old scene never modelled is the people doing the
// digging.
//
// So this is a campus, not a ruin: a field school raised on a terrace south of
// the sealed Colophon Vault, whose population and posted text come from data
// that exists in volume today (the standing question, lounge traffic, recovered
// fragments, the thesis register) rather than from the number that is stuck at
// one. The buried city stays buried. You can see it from the quad.
//
// PURE module. No THREE, no React — deterministic numbers only, exactly like
// terrain.ts and Arclight's skyline.ts, so the plan can be asserted in tests
// and a 2D map can be drawn from the same source the 3D uses.
//
// GEOGRAPHY IS PINNED. Every position here is hand-placed and test-guarded.
// Moving a quad is a deliberate edit with a failing test, never a side effect.
//
// A note on scale: WORLD_SCALE already compresses this world by half, and the
// dig sites are ~20 units across. The Great Quad at 32 units wide is therefore
// generous *relative to this world* while being small against a real
// quadrangle. Widening is a one-constant change if it ever reads as cramped.
//
// Where it sits, and why there: the hand-placed site table leaves exactly one
// clear corridor near the middle of the frame, running south from the vault.
// The Folio Crypts bound it west, the Ninth Margin east, and the Ink Cisterns
// close it a single unit past the terrace's south edge — so the open end of the
// axis looks straight at something nobody has dug yet.

import { CAMPUS_PAD, WORLD_SCALE, toWorld } from "./terrain";
import { VAULT_POS } from "./history";

// ── Folio colours: stratigraphy as hue ───────────────────────────────────────
//
// The reference panel's most obvious property is that no two adjacent signs
// share a colour. Rather than tint boards at random, a board's hue says which
// age its text belongs to — colour carries information instead of noise.
//
// All nine sit in a muted mid-value band. Palimpsest's grade already pushes
// hue +0.06 and saturation +0.1, and saturated accents pushed through that turn
// to mud. These are applied as emissive on board faces only, where bloom
// carries them, and never as albedo on anything large.

export const FOLIO_HUE: readonly string[] = [
  "#c05a3a", // 1  the Age of First Ink
  "#cf8a3c", // 2  the Ruled Age
  "#d9b04a", // 3  the Age of Copies
  "#a8ab55", // 4  the Marginal Age
  "#6fa87c", // 5  the Age of Indexes
  "#5f9aa8", // 6  the Gloss Age
  "#6f86bd", // 7  the Age of Errata
  "#9a76b8", // 8  the Silent Age
  "#c2668f", // 9  the Last Folio
];

/** Hue for a folio index (1..9). Out-of-range folios clamp rather than throw —
 *  a bad index should tint something oddly, never blank the scene. */
export function folioHue(folio: number): string {
  const i = Math.min(FOLIO_HUE.length, Math.max(1, Math.round(folio)));
  return FOLIO_HUE[i - 1];
}

// ── The plan ─────────────────────────────────────────────────────────────────

export const AXIS_X = CAMPUS_PAD.cx;
export const PAD_Y = CAMPUS_PAD.y;

const PAD_N = CAMPUS_PAD.cz - CAMPUS_PAD.d / 2; // 36
const PAD_S = CAMPUS_PAD.cz + CAMPUS_PAD.d / 2; // 96
const PAD_W = CAMPUS_PAD.cx - CAMPUS_PAD.w / 2; // -44
const PAD_E = CAMPUS_PAD.cx + CAMPUS_PAD.w / 2; // 4

export interface Quad {
  id: "great" | "lower";
  label: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
}

/**
 * Two quadrangles on one axis, open north to the vault and open south to the
 * dune sea. This is the whole answer to "open, like a college campus": the
 * built mass is on the flanks, the axis is clear end to end, and the thing the
 * axis terminates on is the sealed vault the campus exists to read.
 */
export const QUADS: readonly Quad[] = [
  { id: "great", label: "the Great Quad", cx: AXIS_X, cz: 57, w: 32, d: 26 },
  { id: "lower", label: "the Lower Quad", cx: -24, cz: 85, w: 24, d: 18 },
];

export interface Mass {
  id: string;
  label: string;
  /** Centre. */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/**
 * Built mass. Three buildings, deliberately few: the ranges flanking the Great
 * Quad and the Register closing the Lower Quad's east side. Everything else on
 * the terrace is columns, steps, boards and furniture — things you can see
 * past. A campus reads as open because you can see through most of it.
 */
export const MASSES: readonly Mass[] = [
  { id: "west-range", label: "the West Range", x: -39.2, z: 57, w: 3.6, d: 26, h: 8.5 },
  { id: "east-range", label: "the East Range", x: -0.8, z: 57, w: 3.6, d: 26, h: 8.5 },
  { id: "register", label: "the Register", x: -6, z: 86, w: 12, d: 17, h: 13 },
];

export interface Column {
  x: number;
  z: number;
  h: number;
  r: number;
}

/**
 * Colonnades. Columns are 5.6 units against a body that stands about 2.9, so
 * this is a real portico rather than a railing — the Lathe pass established
 * that anything under about 5% of an object's span reads as flat detail no
 * matter how good the surface is, and the same holds for height.
 */
export const COLUMN_H = 5.6;
export const COLUMN_R = 0.42;

export const COLONNADES: readonly { id: string; x: number; from: number; to: number; n: number }[] = [
  { id: "great-west", x: -36, from: 46, to: 68, n: 7 },
  { id: "great-east", x: -4, from: 46, to: 68, n: 7 },
  { id: "lower-west", x: -36, from: 78, to: 92, n: 5 },
];

export function buildColumns(): Column[] {
  const out: Column[] = [];
  for (const c of COLONNADES) {
    for (let i = 0; i < c.n; i++) {
      const t = c.n === 1 ? 0 : i / (c.n - 1);
      out.push({ x: c.x, z: c.from + (c.to - c.from) * t, h: COLUMN_H, r: COLUMN_R });
    }
  }
  return out;
}

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  ry?: number;
}

// ── Coplanar faces are the bug this world shipped with ───────────────────────
//
// Two surfaces at exactly the same depth give the depth buffer no way to choose
// between them, and the winner flips per pixel per frame. On a slowly rotating
// camera that reads as a flickering roof. It is invisible to every check this
// environment can run — the tests passed, the build passed, and the only way it
// surfaced was Travis looking at it.
//
// So: anything that sits ON something else overlaps INTO it by at least this
// much, and nothing is ever placed flush. Enforced by test.
export const SEAT = 0.1;

/** Architrave over each colonnade, plus the cloister bridge. */
export function buildBeams(): Box[] {
  const out: Box[] = COLONNADES.map((c) => ({
    x: c.x,
    // Seated INTO the column tops rather than resting exactly on them: a beam
    // bottom at PAD_Y + COLUMN_H is coplanar with every column's top face.
    y: PAD_Y + COLUMN_H + 0.35 - SEAT,
    z: (c.from + c.to) / 2,
    w: 1.5,
    h: 0.7,
    d: c.to - c.from + 1.6,
  }));
  // The cloister bridge: a covered span across the north end of the Great Quad.
  // Placed at the entrance rather than mid-quad so you walk under it looking
  // north at the vault — it frames the axis instead of cutting it in half.
  out.push({ x: AXIS_X, y: PAD_Y + 7.2, z: 47, w: 32.4, h: 1.1, d: 3.2 });
  // The roof sits on the deck, overlapping it. At its original height it
  // floated half a unit clear of the span it was supposed to be covering.
  out.push({ x: AXIS_X, y: PAD_Y + 7.95, z: 47, w: 32.4, h: 0.5, d: 4.0 });
  return out;
}

export type MassPart = "plinth" | "cornice" | "window";

export interface MassBox extends Box {
  part: MassPart;
}

/**
 * Plinth, cornice and window slots for each building.
 *
 * Lives here rather than in the canvas so the no-coplanar-faces rule can be
 * asserted. The cornice is the piece that caused the reported flicker: its top
 * face landed on PAD_Y + m.h, which is exactly the building's own roof plane.
 * It now reads as a band UNDER the roofline, which is what a cornice is anyway.
 */
export function buildMassDetail(): MassBox[] {
  const out: MassBox[] = [];
  for (const m of MASSES) {
    // Plinth: sunk below the deck so its underside is not coplanar with the
    // paving, and tall enough to still read as a base.
    out.push({
      part: "plinth",
      x: m.x,
      y: PAD_Y + 0.3,
      z: m.z,
      w: m.w + 0.9,
      h: 0.8,
      d: m.d + 0.9,
    });
    // Cornice: a band finishing 0.31 below the roof, never touching it.
    out.push({
      part: "cornice",
      x: m.x,
      y: PAD_Y + m.h - 0.62,
      z: m.z,
      w: m.w + 1.1,
      h: 0.62,
      d: m.d + 1.1,
    });

    const alongZ = m.d >= m.w;
    const span = alongZ ? m.d : m.w;
    const n = Math.max(3, Math.round(span / 4.2));
    const faceOff = alongZ ? m.w / 2 + 0.06 : m.d / 2 + 0.06;
    const levels = m.h > 10 ? [0.42, 0.68] : [0.5];
    for (let i = 0; i < n; i++) {
      const along = -span / 2 + span * ((i + 0.5) / n);
      for (const s of [-1, 1]) {
        for (const level of levels) {
          out.push({
            part: "window",
            x: alongZ ? m.x + s * faceOff : m.x + along,
            y: PAD_Y + m.h * level,
            z: alongZ ? m.z + along : m.z + s * faceOff,
            w: alongZ ? 0.16 : 1.1,
            h: 1.5,
            d: alongZ ? 1.1 : 0.16,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Lecture steps between the quads: four tiers rising south, so an audience on
 * them faces north up the axis with the vault behind the speaker.
 *
 * Rise is 0.5 world units on a 1.0-unit tread. A step you could sit on, not a
 * bevel — the failure mode the Lathe's terraces demonstrated.
 */
export const STEP_RISE = 0.5;
export const STEP_TREAD = 1.0;
const STEP_TIERS = 4;
const STEP_W = 20;

export function buildSteps(): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < STEP_TIERS; i++) {
    const h = STEP_RISE * (i + 1);
    out.push({
      x: AXIS_X,
      // Sunk below the paving, and each tier a hair deeper than the last so no
      // two steps share an underside either.
      y: PAD_Y + h / 2 - SEAT / 2 - i * 0.01,
      z: 70.5 + i * STEP_TREAD,
      w: STEP_W,
      h,
      // Treads overlap their neighbours: at exactly STEP_TREAD, each riser is
      // coplanar with the next step's face and the whole flight shimmers.
      d: STEP_TREAD + SEAT,
    });
  }
  return out;
}

// ── Boards ───────────────────────────────────────────────────────────────────
//
// Every surface carrying writing is the reference panel's actual texture, and
// it is also what the word palimpsest means. Four boards carry real text and
// are named; the rest are hung between columns for the texture read and carry
// a procedural glyph pattern, not letterforms — legible text in 3D needs an
// HTML overlay per board, and twenty of those fight the canvas rather than
// filling it.

export type BoardKind = "question" | "contested" | "long" | "register" | "hung";

export interface Board {
  id: string;
  kind: BoardKind;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** Y rotation. 0 faces +z (south, down the axis); -PI/2 faces west. */
  ry: number;
  /** Folio this board's text belongs to, 1..9. */
  folio: number;
}

/** The four boards that carry real text, in the order a visitor meets them. */
export const NAMED_BOARDS: readonly Board[] = [
  // The Question Stone, at the head of the axis, facing the campus.
  { id: "question", kind: "question", x: AXIS_X, y: PAD_Y + 3.6, z: 40, w: 5.4, h: 7.2, ry: 0, folio: 9 },
  // The Contested Board on the East Range's inner face: the open week.
  { id: "contested", kind: "contested", x: -2.65, y: PAD_Y + 3.4, z: 55, w: 8, h: 4.5, ry: -Math.PI / 2, folio: 7 },
  // The Long Board on the West Range's inner face: what has been recovered.
  { id: "long", kind: "long", x: -37.35, y: PAD_Y + 3.2, z: 57, w: 16, h: 3.6, ry: Math.PI / 2, folio: 3 },
  // The Register's west face: who filed what, and what it opened.
  { id: "register", kind: "register", x: -12.05, y: PAD_Y + 4.2, z: 86, w: 7, h: 5, ry: -Math.PI / 2, folio: 1 },
];

/**
 * Boards hung between colonnade columns. Deterministic, and folio hues cycle
 * with an offset per colonnade so no two neighbours match — the reference
 * panel's one hard rule about signage.
 */
export function buildHungBoards(): Board[] {
  const out: Board[] = [];
  COLONNADES.forEach((c, ci) => {
    const inner = c.x < AXIS_X ? 1 : -1; // hang on the quad-facing side
    for (let i = 0; i < c.n - 1; i++) {
      // Skip every third bay so the run has gaps to see through.
      if (i % 3 === 2) continue;
      const t0 = i / (c.n - 1);
      const t1 = (i + 1) / (c.n - 1);
      const z = c.from + (c.to - c.from) * ((t0 + t1) / 2);
      out.push({
        id: `${c.id}-${i}`,
        kind: "hung",
        x: c.x + inner * 0.55,
        y: PAD_Y + 3.9,
        z,
        w: 2.6,
        h: 1.7,
        ry: inner > 0 ? Math.PI / 2 : -Math.PI / 2,
        folio: ((ci * 4 + i * 2) % 9) + 1,
      });
    }
  });
  return out;
}

// ── Furniture ────────────────────────────────────────────────────────────────

/** Reading tables in the open half of the Lower Quad — the foreground clutter
 *  the reference panel gets from its market stalls. */
export function buildTables(): Box[] {
  const spots: [number, number][] = [
    [-31, 79], [-25.5, 81.5], [-32, 87], [-26, 90.5], [-20, 84], [-21, 92.5],
  ];
  return spots.map(([x, z], i) => ({
    x,
    y: PAD_Y + 0.45,
    z,
    w: 4.2,
    h: 0.9,
    d: 1.6,
    ry: (i % 2 === 0 ? 1 : -1) * 0.18 + (i === 4 ? Math.PI / 2 : 0),
  }));
}

/** A kerb around the terrace so the plinth reads as built ground rather than a
 *  rug laid on the dunes. */
export function buildKerb(): Box[] {
  const t = 0.9;
  const y = PAD_Y - 0.15;
  // The four runs cross at the terrace corners. Left at one height their top
  // faces are coplanar over each corner square, which flickers exactly like the
  // roofs did; the east/west runs finish 2cm lower so the north/south runs
  // simply win there. Invisible as a step, decisive to the depth buffer.
  const cross = 0.02;
  return [
    { x: AXIS_X, y, z: PAD_N, w: CAMPUS_PAD.w + t, h: 0.7, d: t },
    { x: AXIS_X, y, z: PAD_S, w: CAMPUS_PAD.w + t, h: 0.7, d: t },
    { x: PAD_W, y: y - cross, z: CAMPUS_PAD.cz, w: t, h: 0.7, d: CAMPUS_PAD.d },
    { x: PAD_E, y: y - cross, z: CAMPUS_PAD.cz, w: t, h: 0.7, d: CAMPUS_PAD.d },
  ];
}

// ── Where people are ─────────────────────────────────────────────────────────

export interface DebateCircle {
  x: number;
  z: number;
  r: number;
  /** Bodies standing in the ring, facing inward. */
  n: number;
}

/**
 * Standing rings of figures facing each other. This is the one image that says
 * "challenging assumptions" without a caption, and it is why the crowd is not
 * only walkers: a campus where everybody is in transit is a railway station.
 *
 * Spots are pinned; how many are occupied comes from real lounge traffic.
 */
const CIRCLE_SPOTS: readonly { x: number; z: number; r: number; n: number }[] = [
  { x: -26, z: 52, r: 2.8, n: 5 },
  { x: -13, z: 60, r: 2.4, n: 4 },
  { x: -28.5, z: 64.5, r: 3.0, n: 6 },
  { x: -14.5, z: 50, r: 2.5, n: 4 },
  { x: -31, z: 77, r: 2.6, n: 5 },
  { x: -24, z: 88, r: 2.9, n: 6 },
];

export function debateCircles(survey24h: number): DebateCircle[] {
  // One circle per two survey teams, floor 1, ceiling the spots that exist.
  // Floor 1 because a campus with nobody arguing on it is not a claim this
  // world should make while its four residents are standing right there.
  const s = Number.isFinite(survey24h) ? Math.max(0, survey24h) : 0;
  const n = Math.max(1, Math.min(CIRCLE_SPOTS.length, Math.round(s / 2)));
  return CIRCLE_SPOTS.slice(0, n).map((c) => ({ ...c }));
}

/**
 * How many anonymous bodies walk the terrace.
 *
 * NOT a live headcount, and must never be read as one: it is a saturating
 * curve over 24h lounge traffic with a floor of ten. The floor exists because
 * a field school has a caretaker population whether or not anyone spoke in the
 * hub today, and the ceiling exists because the frame budget is real. The
 * honest reading of a quiet campus is a quiet campus, not an empty one.
 */
export function crowdSize(survey24h: number): number {
  const s = Number.isFinite(survey24h) ? Math.max(0, survey24h) : 0;
  return Math.round(10 + 36 * (1 - Math.exp(-s / 14)));
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * Walkable polylines, world-space XZ, consumed by lib/worlds/routes.
 *
 * Route 0 is the axis and is deliberately the longest: the strongest read of an
 * open campus is people walking its full length without meeting a wall.
 */
export function buildRoutes(): { pts: [number, number][]; loop: boolean }[] {
  const [vx, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
  const vaultR = VAULT_POS.r * WORLD_SCALE + 4;
  const circuit: [number, number][] = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [vx + Math.cos(a) * vaultR, vz + Math.sin(a) * vaultR];
  });

  return [
    // 0 — the axis, vault apron to the south edge of the terrace.
    { pts: [[AXIS_X, 33], [AXIS_X, 48], [AXIS_X, 69], [AXIS_X, 76], [AXIS_X, 94]], loop: false },
    // 1 — the Great Quad perimeter.
    { pts: [[-32, 47], [-8, 47], [-8, 67], [-32, 67]], loop: true },
    // 2 — the west colonnade walk, running both quads.
    { pts: [[-34, 46], [-34, 68], [-34, 78], [-34, 92]], loop: false },
    // 3 — the east colonnade walk.
    { pts: [[-6, 46], [-6, 68]], loop: false },
    // 4 — the circuit around the sealed vault.
    { pts: circuit, loop: true },
    // 5 — the Lower Quad diagonal, past the reading tables.
    { pts: [[-34, 78], [-24, 84], [-16.5, 92]], loop: false },
    // 6 — the approach, off the axis, from the terrace onto the dig trail.
    { pts: [[-30, 38], [-20, 36], [-8, 34]], loop: false },
  ];
}

// ── Invariants the plan must satisfy ─────────────────────────────────────────
//
// "Open" is a property of a plan, not a judgement about a picture, so it is
// asserted here rather than eyeballed. Both of these are checked in tests.

export type Side = "north" | "south" | "east" | "west";

function overlaps1D(aC: number, aHalf: number, bC: number, bHalf: number): boolean {
  return Math.abs(aC - bC) < aHalf + bHalf;
}

/** Which sides of a quad have built mass against them. */
export function builtSides(quad: Quad): Side[] {
  const out: Side[] = [];
  const qw = quad.w / 2;
  const qd = quad.d / 2;
  const REACH = 4; // how far outside the quad edge counts as "against it"

  for (const m of MASSES) {
    const mw = m.w / 2;
    const md = m.d / 2;
    // West / east: the mass must straddle the quad's z span and sit beyond its
    // x edge but within reach of it.
    if (overlaps1D(quad.cz, qd, m.z, md)) {
      if (m.x + mw <= quad.cx - qw + 0.01 && m.x + mw >= quad.cx - qw - REACH) out.push("west");
      if (m.x - mw >= quad.cx + qw - 0.01 && m.x - mw <= quad.cx + qw + REACH) out.push("east");
    }
    if (overlaps1D(quad.cx, qw, m.x, mw)) {
      if (m.z + md <= quad.cz - qd + 0.01 && m.z + md >= quad.cz - qd - REACH) out.push("north");
      if (m.z - md >= quad.cz + qd - 0.01 && m.z - md <= quad.cz + qd + REACH) out.push("south");
    }
  }
  return [...new Set(out)];
}

/**
 * Cardinal bearings along which the view from the terrace centre leaves the
 * campus without crossing built mass.
 *
 * Dig sites deliberately do NOT count as blockers here. A buried site is a
 * mound a few units proud of the dust, and a four-unit mound forty units out
 * does not enclose anything — it is the view. What this asserts is that the
 * ARCHITECTURE leaves the axis open, which is the thing that was asked for.
 */
export function openBearings(): Side[] {
  const cx = AXIS_X;
  const cz = CAMPUS_PAD.cz;

  const rayClear = (dx: number, dz: number): boolean => {
    for (let t = 2; t <= 140; t += 1) {
      const x = cx + dx * t;
      const z = cz + dz * t;
      for (const m of MASSES) {
        if (Math.abs(x - m.x) < m.w / 2 && Math.abs(z - m.z) < m.d / 2) return false;
      }
    }
    return true;
  };

  const out: Side[] = [];
  if (rayClear(0, -1)) out.push("north");
  if (rayClear(0, 1)) out.push("south");
  if (rayClear(1, 0)) out.push("east");
  if (rayClear(-1, 0)) out.push("west");
  return out;
}

/** True when the full length of the axis is walkable without meeting built
 *  mass — the single property that makes this a campus and not a street. */
export function axisClear(): boolean {
  for (let z = PAD_N - 4; z <= PAD_S + 4; z += 0.5) {
    for (const m of MASSES) {
      if (Math.abs(AXIS_X - m.x) < m.w / 2 && Math.abs(z - m.z) < m.d / 2) return false;
    }
  }
  return true;
}

// ── The shot ─────────────────────────────────────────────────────────────────
//
// Nothing in the build environment can composite a frame, so the opening
// composition cannot be checked by looking at it. It is solved instead: the
// camera lives here as data, and the tests project the campus through it and
// assert what lands in frame.
//
// This is the only automated check on how this world looks, so the camera must
// stay in this module rather than drifting into the component. The canvas reads
// these constants; it does not define its own.

export const CAMERA = {
  pos: [-19, 19, 112] as [number, number, number],
  target: [-19, 4.5, 54] as [number, number, number],
  fovY: 50,
} as const;

/**
 * Project a world point into normalised device coordinates for `CAMERA`.
 *
 * Returns null when the point is behind the camera. |x| and |y| <= 1 means the
 * point is inside the frame; x = 0 is the centreline.
 */
export function projectNdc(
  p: readonly [number, number, number],
  aspect = 16 / 9
): { x: number; y: number; dist: number } | null {
  const sub = (a: readonly number[], b: readonly number[]) =>
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as [number, number, number];
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: readonly number[], b: readonly number[]) =>
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as [number, number, number];
  const norm = (v: [number, number, number]) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number];
  };

  const f = norm(sub(CAMERA.target, CAMERA.pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, CAMERA.pos);
  const z = dot(d, f);
  if (z <= 0) return null;

  const tanY = Math.tan(((CAMERA.fovY * Math.PI) / 180) / 2);
  return { x: dot(d, r) / z / (tanY * aspect), y: dot(d, u) / z / tanY, dist: z };
}

/** The campus corners the shot has to hold, as world points. */
export function shotSubjects(): Record<string, [number, number, number]> {
  const g = QUADS[0];
  const l = QUADS[1];
  const reg = MASSES[2];
  return {
    questionStone: [AXIS_X, PAD_Y + 7.2, 40],
    vault: [-9, 3.5, 16],
    greatNW: [g.cx - g.w / 2, PAD_Y, g.cz - g.d / 2],
    greatNE: [g.cx + g.w / 2, PAD_Y, g.cz - g.d / 2],
    greatSW: [g.cx - g.w / 2, PAD_Y, g.cz + g.d / 2],
    greatSE: [g.cx + g.w / 2, PAD_Y, g.cz + g.d / 2],
    westRangeTop: [MASSES[0].x, PAD_Y + MASSES[0].h, MASSES[0].z],
    eastRangeTop: [MASSES[1].x, PAD_Y + MASSES[1].h, MASSES[1].z],
    registerTop: [reg.x, PAD_Y + reg.h, reg.z],
    lowerNW: [l.cx - l.w / 2, PAD_Y, l.cz - l.d / 2],
  };
}
