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

/** Vertical drop between adjacent terraces, world units. */
export const TERRACE_STEP = 4.2;

/** Extra depth from the innermost terrace down to the pit floor. */
export const PIT_DROP = 7;

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
