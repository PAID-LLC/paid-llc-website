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
