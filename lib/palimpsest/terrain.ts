// ── Palimpsest terrain: pure 3D massing for the ruins ────────────────────────
// The 3D read's geometry layer, split out of the canvas exactly like
// Arclight's skyline.ts: no THREE, no React — just deterministic numbers the
// scene consumes. Everything derives from the same hand-placed site table in
// history.ts, so the 2D dig map, the API, and the 3D ruins can never disagree
// about where anything is buried.
//
// Fixed-draw discipline: every site's ruin generates from its own rng stream
// (seed ^ site id), so a change to one site's kit can never reshuffle
// another's. The rubble field runs a fixed number of attempts regardless of
// how many are accepted, so clearances never shift surviving stones.

import {
  FRAME,
  PALIMPSEST_SEED,
  VAULT_POS,
  buildPrecursorHistory,
  type DigSite,
} from "./history";

export const WORLD_SCALE = 0.5;

/** Map-space (600x520, y down) → world-space XZ centered on the frame. */
export function toWorld(mx: number, my: number): [number, number] {
  return [(mx - FRAME.w / 2) * WORLD_SCALE, (my - FRAME.h / 2) * WORLD_SCALE];
}

/** How deep an excavated pit sinks below the dust. */
export const PIT_DEPTH = 1.15;

/** Dune sea amplitude, world units. */
export const DUNE_AMP = 1.9;

/** Extra flat apron kept clear around every site, world units. */
export const SITE_APRON = 6;

/**
 * The field school's terrace.
 *
 * A rectangular plinth raised out of the dune sea, south of the Colophon Vault.
 * Its north edge stops one unit clear of the vault's own clearing so the two
 * levellings never fight, and it sits in the only corridor of open ground the
 * hand-placed site table leaves near the middle of the frame — the Folio Crypts
 * bound it to the west and the Ninth Margin to the east, both far enough out
 * that only the feather touches them.
 *
 * Terrain owns this rather than the campus module because where the ground is
 * flat is a fact about the ground. campus.ts builds on top of it and imports
 * from here, which keeps the dependency one-way.
 */
export const CAMPUS_PAD = {
  cx: -20,
  cz: 66,
  w: 48,
  d: 60,
  /** Plinth height above the dune datum. */
  y: 1.3,
  /** Blend distance from the pad edge back down to open dune. */
  feather: 8,
} as const;

/** 1 on the terrace, 0 out in the dunes, smooth across the feather. */
export function campusMask(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x - CAMPUS_PAD.cx) - CAMPUS_PAD.w / 2);
  const dz = Math.max(0, Math.abs(z - CAMPUS_PAD.cz) - CAMPUS_PAD.d / 2);
  return 1 - smoothstep(Math.hypot(dx, dz) / CAMPUS_PAD.feather);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The dune sea ─────────────────────────────────────────────────────────────

const CLEARINGS: { x: number; z: number; r: number }[] = (() => {
  const sites = buildPrecursorHistory().sites.map((s) => {
    const [x, z] = toWorld(s.x, s.y);
    return { x, z, r: s.r * WORLD_SCALE + SITE_APRON };
  });
  const [vx, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
  sites.push({ x: vx, z: vz, r: VAULT_POS.r * WORLD_SCALE + SITE_APRON });
  return sites;
})();

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Height of the dust at (x, z): layered dunes, flattened around every site
 *  and the vault so the digs sit on clean ground, then lifted onto the field
 *  school's terrace. Pure and cheap — the plain mesh, the rubble, the trail,
 *  the campus paving, and every walking body all sample the same function, so
 *  nothing can end up standing in the air or buried to the knee. */
export function duneHeight(x: number, z: number): number {
  let h =
    Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.038 + 0.4) * 0.55 +
    Math.sin(x * 0.013 - 0.6) * Math.sin(z * 0.017 + 2.1) * 1.0 +
    Math.sin((x + z) * 0.07) * 0.16;
  h *= DUNE_AMP * 0.55;
  for (const c of CLEARINGS) {
    const d = Math.hypot(x - c.x, z - c.z);
    // 0 at the site, 1 past the apron edge.
    h *= smoothstep((d - c.r * 0.55) / (c.r * 0.75));
  }
  // The terrace wins wherever it exists: a lerp, not a sum, so the dunes do
  // not print through the paving as a gentle swell.
  const pad = campusMask(x, z);
  return h * (1 - pad) + CAMPUS_PAD.y * pad;
}

// ── Per-site ruin kits ───────────────────────────────────────────────────────

export interface RuinColumn {
  /** Angle around the pit center. */
  a: number;
  /** Radius fraction of the pit radius. */
  rf: number;
  /** Full column height, world units. */
  h: number;
  /** Broken columns render at a fraction of their height. */
  broken: boolean;
}

export interface RuinWall {
  /** Mid-angle of the wall arc. */
  a: number;
  /** Chord length as a fraction of the pit radius. */
  lenf: number;
  h: number;
}

export interface RuinSlab {
  /** Offsets as fractions of the pit radius. */
  dxf: number;
  dzf: number;
  ry: number;
  lenf: number;
}

export interface SiteRuin {
  id: number;
  columns: RuinColumn[];
  walls: RuinWall[];
  slabs: RuinSlab[];
}

let cachedRuins: SiteRuin[] | null = null;

/** One ruin kit per dig site, in site order. Independent rng stream per site. */
export function buildRuinField(seed: number = PALIMPSEST_SEED): SiteRuin[] {
  if (seed === PALIMPSEST_SEED && cachedRuins) return cachedRuins;
  const sites = buildPrecursorHistory().sites;
  const field = sites.map((s: DigSite) => {
    const rng = mulberry32((seed ^ (s.id * 0x9e37)) >>> 0);
    const columns: RuinColumn[] = [];
    const nCols = 5 + Math.floor(rng() * 4); // 5-8
    for (let i = 0; i < nCols; i++) {
      columns.push({
        a: rng() * Math.PI * 2,
        rf: 0.5 + rng() * 0.32,
        h: 1.6 + rng() * 2.2,
        broken: rng() < 0.45,
      });
    }
    const walls: RuinWall[] = [];
    const nWalls = 2 + Math.floor(rng() * 2); // 2-3
    for (let i = 0; i < nWalls; i++) {
      walls.push({
        a: rng() * Math.PI * 2,
        lenf: 0.45 + rng() * 0.5,
        h: 0.7 + rng() * 0.9,
      });
    }
    const slabs: RuinSlab[] = [];
    const nSlabs = 2 + Math.floor(rng() * 3); // 2-4
    for (let i = 0; i < nSlabs; i++) {
      slabs.push({
        dxf: (rng() - 0.5) * 1.1,
        dzf: (rng() - 0.5) * 1.1,
        ry: rng() * Math.PI * 2,
        lenf: 0.25 + rng() * 0.3,
      });
    }
    return { id: s.id, columns, walls, slabs };
  });
  if (seed === PALIMPSEST_SEED) cachedRuins = field;
  return field;
}

// ── The rubble field ─────────────────────────────────────────────────────────

export interface RubbleStone {
  x: number;
  z: number;
  s: number;
  ry: number;
}

const RUBBLE_ATTEMPTS = 190;

let cachedRubble: RubbleStone[] | null = null;

/** Scattered ruin-stones across the dune sea, kept clear of every dig site
 *  and the vault. Fixed attempt count: acceptance never shifts later draws. */
export function buildRubble(seed: number = PALIMPSEST_SEED): RubbleStone[] {
  if (seed === PALIMPSEST_SEED && cachedRubble) return cachedRubble;
  const rng = mulberry32((seed ^ 0x7c3) >>> 0);
  const out: RubbleStone[] = [];
  for (let i = 0; i < RUBBLE_ATTEMPTS; i++) {
    const mx = 14 + rng() * (FRAME.w - 28);
    const my = 14 + rng() * (FRAME.h - 28);
    const s = 0.25 + rng() * 0.8;
    const ry = rng() * Math.PI * 2;
    const [x, z] = toWorld(mx, my);
    const clear = CLEARINGS.every((c) => Math.hypot(x - c.x, z - c.z) > c.r);
    if (clear) out.push({ x, z, s, ry });
  }
  if (seed === PALIMPSEST_SEED) cachedRubble = out;
  return out;
}

// ── The dig trail ────────────────────────────────────────────────────────────

/** The excavation order as a world-space polyline: site 1 → … → 19 → vault. */
export function trailWorld(): [number, number][] {
  const pts = buildPrecursorHistory().sites.map(
    (s) => toWorld(s.x, s.y)
  );
  pts.push(toWorld(VAULT_POS.x, VAULT_POS.y));
  return pts;
}
