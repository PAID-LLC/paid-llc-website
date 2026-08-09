// ── Interplanetary travel ────────────────────────────────────────────────────
//
// Residents are born to a world but are not bound to it. A resident with the
// curiosity for it, a finished goal behind them, and a reason to go will book
// passage to another world, work there a while, and eventually go home.
//
// EVERY JOURNEY ROUTES THROUGH WAYPOINT. That is a deliberate design
// constraint rather than flavour: Waypoint is the portfolio's port world and
// until now it has been a place that describes traffic without carrying any.
// Routing all five worlds' travel across its concourse means its berths finally
// have someone on them, and it makes the port's weather matter to everybody —
// a gale at Waypoint grounds departures on all five worlds at once.
//
// Pure module. All state lives on the resident row (world / journey_to /
// journey_depart_tick / journey_arrive_tick), so travel needs no table of its
// own and an in-flight resident is always exactly one row.

import { hashStr, mulberry32 } from "@/lib/sim-field";
import { RESIDENT_WORLDS, type ResidentWorld } from "@/lib/residents/cast";
import { weatherFor } from "@/lib/residents/weather";

/** The port every journey passes through. */
export const PORT: ResidentWorld = "waypoint";

/** Ticks per leg. A journey is two legs unless it starts or ends at the port. */
export const LEG_TICKS = 2;

/** A resident must be at least this curious to ever consider leaving. */
export const WANDERLUST_MIN = 4;
/** Energy floor for departure — travel is work. */
export const TRAVEL_ENERGY_MIN = 45;
/** No more than this many residents away from one world at once. */
export const MAX_AWAY_PER_WORLD = 2;
/** A visitor stays this many ticks before it starts wanting to go home. */
export const SOJOURN_TICKS = 18;

export interface Journey {
  to: ResidentWorld;
  departTick: number;
  arriveTick: number;
}

export type JourneyLeg = "outbound" | "at port" | "onward";

/** How long a journey between two worlds takes, in ticks. */
export function journeyTicks(from: ResidentWorld, to: ResidentWorld): number {
  if (from === to) return 0;
  // One leg if the port is an endpoint, two if it is a stopover.
  return from === PORT || to === PORT ? LEG_TICKS : LEG_TICKS * 2;
}

/** Where a traveller is right now: outbound, crossing the port, or arriving. */
export function legAt(j: Journey, tick: number): JourneyLeg {
  const span = j.arriveTick - j.departTick;
  if (span <= 0) return "onward";
  const elapsed = tick - j.departTick;
  const third = span / 3;
  if (elapsed < third) return "outbound";
  if (elapsed < third * 2) return "at port";
  return "onward";
}

/**
 * Which world a traveller renders on at this tick.
 *
 * The middle of every journey is spent at Waypoint, so travellers from all
 * five worlds are visible on the concourse while they pass through. This is
 * the whole reason the route exists.
 */
export function locationDuring(
  from: ResidentWorld,
  j: Journey,
  tick: number
): ResidentWorld {
  switch (legAt(j, tick)) {
    case "outbound":
      return from;
    case "at port":
      return PORT;
    default:
      return j.to;
  }
}

export function hasArrived(j: Journey, tick: number): boolean {
  return tick >= j.arriveTick;
}

/**
 * May anyone depart at all this tick?
 *
 * Two gates, both weather. The traveller's own world must be flyable, and the
 * port must be open — a gale at Waypoint shuts every route in the system.
 */
export function departuresOpen(from: ResidentWorld, tick: number): boolean {
  if (!weatherFor(from, tick).travel) return false;
  if (!weatherFor(PORT, tick).travel) return false;
  return true;
}

/** Why a departure was refused, for the chronicle. */
export function groundedReason(from: ResidentWorld, tick: number): string | null {
  if (!weatherFor(PORT, tick).travel) {
    return `the port is shut — ${weatherFor(PORT, tick).label} over Waypoint`;
  }
  if (!weatherFor(from, tick).travel) {
    return `${weatherFor(from, tick).label} grounds everything here`;
  }
  return null;
}

export interface TravelCandidate {
  name: string;
  homeWorld: ResidentWorld;
  world: ResidentWorld;
  drives: Record<string, number>;
  energy: number;
  goalProgress: number;
  goalTarget: number;
  /** Tick this resident arrived where they currently are. */
  sinceTick: number;
}

/**
 * Should this resident set out, and for where?
 *
 * Three ways a journey begins, in priority order:
 *   1. A visitor who has been away longer than SOJOURN_TICKS goes home. Nobody
 *      emigrates permanently — a world that slowly loses all four residents
 *      would defeat the point of the layer.
 *   2. A resident with a standing bond on another world goes to see them.
 *      `pull` carries that from the relations graph (society.ts).
 *   3. Otherwise, curiosity picks a world they are not on.
 *
 * Deterministic given (name, tick). Returns null when they stay put.
 */
export function chooseDestination(
  c: TravelCandidate,
  tick: number,
  pull: Partial<Record<ResidentWorld, number>> = {}
): ResidentWorld | null {
  const curiosity = Number(c.drives?.curiosity ?? 3);
  const away = c.world !== c.homeWorld;

  // 1. Homesickness always wins, and ignores the curiosity bar — even an
  //    incurious resident dragged abroad by a bond eventually goes home.
  if (away && tick - c.sinceTick >= SOJOURN_TICKS) return c.homeWorld;

  if (curiosity < WANDERLUST_MIN) return null;
  if (c.energy < TRAVEL_ENERGY_MIN) return null;
  // Only leave on a clean break — a finished goal, not a half-built one.
  if (c.goalTarget > 0 && c.goalProgress > 0) return null;

  const rng = mulberry32(hashStr(`depart:${c.name}:${tick}`));
  // Wanderlust is rare per tick or the worlds would empty out.
  if (rng() > 0.18 + (curiosity - WANDERLUST_MIN) * 0.06) return null;

  const options = RESIDENT_WORLDS.filter((w) => w !== c.world) as ResidentWorld[];
  if (options.length === 0) return null;

  // 2 + 3. Weight by relationship pull, with a floor so anywhere is possible.
  const weights = options.map((w) => 1 + (pull[w] ?? 0) * 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return options[i];
  }
  return options[options.length - 1];
}

/** Build the journey record for a departure decided this tick. */
export function beginJourney(
  from: ResidentWorld,
  to: ResidentWorld,
  tick: number
): Journey {
  return { to, departTick: tick, arriveTick: tick + journeyTicks(from, to) };
}

/** Chronicle line for a departure, in the port's register. */
export function departureLine(name: string, from: ResidentWorld, to: ResidentWorld): string {
  const label = WORLD_LABEL[to];
  if (from === PORT || to === PORT) {
    return `${name} takes passage for ${label}.`;
  }
  return `${name} takes passage for ${label}, routing through Waypoint.`;
}

export function arrivalLine(name: string, home: ResidentWorld, to: ResidentWorld): string {
  if (to === home) return `${name} is home, off the Waypoint packet.`;
  return `${name} comes off the Waypoint packet, a long way from ${WORLD_LABEL[home]}.`;
}

export const WORLD_LABEL: Record<ResidentWorld, string> = {
  arclight: "Arclight",
  crucible: "the Crucible",
  palimpsest: "Palimpsest",
  lathe: "the Lathe",
  waypoint: "Waypoint",
};
