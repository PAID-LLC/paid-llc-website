// ── Where a trace sits on a floor ────────────────────────────────────────────
// Pure geometry, deliberately kept out of FloorTraces.tsx: this is the part
// with guarantees worth testing, and the test runner has no JSX transform.
//
// Placement is not decided here either. Every trace arrives from lib/traces.ts
// with x, z and rot already derived from its own identity, so the same trace is
// in the same spot on every render, on every machine, and for every visitor.
// This only maps that unit footprint onto floor units.

import type { PlacedTrace } from "@/lib/traces";
import { FLOOR_SIZE, PIT_RADIUS, FLOOR_MARGIN } from "@/components/v2/latent/floor/themes";

const HALF = FLOOR_SIZE / 2;

// The centerpiece owns the middle of every floor (PIT_RADIUS) and the agents
// wander the band outside it, so traces ring the centerpiece: inside the wander
// band, outside the keep-out, well clear of the walls. A ring also happens to
// be what a guestbook looks like when you drop it on a floor.
export const RING_INNER = PIT_RADIUS + 15;
export const RING_OUTER = HALF - FLOOR_MARGIN + 18;

/** Maps a trace's derived unit position onto this floor's usable ring. The
 *  guarantee worth holding onto is geometric rather than aesthetic: no trace
 *  can land under the centerpiece, where it would be invisible forever, or past
 *  the wall, where it would be outside the room it claims to record. */
export function traceFloorPosition(t: PlacedTrace): { x: number; y: number } {
  const r = Math.min(1, Math.hypot(t.x, t.z));
  const theta = Math.atan2(t.z, t.x);
  const radius = RING_INNER + r * (RING_OUTER - RING_INNER);
  return {
    x: HALF + Math.cos(theta) * radius,
    y: HALF + Math.sin(theta) * radius,
  };
}
