// ── Walkable routes, shared across worlds ────────────────────────────────────
//
// Extracted from lib/arclight/streetlife.ts when the Lathe needed the same
// thing. The route maths is world-agnostic: a polyline, a cumulative length
// table, and a sampler that returns position plus heading. What is NOT
// world-agnostic is which polylines exist and how many bodies belong on them,
// and that stays with each world — Arclight's arterials come off its CityPlan,
// the Lathe's come off its terrace elevations.
//
// The one rule worth stating: `heading` is the tangent, so a walker always
// faces the way the path goes. A body that slides sideways along a road is the
// single most obvious tell that a scene is animated rather than alive.

export interface Route {
  /** World-space polyline, XZ. */
  pts: [number, number][];
  /** Cumulative distance at each point; last entry is the total length. */
  cum: number[];
  length: number;
  /** Closed loops wrap; open paths ping-pong so nobody teleports back to the
   *  start when they reach the end. */
  loop: boolean;
}

/** Build a route from world-space points. Pass `loop` for a closed circuit —
 *  the first point is appended so the last segment closes. */
export function makeRoute(pts: readonly [number, number][], loop: boolean): Route {
  const walk = pts.map(([x, z]) => [x, z] as [number, number]);
  if (loop && walk.length > 1) walk.push([walk[0][0], walk[0][1]]);

  const cum = [0];
  for (let i = 1; i < walk.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1]));
  }
  return { pts: walk, cum, length: cum[cum.length - 1], loop };
}

/**
 * Position and heading at distance `d` along a route.
 *
 * `d` is unbounded in both directions: a loop wraps, an open path ping-pongs
 * out and back forever. That is what lets the renderer drive every body from
 * one ever-increasing clock without bookkeeping per walker.
 */
export function sampleRoute(r: Route, d: number): { x: number; z: number; heading: number } {
  const len = r.length;
  let t: number;
  let backwards = false;

  if (r.loop) {
    t = ((d % len) + len) % len;
  } else {
    const span = len * 2;
    const u = ((d % span) + span) % span;
    if (u <= len) t = u;
    else {
      t = span - u;
      backwards = true;
    }
  }

  // Walk the cumulative table. Routes are a handful of points to a few dozen,
  // so a scan beats a binary search and keeps this allocation-free in the
  // frame loop.
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < t) i++;
  const segLen = r.cum[i] - r.cum[i - 1] || 1;
  const f = (t - r.cum[i - 1]) / segLen;

  const [ax, az] = r.pts[i - 1];
  const [bx, bz] = r.pts[i];
  const dx = bx - ax;
  const dz = bz - az;

  return {
    x: ax + dx * f,
    z: az + dz * f,
    heading: Math.atan2(backwards ? -dx : dx, backwards ? -dz : dz),
  };
}

/** Fields every world's walker needs. Worlds extend this with their own kind
 *  flag — Arclight's `courier`, the Lathe's `hauler`. */
export interface RouteWalker {
  route: number;
  /** Distance along the route at t=0. */
  offset: number;
  /** World units per second. */
  speed: number;
  /** Sideways offset from the centreline, so bodies use the width of the path
   *  instead of marching down the middle of it. */
  lane: number;
  /** Per-walker gait phase, so a path is not a chorus line. */
  phase: number;
}
