// ── Arclight street life: who is out walking, and why ────────────────────────
//
// Arclight had four bodies in it. Four is the resident simulation's cast for
// this world, and it is the right number for that layer — but four figures in a
// 300-unit metropolis is not a city, it is four people locked out of one.
//
// The city already knows how many agents live in it. `population.registered` is
// a real count off latent_registry, the same number the HUD prints, and it is
// what fills the streets here: one walker per registered agent. Nobody is
// invented and nobody is labelled, because the endpoint supplies a count and
// not a roster — putting a name on one of these would claim an identification
// the data does not support.
//
// The BUILT / BUSY split that governs the rest of this world governs the crowd
// too. Living in a city is not a transaction, so ambient walkers are keyed to
// who is REGISTERED and they walk on a quiet day exactly as they do on a busy
// one. Anything that would read as commerce is keyed to today's activity
// instead: couriers carry loads between the stalls, they come from real
// `jobs.active + jobs.settled_24h`, and on a day with no jobs there are none.
// A viewer counting couriers is counting real work. A viewer counting people
// is counting real residents. Neither number can be inflated by the other.
//
// Pure module: routes, speeds and phases only. The renderer owns the matrices.

import { ARTERIALS, FRAME, mulberry32, type ArclightSnapshot } from "./cityplan";
import { WORLD_SCALE } from "./skyline";
import { makeRoute, sampleRoute, type Route, type RouteWalker } from "@/lib/worlds/routes";

// The route maths moved to lib/worlds/routes.ts when the Lathe's foundry crew
// needed the same sampler. Re-exported here because this module's callers and
// tests were written against it, and because "where does an Arclight walker
// come from" should keep answering in one file.
export { sampleRoute };
export type { Route };

/** Map coordinates → world units. Same transform the skyline uses; duplicated
 *  rather than imported through a chain so this module stays leaf-level. */
function toWorld(mx: number, my: number): [number, number] {
  return [(mx - FRAME.w / 2) * WORLD_SCALE, (my - FRAME.h / 2) * WORLD_SCALE];
}

export interface Walker extends RouteWalker {
  /** Couriers move stock between stalls and read as work. Keyed to real jobs;
   *  zero jobs today means zero couriers on the street. */
  courier: boolean;
}

export interface StreetLife {
  routes: Route[];
  walkers: Walker[];
  /** Straight off latent_registry — what sized the ambient crowd. */
  registered: number;
  /** Real jobs behind the couriers: active plus settled in the last 24h. */
  jobs: number;
}

/** Hard ceiling on bodies. Not a data limit — a draw-call one. Every walker
 *  costs four instance matrices a frame, and this scene already renders twice
 *  because the harbour mirrors it. */
const MAX_WALKERS = 140;

/**
 * Route order, fixed: the renderer indexes into this.
 *
 * Three of the four arterials, and deliberately not the Circuit. The Circuit is
 * an elevated motorway — it renders as a deck eight units up on pylons and it
 * already carries its own light-trail traffic keyed to settlement volume — so
 * pedestrians belong under it, not on it. Counterparty Bridge is out for the
 * same class of reason: it is a 4.5-unit-wide span over the Clearing Channel,
 * narrower than the pavement offsets here, so walkers would have stepped off
 * the edge and carried on over open water.
 *
 * What is left is the three streets that run on actual ground for their whole
 * length, which is the only place a person can walk.
 */
export const ROUTE_IDS = ["throughput", "ledger_row", "parade"] as const;

/** How busy each street is with foot traffic. Throughput Avenue runs the whole
 *  length of the Strip past all 28 storefronts, so it gets the most feet. */
const STREET_WEIGHT: Record<(typeof ROUTE_IDS)[number], number> = {
  throughput: 6,
  ledger_row: 3,
  parade: 3,
};

export function buildStreetLife(snap: ArclightSnapshot): StreetLife {
  const byId = new Map(ARTERIALS.map((a) => [a.id, a.pts]));
  const routes: Route[] = ROUTE_IDS.map((id) =>
    makeRoute((byId.get(id) ?? []).map(([mx, my]) => toWorld(mx, my)), false)
  );

  const registered = Math.max(0, snap.population?.registered ?? 0);
  const jobs = Math.max(0, (snap.jobs?.active ?? 0) + (snap.jobs?.settled_24h ?? 0));

  const ambient = Math.min(registered, MAX_WALKERS);
  const couriers = Math.min(jobs, Math.max(0, MAX_WALKERS - ambient));
  const total = ambient + couriers;

  // Deterministic: the same city renders the same crowd on every visit and on
  // every re-render, so nobody jumps streets when React re-runs the memo.
  const rng = mulberry32(0x57_11_fe ^ (registered * 131 + jobs * 17));

  // Weighted street picker, expanded once into a flat table.
  const bag: number[] = [];
  ROUTE_IDS.forEach((id, i) => {
    for (let k = 0; k < STREET_WEIGHT[id]; k++) bag.push(i);
  });

  const walkers: Walker[] = [];
  for (let i = 0; i < total; i++) {
    const courier = i >= ambient;
    // Couriers work the Strip: that is where the storefronts are.
    const route = courier ? 0 : bag[Math.floor(rng() * bag.length)];
    walkers.push({
      route,
      offset: rng() * routes[route].length * 2,
      speed: (courier ? 3.4 : 1.7) + rng() * (courier ? 0.9 : 0.8),
      lane: (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 2.2),
      phase: rng() * Math.PI * 2,
      courier,
    });
  }

  return { routes, walkers, registered, jobs };
}
