// ── Meridian massing: pure, no THREE import ──────────────────────────────────
// Same split that made Arclight's and Palimpsest's 3D scenes work: fixed
// hand-authored macro-geometry (the radial ward layout, pinned forever) plus
// a seeded RNG for micro-detail (building placement within each ward), with
// live data (prosperity index, structure level) driving only height/color —
// never layout. Geography is stable across every visit.

import { mulberry32 } from "@/lib/sim-field";
import type { StructureLevel, Ward } from "@/lib/meridian/engine";
import { WARDS } from "@/lib/meridian/engine";

export const MERIDIAN_SEED = 0x4d65_7269; // "Meri" — fixed forever

// Radial frame: the Agora at center, six wards as 60°-wide wedges, a green
// ring at the rim. Units match Arclight's/Substrate's world scale.
// Widened 2026-08-11 with the massing fix below: real floorplates (up to 23
// units across) simply do not fit a 37-unit-deep ward band, so the frame grew
// by the same ratio the buildings did. The wheel itself — six wards, 60° apart,
// in this order — is untouched and stays pinned forever.
export const AGORA_RADIUS = 12;
export const WARD_INNER = 26;
export const WARD_OUTER = 74;
export const RING_INNER = 74;
export const RING_OUTER = 96;
/** The paved plaza disc. Sized to sit just outside the tree ring — a wide apron
 *  of empty pavement past the green belt reads as unfinished map, not as space. */
export const GROUND_RADIUS = 104;

/**
 * One storey, in world units.
 *
 * Meridian shipped as an aerial diagram with nothing human-sized in the frame,
 * so its massing was free to mean anything. The inhabitants pass later put
 * body-scale figures on the ground and settled the question without anyone
 * re-checking the buildings: a Meridian figure stands 3.77 units, which made
 * the Atelier and Archive wards SHORTER THAN THE PEOPLE WALKING THROUGH THEM
 * (0.7x-1.3x a body) and turned Spire Row's "glass towers" into 2.2-unit-wide
 * pencils at up to 11.8:1.
 *
 * Flat colour hid all of it — an untextured box has no scale cues at all, which
 * is exactly why it survived three passes. A window grid does not hide it, so
 * the surface pass forced the fix rather than merely allowing it.
 *
 * 3.2 m per storey against a 1.75 m body at 3.77 units gives 6.9. Every ward
 * height below is written in storeys against this, so the relationship stays
 * legible instead of living in a magic multiplier.
 */
export const STOREY = 6.9;

// Fixed forever — the wheel never rotates between visits.
export const WARD_ANGLE_DEG: Record<Ward, number> = {
  spire_row: 0,
  ledger_house: 60,
  archive: 120,
  atelier: 180,
  yards: 240,
  commons: 300,
};

export function polar(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

/** The label/marker anchor for a ward: its mid-radius centerline point. */
export function wardAnchor(ward: Ward): [number, number] {
  return polar((WARD_INNER + WARD_OUTER) / 2, WARD_ANGLE_DEG[ward]);
}

export interface WardBuilding {
  x: number;
  z: number;
  w: number;
  d: number;
  baseH: number;
  rotY: number;
}

const WARD_BUILDING_COUNT: Record<Ward, number> = {
  spire_row: 9,
  ledger_house: 11,
  archive: 6,
  atelier: 10,
  yards: 7,
  commons: 8,
};

/** Ward heights in STOREYS. Read the right-hand column as the brief. */
const WARD_STOREYS: Record<Ward, [number, number]> = {
  spire_row: [6, 10],     // glass towers — the tallest ward
  ledger_house: [3.5, 6], // denser mid-rise
  archive: [1.6, 2.4],    // low domed halls, wide rather than tall
  atelier: [1.2, 2],      // colorful low workshop blocks
  yards: [2, 3.2],        // gantries and terminal sheds
  commons: [1.6, 2.8],    // terraced garden housing
};

const WARD_BASE_HEIGHT: Record<Ward, [number, number]> = Object.fromEntries(
  WARDS.map((w) => [w, [WARD_STOREYS[w][0] * STOREY, WARD_STOREYS[w][1] * STOREY]])
) as Record<Ward, [number, number]>;

/**
 * Footprint width range per ward, in world units. Typology-specific because a
 * workshop and a tower are not the same building scaled: the old single global
 * 2.2-4.6 range is what produced the pencils.
 */
const WARD_FOOTPRINT: Record<Ward, [number, number]> = {
  spire_row: [11, 17],    // slender, but a floorplate rather than a post
  ledger_house: [12, 19], // blocky mid-rise
  archive: [15, 23],      // squat halls — the widest footprints in the city
  atelier: [9, 15],       // small workshops
  yards: [13, 24],        // long sheds
  commons: [10, 17],      // terraces
};

/** Clearance kept between a building's corner and the ward's 30° wedge edge. */
const WEDGE_MARGIN = 1.5;

/** Max facade deviation from a world axis, in radians. See the note in
 *  `buildWardKit` — this is a texturing constraint, not a stylistic one. */
export const ROT_JITTER = 0.31; // ~17.8°

const buildCache = new Map<string, WardBuilding[]>();

/**
 * Deterministic building placement within one ward's 60°-wide wedge, between
 * WARD_INNER and WARD_OUTER. Cached per ward (module-lifetime, like Arclight's
 * cityplan cache) since the kit never changes shape — only baseH/level scaling
 * at render time responds to live data.
 */
export function buildWardKit(ward: Ward, seed: number = MERIDIAN_SEED): WardBuilding[] {
  // Keyed by ward AND seed. Keying by ward alone meant the first caller to pass
  // a non-default seed poisoned the cache for every later caller — invisible in
  // the app, which only ever uses the default, but it made the determinism test
  // depend on execution order.
  const cacheKey = `${ward}:${seed}`;
  const cached = buildCache.get(cacheKey);
  if (cached) return cached;

  const rand = mulberry32((seed ^ (WARD_ANGLE_DEG[ward] * 0x9e37)) >>> 0);
  const count = WARD_BUILDING_COUNT[ward];
  const [hMin, hMax] = WARD_BASE_HEIGHT[ward];
  const [wMin, wMax] = WARD_FOOTPRINT[ward];
  const centerAngle = WARD_ANGLE_DEG[ward];

  const buildings: WardBuilding[] = [];
  for (let i = 0; i < count; i++) {
    const w = wMin + rand() * (wMax - wMin);
    const d = wMin + rand() * (wMax - wMin);

    // A rotated box sweeps its circumscribed circle, so clearance is computed
    // against the half-diagonal. Doing it any other way lets rotY quietly push
    // corners into the neighbouring ward.
    const reach = Math.hypot(w, d) / 2 + WEDGE_MARGIN;

    // Radius first, kept far enough inside the band that the whole footprint
    // sits in it rather than only the centre point.
    const rLo = WARD_INNER + reach;
    const rHi = WARD_OUTER - reach;
    const radius = rLo >= rHi ? (WARD_INNER + WARD_OUTER) / 2 : rLo + rand() * (rHi - rLo);

    // Then the widest angular offset that still keeps the corners inside the
    // 30° wedge at that radius. Near the Agora this collapses toward zero, so
    // inner buildings line up on the ward's centreline and development reads as
    // six radial spokes — which is how a radial city actually grows.
    const maxOffset = Math.max(
      0,
      30 - (Math.asin(Math.min(1, reach / radius)) * 180) / Math.PI
    );
    const angle = centerAngle + (rand() * 2 - 1) * maxOffset;

    const [x, z] = polar(radius, angle);
    const baseH = hMin + rand() * (hMax - hMin);

    // Rotation is snapped to the 90° lattice with a jitter, not free over a
    // full turn. This is a constraint the SURFACE layer imposes on the massing
    // layer: the shared materials sample triplanar in world space, blending the
    // three projections by normal^4, so a facade turned 45° draws two
    // projections at 50/50 and ghosts. Inside ~18° of an axis the blend is
    // under 4% and a wall stays a wall. A box has 4-fold symmetry, so snapping
    // costs no variety at all — and an orthogonal grain cut through by six
    // radial avenues is how radial cities are actually laid out.
    const quarter = Math.floor(rand() * 4) * (Math.PI / 2);
    const rotY = quarter + (rand() * 2 - 1) * ROT_JITTER;

    buildings.push({ x, z, w, d, baseH, rotY });
  }
  buildCache.set(cacheKey, buildings);
  return buildings;
}

/** Grandeur scaling from a ward's structure level (1-3) — uniform across typologies. */
export function structureScale(level: StructureLevel): number {
  return level === 1 ? 1 : level === 2 ? 1.15 : 1.35;
}

/** Spire Row alone visibly breathes with the live index — the financial ward. */
export function spireBoost(prosperityIndex: number): number {
  return 0.6 + (Math.max(0, Math.min(100, prosperityIndex)) / 100) * 0.8; // 0.6x..1.4x
}

/** The Agora obelisk's height tracks the live index directly — no ward, no decay. */
export function obeliskHeight(prosperityIndex: number): number {
  const idx = Math.max(0, Math.min(100, prosperityIndex));
  // Rescaled with the massing fix. The old 10..32 was set against 14..26-unit
  // "towers"; against the real Spire Row it would have left the city's civic
  // centrepiece shorter than the banks, which inverts what the obelisk means.
  return 24 + (idx / 100) * 72; // 24..96 units — 3.5 to 14 storeys
}

/**
 * A Meridian figure's height, for massing assertions.
 *
 * The inhabitant body spans roughly y=-1.5 to y=2.93 at scale 1, and Meridian's
 * placement entry scales it by 0.85. Kept here rather than imported so the pure
 * massing lib stays free of component dependencies; the test that uses it also
 * pins the placement value, so the two cannot drift apart silently.
 */
export const FIGURE_HEIGHT = 4.43 * 0.85;

/** 0 (bust, brown) .. 1 (boom, vivid green) — the Green Ring's weather-analog. */
export function ringLushness(prosperityIndex: number): number {
  return Math.max(0, Math.min(100, prosperityIndex)) / 100;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

const RING_BROWN = "#7a6a45";
const RING_GREEN = "#3fae63";

/** Ring color as a direct lerp between bust-brown and boom-green. Pure, testable. */
export function ringColor(prosperityIndex: number): string {
  const t = ringLushness(prosperityIndex);
  const [r1, g1, b1] = hexToRgb(RING_BROWN);
  const [r2, g2, b2] = hexToRgb(RING_GREEN);
  return rgbToHex(lerpChannel(r1, r2, t), lerpChannel(g1, g2, t), lerpChannel(b1, b2, t));
}

/** Every ward's anchor in wheel order — the walking tour a camera path could follow. */
export function wardTour(): { ward: Ward; anchor: [number, number] }[] {
  return WARDS.map((ward) => ({ ward, anchor: wardAnchor(ward) }));
}

export interface RingTree {
  x: number;
  z: number;
  scale: number;
  heightScale: number;
  rotY: number;
}

/** The cone the ring instances, before per-tree scaling. */
export const TREE_RADIUS = 1.6;
export const TREE_HEIGHT = 4.8;

// Raised with the frame — 64 trees over a ~534-unit ring read as a dotted line.
// Not raised as far as it first was: at 132 the belt closed into an opaque wall
// standing between the camera and the city it exists to frame. A green belt is
// a setting, not a hedge.
const RING_TREE_COUNT = 92;
let ringKitCache: RingTree[] | null = null;
let ringKitSeed: number | null = null;

/** A tree's world height, so the canvas can seat it on the ground rather than
 *  sinking it — an instanced cone is positioned by its centre. */
export function treeHeight(t: RingTree): number {
  return TREE_HEIGHT * t.scale * t.heightScale;
}

/** Deterministic tree placement around the Green Ring. Cached, seed-fixed. */
export function buildGreenRingKit(seed: number = MERIDIAN_SEED): RingTree[] {
  // Seed-aware for the same reason the ward cache is.
  if (ringKitCache && ringKitSeed === seed) return ringKitCache;
  const rand = mulberry32((seed ^ 0x67ee6) >>> 0);
  const trees: RingTree[] = [];
  for (let i = 0; i < RING_TREE_COUNT; i++) {
    const angle = (i / RING_TREE_COUNT) * 360;
    const radius = RING_INNER + rand() * (RING_OUTER - RING_INNER);
    const [x, z] = polar(radius, angle);
    const scale = 1.2 + rand() * 1.4;
    const heightScale = 1.4 + rand() * 0.8;
    trees.push({ x, z, scale, heightScale, rotY: rand() * Math.PI * 2 });
  }
  ringKitCache = trees;
  ringKitSeed = seed;
  return trees;
}
