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

// ── Where the pit went ───────────────────────────────────────────────────────
// The tiered bowl that lived here from 2026-08-09 to 2026-08-10 has moved to
// lib/pit/geometry.ts and now serves the Crucible. Travis's call: a pit with a
// fire at the bottom and tiers looking down into it is a roast pit, not a
// lathe. The two worlds traded geometry and kept their own data.
//
// What stays here is what was always the Lathe's own: the ring radii the build
// log compiles into, and the spark annulus the innovation ledger lands on. Both
// are pinned by tests/api/lathe-workshop.test.ts and by four shipped worlds'
// worth of precedent.

/** Height of the monument column for ring `index`. The newest commit stands
 *  tallest, so the colonnade reads as a history with a direction — walking
 *  outward is walking forward in time. */
export function columnHeight(index: number): number {
  const age = MAX_RINGS - 1 - index;
  return 26 - age * 1.6;
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
