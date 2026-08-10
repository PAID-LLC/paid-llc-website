// ── The pit: a tiered bowl, world-agnostic ───────────────────────────────────
//
// Moved out of lib/lathe/workshop.ts on 2026-08-10. It was built there because
// the Lathe needed it first, and it inherited the build log's own constants:
// the tier count was `MAX_RINGS` (the `git log -12` window) and the tier
// spacing was `RING_STEP`. That coupling was invisible while only one world
// used it and actively misleading the moment a second did.
//
// Nothing in this file knows what a tier MEANS. It is a shape. Worlds decide
// what the shape is compiled from, and a world that treats a tier as fixed
// scenery is making no claim at all — which is exactly what the Crucible does
// with its spectator tiers, and exactly what the Lathe used to do with its
// commits.
//
// The one number carried over deliberately: twelve tiers at nine units. It is
// the proportion the whole scene was tuned against — camera framing, crowd
// routes, plant belt, melt radii — and re-deriving it would have re-tuned all
// of them for no gain.

import { hashStr, mulberry32 } from "@/lib/sim-field";

export const GROUND_RADIUS = 220;
export const TIER_BASE_RADIUS = 10;
export const TIER_STEP = 9;
export const TIERS = 12;

/** Radius of tier `index`, counting outward from the floor. */
export function tierRadius(index: number): number {
  return TIER_BASE_RADIUS + index * TIER_STEP;
}

/**
 * Vertical drop between adjacent tiers, world units.
 *
 * 6.5, not the 4.2 this started at. At 4.2 a step was 1.9% of the bowl's own
 * radius — under two pixels at any camera distance that frames the world — and
 * the pit went on reading as a set of flat concentric rings however good the
 * surface on it was. Measured, not guessed.
 */
export const TIER_DROP = 6.5;

/** Extra depth from the innermost tier down to the floor. */
export const PIT_DROP = 12;

/** Fraction of each band that is flat tread; the rest is the slope down to the
 *  tier inside it. Sloped rather than vertical so the height field is
 *  continuous — bodies walk down the bowl instead of teleporting a full step. */
export const TREAD_FRACTION = 0.55;

/** Radius at which the tiers stop and the flat outer rim begins. */
export const RIM_RADIUS = TIER_BASE_RADIUS + (TIERS - 1) * TIER_STEP;

/** Floor elevation — the deepest point in the bowl. */
export const PIT_FLOOR = -((TIERS - 1) * TIER_DROP) - PIT_DROP;

/** Elevation of tier `index`. The outermost sits level with the rim at y=0 and
 *  each step inward drops by TIER_DROP. */
export function tierElevation(index: number): number {
  return -(TIERS - 1 - index) * TIER_DROP;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Ground height anywhere in the bowl — the single source of truth for where the
 * surface is, shared by the terrain mesh, the structures standing on it and
 * everyone walking it. Continuous everywhere, so nothing pops.
 */
export function pitHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r >= RIM_RADIUS) return 0;
  if (r <= TIER_BASE_RADIUS) {
    // Shallow bowl into the floor rather than a flat disc, so the melt has
    // somewhere to sit.
    return tierElevation(0) - PIT_DROP * (1 - r / TIER_BASE_RADIUS);
  }
  const t = (r - TIER_BASE_RADIUS) / TIER_STEP;
  const band = Math.floor(t);
  const frac = t - band;
  const inner = tierElevation(band);
  const outer = tierElevation(band + 1);
  return inner + (outer - inner) * smoothstep(TREAD_FRACTION, 1, frac);
}

/** The bowl as a [radius, height] profile, centre outward — revolve it and the
 *  whole thing is one mesh. */
export function pitProfile(extraRadius: number = GROUND_RADIUS): [number, number][] {
  const pts: [number, number][] = [];
  const bowl = 6; // samples across the floor, so it curves rather than cones
  for (let s = 0; s < bowl; s++) {
    const r = (s / bowl) * TIER_BASE_RADIUS;
    pts.push([r, pitHeightAt(r, 0)]);
  }
  const steps = 12; // per band — enough to render the riser's curve
  for (let band = 0; band < TIERS - 1; band++) {
    for (let s = 1; s <= steps; s++) {
      const r = tierRadius(band) + (s / steps) * TIER_STEP;
      pts.push([r, pitHeightAt(r, 0)]);
    }
  }
  pts.push([extraRadius, 0]);
  return pts;
}

/** Mid-tread radius of a band: the flat strip a body can actually stand on,
 *  before the riser starts climbing to the band outside it. */
export function treadRadius(band: number): number {
  return tierRadius(band) + TIER_STEP * TREAD_FRACTION * 0.5;
}

// ── The melt ─────────────────────────────────────────────────────────────────

/**
 * Molten surface elevation for a 0..1 intensity.
 *
 * `intensity` is whatever the world's own real signal is — the Lathe used
 * build cadence, the Crucible uses its arena heat index. What matters here is
 * the shape of the response, and one property of it is load-bearing:
 *
 * ZERO IS NOT EMPTY. Both signals decay continuously toward zero on their own,
 * so a quiet fortnight reaches it without anything being wrong. The melt drops
 * and crusts over; it never drains. An empty pit reads as broken rather than
 * as idle, which is a lie about the world's state.
 */
export function lavaLevel(intensity: number): number {
  const cold = PIT_FLOOR + 1.6;
  const hot = tierElevation(3);
  return cold + (hot - cold) * clamp01(intensity);
}

/**
 * Radius of the melt at elevation `y` — the largest radius whose ground is at
 * or below that level. Bisection rather than algebra because `pitHeightAt` owns
 * the profile and this must keep agreeing with it if the profile ever changes.
 */
export function lavaRadius(y: number): number {
  if (y <= pitHeightAt(0, 0)) return 0;
  if (y >= 0) return RIM_RADIUS;
  let lo = 0;
  let hi = RIM_RADIUS;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pitHeightAt(mid, 0) <= y) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ── The rim plant ────────────────────────────────────────────────────────────
// Pinned like every other world's layout: fixed forever, and live data only
// ever decides how it is LIT, never where it stands.
//
// Cylinders only. The first pass had boxed furnace houses and sheds up here
// too; Travis's call on seeing it was to keep the round plant and drop the
// square and rectangular structures. The piece COUNT is unchanged — the slots
// the boxes held went to stacks and silos rather than being left empty, so the
// platform still reads as plant and not as a half-cleared site.

/** The belt the plant occupies, as bounds its FOOTPRINTS must fit inside — not
 *  as bounds on its centres. Placing by centre put a 24-unit structure half
 *  over the inner clearance at one end of the belt and half over the edge of
 *  the world at the other. */
export const PLANT_INNER = 162;
export const PLANT_OUTER = GROUND_RADIUS - 2;

export type PlantKind = "stack" | "silo";

export interface PlantPiece {
  kind: PlantKind;
  x: number;
  z: number;
  /** Everything here is round, so `w` is the diameter. `d` is kept equal to it
   *  and still drives the clearance maths, which works in footprint diagonals. */
  w: number;
  d: number;
  h: number;
  ry: number;
}

const PLANT_SLOTS = 64;

/**
 * The plant, centre-out. Deterministic from a fixed seed, so the same skyline
 * greets every visitor and a re-render never reshuffles it.
 *
 * `focusBearing` is the direction density and height rise toward. Every working
 * site has a side that faces the work, and a perfectly even ring reads as a
 * fence — the asymmetry is what gives the horizon somewhere to look.
 */
export function rimPlant(focusBearing: number = Math.PI / 2, seed = "pit-rim-plant-v1"): PlantPiece[] {
  const rand = mulberry32(hashStr(seed));
  const out: PlantPiece[] = [];

  for (let slot = 0; slot < PLANT_SLOTS; slot++) {
    const a = (slot / PLANT_SLOTS) * Math.PI * 2 + (rand() - 0.5) * 0.08;
    // 1 at the focus bearing, 0 opposite it.
    const toward = 0.5 + 0.5 * Math.cos(a - focusBearing);
    const depth = 1 + (rand() < 0.35 + toward * 0.4 ? 1 : 0);

    for (let k = 0; k < depth; k++) {
      // Stacks are the thin tall flues that give the platform its skyline;
      // silos are the fat shaft towers that give it mass. The silos carry the
      // height range the boxed structures used to, because with those gone they
      // are the only thing left that can.
      const kind: PlantKind = rand() < 0.44 ? "stack" : "silo";

      let w: number;
      let h: number;
      if (kind === "stack") {
        w = 3.4 + rand() * 3.2;
        h = 32 + rand() * 24 + toward * 18;
      } else {
        w = 9 + rand() * 13;
        h = 14 + rand() * 22 + toward * 20;
      }
      const d = w;

      // Footprint first, then the radius that fits it. Worst case for a rotated
      // box is half its diagonal, so this holds at any `ry`.
      const reach = Math.hypot(w, d) / 2;
      const lo = PLANT_INNER + reach;
      const hi = PLANT_OUTER - reach;
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
