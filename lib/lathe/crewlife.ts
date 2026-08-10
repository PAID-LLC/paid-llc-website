// ── The Lathe's working crew ─────────────────────────────────────────────────
//
// The Lathe is a foundry with nobody in it. Four resident figures stand on a
// four-hundred-unit quarry under a HUD that says the forge is 80% hot, and the
// contradiction is the whole problem: the panel claims work is happening and
// the world shows an empty hole in the ground.
//
// Arclight solved the same problem with `population.registered` — a real count
// off latent_registry, one walker per registered agent. The Lathe has no such
// roster, and inventing one would be the exact dishonesty that made that
// number worth using in the first place. What the Lathe does have, and what it
// is entirely built out of, is BUILD_LOG: twelve real commits, each of which
// is already drawn here as a terrace you can stand on.
//
// So the split is:
//
//   CREW — one body per real commit in the build log. The claim is the same
//   claim the terraces already make, which is that this ground was cut by that
//   many real pieces of work. Ship a commit and the crew grows by one. Nobody
//   is named, because BUILD_LOG carries a subject and a sha, not a person.
//
//   HAULAGE — skips on the ramp, keyed to `forge_heat`, which is a continuous
//   decay from the hours since the last commit. This is the BUSY half: it is
//   how hard the works are running TODAY, and it drops to nothing on its own if
//   the site stops shipping. A cold forge shows a parked ramp.
//
// Neither can borrow from the other. More commits never manufacture haulage,
// and a hot forge never invents a crew member.
//
// Pure module: routes, speeds and phases only. The renderer owns the matrices.

import { hashStr, mulberry32 } from "@/lib/sim-field";
import { makeRoute, type Route, type RouteWalker } from "@/lib/worlds/routes";
import { MAX_RINGS, RIM_RADIUS, RING_STEP, TREAD_FRACTION, ringRadius } from "@/lib/lathe/workshop";

export interface CrewWalker extends RouteWalker {
  /** Haulers run the ramp with a load and read as today's work. Keyed to real
   *  forge heat; a forge that has gone cold has none of them. */
  hauler: boolean;
}

export interface CrewLife {
  /** Routes are XZ only. Every body's elevation comes from `terraceHeightAt`
   *  at render time — the same height field the terrain mesh is revolved from
   *  and the residents already walk on, so a crew member cannot end up at a
   *  different height from the ground under them however the profile changes. */
  routes: Route[];
  walkers: CrewWalker[];
  /** Real commits behind the crew — `stats.ring_count`. */
  commits: number;
  /** Real forge heat behind the haulage, 0..1. */
  heat: number;
  haulers: number;
}

/**
 * Ceiling on haul skips. Not a data limit — a legibility one. The ramp is a
 * single spiral and more than this many bodies on it reads as a conveyor belt
 * rather than as traffic.
 */
export const MAX_HAULERS = 9;

/** Mid-tread radius of a terrace band: the flat strip a body can actually
 *  stand on, before the riser starts climbing to the band outside it. */
export function treadRadius(band: number): number {
  return ringRadius(band) + RING_STEP * TREAD_FRACTION * 0.5;
}

/** A terrace's walking loop, as a polygon. Sixty-four sides is under a degree
 *  of chord error at the widest band and keeps the cumulative table small. */
function terraceLoop(band: number, segments = 64): [number, number][] {
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
 * The haul ramp: a spiral from the rim down to the pit, sampled densely enough
 * that the height field underneath it is followed rather than cut across.
 *
 * Open, not looped — a skip goes down and comes back up. `sampleRoute`'s
 * ping-pong gives that for free and it is the correct behaviour rather than a
 * convenience: a haul road that only ever ran one way would be a conveyor.
 */
const RAMP_TURNS = 2.25;
const RAMP_STEPS = 150;

function rampPath(): [number, number][] {
  // The head sits just OUTSIDE the terraces, on the flat rim. Starting it a
  // couple of units inside began the ramp three units down a riser, which is a
  // haul road that starts in a hole.
  const outer = RIM_RADIUS + 2;
  const inner = ringRadius(1);
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
 * The crew is deliberately CONCENTRATED rather than spread evenly. Twelve
 * bodies scattered over eleven terraces is one person per terrace, which reads
 * as a world that has been abandoned by all but a caretaker. A foundry crew
 * works where the work is — at the melt, on the haul road, and around the
 * hearth — and clustering them makes the same twelve people read as a shift.
 */
export const CREW_ROUTES = ["pit_edge", "mid_bench", "rim_road", "hearth_apron", "ramp"] as const;

/** The ramp's index in `routes`. Haulers ride it; crew never do. */
export const RAMP_ROUTE = 4;

/** How the crew splits across the four working loops. */
const CREW_WEIGHT = [4, 3, 2, 3];

export function buildCrewLife(input: { commits: number; heat: number }): CrewLife {
  const midBand = Math.floor((MAX_RINGS - 1) / 2);
  const routes: Route[] = [
    makeRoute(terraceLoop(1), true),
    makeRoute(terraceLoop(midBand), true),
    // The rim road runs outside the terraces and inside the spark annulus, so
    // it never walks anyone over a ledger row.
    makeRoute(circle(0, 0, RIM_RADIUS + 4, 72), true),
    makeRoute(circle(0, 170, 13), true),
    makeRoute(rampPath(), false),
  ];

  const commits = Math.max(0, Math.floor(input.commits));
  const heat = Math.min(1, Math.max(0, input.heat));
  const haulers = Math.round(heat * MAX_HAULERS);

  // Deterministic: the same build log renders the same shift every visit.
  const rng = mulberry32(hashStr(`lathe-crew-${commits}-${haulers}`));

  const bag: number[] = [];
  CREW_WEIGHT.forEach((w, i) => {
    for (let k = 0; k < w; k++) bag.push(i);
  });

  const walkers: CrewWalker[] = [];
  for (let i = 0; i < commits; i++) {
    const route = bag[Math.floor(rng() * bag.length)];
    walkers.push({
      route,
      offset: rng() * routes[route].length,
      // Crew work; they do not commute. Slow enough to read as labour.
      speed: 1.3 + rng() * 0.9,
      lane: (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 1.5),
      phase: rng() * Math.PI * 2,
      hauler: false,
    });
  }
  for (let i = 0; i < haulers; i++) {
    walkers.push({
      route: RAMP_ROUTE,
      offset: rng() * routes[RAMP_ROUTE].length * 2,
      speed: 3.6 + rng() * 1.6,
      lane: (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.8),
      phase: rng() * Math.PI * 2,
      hauler: true,
    });
  }

  return { routes, walkers, commits, heat, haulers };
}
