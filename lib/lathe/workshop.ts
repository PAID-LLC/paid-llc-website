import { hashStr, mulberry32 } from "@/lib/sim-field";

// ── The Lathe's fixed geometry ────────────────────────────────────────────────
// Pinned like Arclight's cityplan/skyline, Meridian's skyline, and the
// Crucible's colosseum: the layout is fixed forever — live data only ever
// decides what's drawn where, never the geometry itself.
// Spec: cowork references/autoresearch/2026-07-23-lathe-spec-v1.md

export const GROUND_RADIUS = 220;
export const RING_BASE_RADIUS = 10;
export const RING_STEP = 9;
export const MAX_RINGS = 12; // matches scripts/generate-build-log.mjs's `git log -12`
export const HEARTH = { x: 0, z: 170 };
export const SPARK_INNER = 118;
export const SPARK_OUTER = 160;

export function ringRadius(index: number): number {
  return RING_BASE_RADIUS + index * RING_STEP;
}

// ── The quarry profile ───────────────────────────────────────────────────────
// Added 2026-08-09. The rings above were originally drawn as flat decals lying
// on a 220-radius disc whose tallest object was about five units — 44 times
// wider than anything was tall, which is why the world read as a diagram rather
// than a place.
//
// Everything above this line is untouched and stays untouched: ringRadius,
// RING_STEP and the spark annulus are pinned by tests/api/lathe-workshop.test.ts
// and by three shipped worlds' worth of precedent. What changes is that a ring's
// radius now also implies an ELEVATION, so the same twelve real commits describe
// a stepped canyon instead of twelve circles.
//
// Direction matters and is not arbitrary. Ring 0 is the OLDEST commit and the
// innermost (tree-growth convention, set in lib/lathe/forge.ts), so older strata
// sit deeper — which is how sediment actually works, and means the world reads
// as digging down through the build history toward the day the site started.

/**
 * Vertical drop between adjacent terraces, world units.
 *
 * Raised from 4.2 to 6.5 on 2026-08-10. At 4.2 a step was 1.9% of the world's
 * own radius, which is under two pixels at any camera distance that frames the
 * whole quarry — measured, not guessed: the world went on reading as flat
 * concentric rings after the rebuild that was supposed to fix exactly that.
 * Eleven steps at 6.5 plus the pit drop puts the floor at -83.5 against a
 * 220 radius, so the canyon is now about 2.6 times wider than it is deep
 * instead of 4.2 times, and a riser catches the key light differently from the
 * tread above it.
 */
export const TERRACE_STEP = 6.5;

/** Extra depth from the innermost terrace down to the pit floor. */
export const PIT_DROP = 12;

/** Fraction of each ring band that is flat tread; the rest is the sloped riser
 *  down to the next terrace in. Sloped rather than vertical so the height field
 *  is continuous — residents walk down the quarry instead of teleporting a full
 *  step at each lip. */
export const TREAD_FRACTION = 0.55;

/** Radius at which the terraces stop and the flat outer rim begins. The spark
 *  annulus (118..160) sits out on that rim, so ledger sparks keep the exact
 *  positions sparkPosition() has always given them. */
export const RIM_RADIUS = RING_BASE_RADIUS + (MAX_RINGS - 1) * RING_STEP;

/** Pit floor elevation — the deepest point in the world. */
export const PIT_FLOOR = -((MAX_RINGS - 1) * TERRACE_STEP) - PIT_DROP;

/** Elevation of terrace `index`. The outermost terrace sits level with the rim
 *  at y=0 and each step inward drops by TERRACE_STEP. */
export function terraceElevation(index: number): number {
  return -(MAX_RINGS - 1 - index) * TERRACE_STEP;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ground height anywhere in the quarry — the single source of truth for where
 * the surface is, shared by the terrain mesh, the structures standing on it and
 * the residents walking it. Continuous everywhere, so nothing pops.
 */
export function terraceHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r >= RIM_RADIUS) return 0;
  if (r <= RING_BASE_RADIUS) {
    // Shallow bowl into the pit floor rather than a flat disc, so the molten
    // pool has somewhere to sit and the spindle has something to rise out of.
    return terraceElevation(0) - PIT_DROP * (1 - r / RING_BASE_RADIUS);
  }
  const t = (r - RING_BASE_RADIUS) / RING_STEP;
  const band = Math.floor(t);
  const frac = t - band;
  const inner = terraceElevation(band);
  const outer = terraceElevation(band + 1);
  return inner + (outer - inner) * smoothstep(TREAD_FRACTION, 1, frac);
}

/** The quarry as a [radius, height] profile, centre outward — revolve it and
 *  the whole canyon is one mesh. `extraRadius` continues the flat rim out to
 *  the ground edge. */
export function terraceProfile(extraRadius: number = GROUND_RADIUS): [number, number][] {
  const pts: [number, number][] = [];
  const bowl = 6; // samples across the pit floor, so it curves rather than cones
  for (let s = 0; s < bowl; s++) {
    const r = (s / bowl) * RING_BASE_RADIUS;
    pts.push([r, terraceHeightAt(r, 0)]);
  }
  const steps = 12; // per ring band — enough to render the riser's curve
  for (let band = 0; band < MAX_RINGS - 1; band++) {
    for (let s = 1; s <= steps; s++) {
      const r = ringRadius(band) + (s / steps) * RING_STEP;
      pts.push([r, terraceHeightAt(r, 0)]);
    }
  }
  pts.push([extraRadius, 0]);
  return pts;
}

// ── The melt ─────────────────────────────────────────────────────────────────
// Added 2026-08-10. The pit had a fixed pool 4.2 units above the floor, which
// on this bowl works out at a six-unit puddle in a four-hundred-unit world —
// invisible at every camera distance, and the reason a foundry world read as a
// cold quarry. The melt is now a level, it is keyed to real build cadence, and
// its radius is read off the bowl's own profile so it can never float free of
// the rock that holds it.

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Molten surface elevation for a given forge heat.
 *
 * A cold forge is NOT an empty pit. The melt drops and crusts over; it does not
 * vanish. That matters because forge heat decays continuously from the last
 * commit, so a quiet fortnight would otherwise delete the world's only warm
 * light and leave a viewer looking at something that reads as broken rather
 * than as idle.
 */
export function lavaLevel(heat: number): number {
  const cold = PIT_FLOOR + 1.6;
  const hot = terraceElevation(3);
  return cold + (hot - cold) * clamp01(heat);
}

/**
 * Radius of the melt at elevation `y` — the largest radius whose ground is at
 * or below that level. Bisection rather than algebra because `terraceHeightAt`
 * owns the profile and this must keep agreeing with it if the profile ever
 * changes.
 */
export function lavaRadius(y: number): number {
  if (y <= terraceHeightAt(0, 0)) return 0;
  if (y >= 0) return RIM_RADIUS;
  let lo = 0;
  let hi = RIM_RADIUS;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (terraceHeightAt(mid, 0) <= y) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ── The foundry town ─────────────────────────────────────────────────────────
// Pinned like everything else here: the layout is fixed forever and live data
// only ever decides how the town is LIT, never where it stands.
//
// It occupies the belt outside the spark annulus, so a ledger row is never
// buried by scenery — the same clearance the original works kept, at the same
// radii. What changed is the third dimension. Thirty-four boxes averaging seven
// units tall, on a rim a hundred and nine units out, is a shanty seen from
// orbit; the reference art for this world is a city of furnace houses and
// stacks, and a city has to have a skyline or it is just a texture.

/** The belt the town occupies, as bounds its FOOTPRINTS must fit inside — not
 *  as bounds on its centres. Placing by centre is what put a twenty-four-unit
 *  furnace house half over the ledger annulus at one end of the belt and half
 *  over the edge of the world at the other. */
export const TOWN_INNER = SPARK_OUTER + 2;
export const TOWN_OUTER = GROUND_RADIUS - 2;

export type TownKind = "house" | "stack" | "silo" | "shed";

export interface TownPiece {
  kind: TownKind;
  x: number;
  z: number;
  /** Footprint. Stacks and silos are round, so `w` is their diameter and `d`
   *  is ignored by the renderer. */
  w: number;
  d: number;
  h: number;
  ry: number;
}

const TOWN_SLOTS = 64;

/**
 * The town, centre-out. Deterministic from a fixed seed, so the same skyline
 * greets every visitor and a re-render never reshuffles the city.
 *
 * Density and height both rise toward the hearth's bearing. Every working town
 * has a side that faces the work, and a perfectly even ring would read as a
 * fence — the asymmetry is what gives the horizon somewhere to look.
 */
export function foundryTown(): TownPiece[] {
  const rand = mulberry32(hashStr("lathe-foundry-town-v1"));
  const out: TownPiece[] = [];

  for (let slot = 0; slot < TOWN_SLOTS; slot++) {
    const a = (slot / TOWN_SLOTS) * Math.PI * 2 + (rand() - 0.5) * 0.08;
    // 1 at the hearth's bearing (0, +z), 0 opposite it.
    const toward = 0.5 + 0.5 * Math.sin(a);
    const depth = 1 + (rand() < 0.35 + toward * 0.4 ? 1 : 0);

    for (let k = 0; k < depth; k++) {
      const roll = rand();

      let kind: TownKind;
      if (roll < 0.26 + toward * 0.16) kind = "house";
      else if (roll < 0.52) kind = "stack";
      else if (roll < 0.66) kind = "silo";
      else kind = "shed";

      let w: number;
      let d: number;
      let h: number;
      if (kind === "house") {
        w = 11 + rand() * 13;
        d = w * (0.7 + rand() * 0.6);
        h = 17 + rand() * 20 + toward * 21;
      } else if (kind === "stack") {
        w = 3.4 + rand() * 3.2;
        d = w;
        h = 32 + rand() * 24 + toward * 18;
      } else if (kind === "silo") {
        w = 7 + rand() * 7;
        d = w;
        h = 11 + rand() * 13;
      } else {
        w = 6 + rand() * 12;
        d = w * (0.6 + rand() * 0.7);
        h = 4 + rand() * 8;
      }

      // Footprint first, then the radius that fits it. Worst case for a rotated
      // box is half its diagonal, so this holds at any `ry`. Big furnace houses
      // end up inland and small sheds reach the lip, which is also how a works
      // actually lays itself out.
      const reach = Math.hypot(w, d) / 2;
      const lo = TOWN_INNER + reach;
      const hi = TOWN_OUTER - reach;
      const r = hi <= lo ? (lo + hi) / 2 : lo + rand() * (hi - lo);

      out.push({
        kind,
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        w,
        d,
        h,
        ry: a + (rand() - 0.5) * 0.7,
      });
    }
  }

  return out;
}

export interface SparkPoint {
  x: number;
  z: number;
}

/** Deterministic per-row placement so a spark never jitters between polls —
 *  the id is the only input, so the same ledger row always lands in the same
 *  spot regardless of how many other rows are in the current window. */
export function sparkPosition(id: string | number): SparkPoint {
  const rand = mulberry32(hashStr(`lathe-spark-${id}`));
  const angle = rand() * Math.PI * 2;
  const radius = SPARK_INNER + rand() * (SPARK_OUTER - SPARK_INNER);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
