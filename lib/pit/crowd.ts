// ── Who is in the pit, and what they are allowed to claim ────────────────────
//
// Generalised out of lib/lathe/crewlife.ts on 2026-08-10, where the two counts
// were hard-wired to the build log (one body per commit) and to forge heat.
// This module takes the counts; the WORLD decides what they are counted from,
// and documents the claim at the call site where the real column is in view.
//
// The split is the same in every world that uses this, and it is the point:
//
//   STANDING — bodies keyed to something that EXISTS. A roster, a registry, a
//   record. They are there on a quiet day exactly as on a busy one, because
//   existing is not an event.
//
//   MOVING — bodies keyed to something that HAPPENED, in a window that closes.
//   They drain away on their own when the world goes quiet, and that is the
//   honest reading of quiet.
//
// Neither may borrow from the other. A busy day must never manufacture a
// resident; a large roster must never manufacture activity. Both directions are
// pinned in tests, because this is the property that makes a populated world
// readable as evidence rather than as decoration.
//
// Pure module: routes, speeds and phases only. The renderer owns the matrices.

import { hashStr, mulberry32 } from "@/lib/sim-field";
import { makeRoute, type Route, type RouteWalker } from "@/lib/worlds/routes";
import { RIM_RADIUS, TIERS, treadRadius, tierRadius } from "@/lib/pit/geometry";

export interface PitWalker extends RouteWalker {
  /** Rides the ramp. Keyed to the world's "what happened" signal. */
  moving: boolean;
}

export interface PitCrowd {
  /** Routes are XZ only. Every body's elevation comes from `pitHeightAt` at
   *  render time — the same height field the terrain is revolved from — so a
   *  body cannot end up at a different height from the ground under it. */
  routes: Route[];
  walkers: PitWalker[];
  standing: number;
  moving: number;
}

/** Ceiling on ramp traffic. Not a data limit — a legibility one. The ramp is a
 *  single spiral and more bodies than this on it reads as a conveyor belt. */
export const MAX_MOVING = 9;

/** Ceiling on standing bodies. A draw-call limit, not a claim about the world:
 *  a roster larger than this is still reported truthfully by the HUD. */
export const MAX_STANDING = 90;

/** A tier's walking loop, as a polygon. Sixty-four sides is under a degree of
 *  chord error at the widest band and keeps the cumulative table small. */
function tierLoop(band: number, segments = 64): [number, number][] {
  const r = treadRadius(band);
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

function circle(cx: number, cz: number, r: number, segments = 28): [number, number][] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as [number, number];
  });
}

/**
 * The ramp: a spiral from the rim down to the floor, sampled densely enough
 * that the height field underneath it is followed rather than cut across.
 *
 * Open, not looped — traffic goes down and comes back up. `sampleRoute`'s
 * ping-pong gives that for free, and it is the correct behaviour rather than a
 * convenience: a road that only ever ran one way would be a conveyor.
 */
const RAMP_TURNS = 2.25;
const RAMP_STEPS = 150;

function rampPath(): [number, number][] {
  // The head sits just OUTSIDE the tiers, on the flat rim. Starting it a couple
  // of units inside began the ramp three units down a riser — a road that
  // starts in a hole.
  const outer = RIM_RADIUS + 2;
  const inner = tierRadius(1);
  return Array.from({ length: RAMP_STEPS + 1 }, (_, i) => {
    const f = i / RAMP_STEPS;
    const r = outer + (inner - outer) * f;
    const a = f * RAMP_TURNS * Math.PI * 2 + 0.9;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
}

/**
 * Route order, fixed: the renderer indexes into this.
 *
 * Standing bodies are deliberately CONCENTRATED on three loops rather than
 * spread evenly over eleven tiers. A dozen bodies scattered one per tier reads
 * as a place abandoned to a caretaker; clustered, the same dozen read as a
 * shift, or a crowd at the rail.
 */
export const PIT_ROUTES = ["floor_edge", "mid_bench", "rim_road", "ramp"] as const;

/** The ramp's index in `routes`. Moving bodies ride it; standing ones never do. */
export const RAMP_ROUTE = 3;

/** How standing bodies split across the three loops. Weighted toward the rail
 *  above the floor, which is where anyone would actually stand. */
const STANDING_WEIGHT = [4, 3, 3];

export function buildPitCrowd(input: {
  /** Bodies keyed to something that exists. See the header. */
  standing: number;
  /** 0..1 intensity keyed to something that happened, in a window that closes. */
  intensity: number;
  /** Distinguishes one world's crowd layout from another's. */
  seed?: string;
}): PitCrowd {
  const midBand = Math.floor((TIERS - 1) / 2);
  const routes: Route[] = [
    makeRoute(tierLoop(1), true),
    makeRoute(tierLoop(midBand), true),
    // The rim road runs outside the tiers and inside the plant belt.
    makeRoute(circle(0, 0, RIM_RADIUS + 4, 72), true),
    makeRoute(rampPath(), false),
  ];

  const standing = Math.min(MAX_STANDING, Math.max(0, Math.floor(input.standing)));
  const intensity = Math.min(1, Math.max(0, input.intensity));
  const moving = Math.round(intensity * MAX_MOVING);

  // Deterministic: the same world renders the same crowd on every visit.
  const rng = mulberry32(hashStr(`${input.seed ?? "pit"}-${standing}-${moving}`));

  const bag: number[] = [];
  STANDING_WEIGHT.forEach((w, i) => {
    for (let k = 0; k < w; k++) bag.push(i);
  });

  const walkers: PitWalker[] = [];
  for (let i = 0; i < standing; i++) {
    const route = bag[Math.floor(rng() * bag.length)];
    walkers.push({
      route,
      offset: rng() * routes[route].length,
      // Slow enough to read as being somewhere, not as commuting through it.
      speed: 1.3 + rng() * 0.9,
      lane: (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 1.5),
      phase: rng() * Math.PI * 2,
      moving: false,
    });
  }
  for (let i = 0; i < moving; i++) {
    walkers.push({
      route: RAMP_ROUTE,
      offset: rng() * routes[RAMP_ROUTE].length * 2,
      speed: 3.6 + rng() * 1.6,
      lane: (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.8),
      phase: rng() * Math.PI * 2,
      moving: true,
    });
  }

  return { routes, walkers, standing, moving };
}
