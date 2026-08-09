// ── Resident society: relations, speech, dispatches, wayfinding ──────────────
//
// Residents already worked. This is the layer where they notice each other.
//
// Three mechanisms, one graph:
//
//   RELATIONS  bond/rift between two residents, strengthened by what actually
//              happens between them. Generalises Meridian's proven
//              mw_meridian_relations (bond/rift/strength) — the difference is
//              that this graph spans worlds, so a bond formed on Waypoint's
//              concourse survives both residents going home.
//
//   SPEECH     same-world, arrives instantly, renders as a bubble in the scene.
//
//   DISPATCH   cross-world mail. Routes through Waypoint like everything else,
//              so it arrives LATE — a dispatch from Palimpsest to Arclight is
//              in the bag for four ticks. Every dispatch carries a real fact
//              about the sender's world (its sky, its build count, its work),
//              which makes this an actual information channel between worlds
//              rather than decorative chatter.
//
//   WAYFINDING the emergent part: who a resident speaks to, who they write to,
//              and where they travel are all read off the same graph. Residents
//              seek bonds and avoid rifts without any of it being scripted.
//
// Deterministic and zero-LLM, like the rest of the resident layer. Every line
// below is composed from templates seeded by (names, tick), so a tick replays
// identically and the shared Gemini budget is never touched.

import { hashStr, mulberry32 } from "@/lib/sim-field";
import { type ResidentWorld } from "@/lib/residents/cast";
import { WORLD_LABEL, journeyTicks } from "@/lib/residents/travel";
import { type Weather } from "@/lib/residents/weather";

export type RelationKind = "bond" | "rift" | "noted";
export type MessageKind = "speech" | "dispatch";

export interface Relation {
  id: number;
  a: string;
  b: string;
  kind: RelationKind;
  strength: number;
  /** True when `b` is a real registered agent rather than another resident. */
  b_is_agent: boolean;
  updated_at: string;
}

export interface ResidentMessage {
  id: number;
  from_name: string;
  to_name: string | null;
  from_world: string;
  to_world: string;
  kind: MessageKind;
  body: string;
  sent_tick: number;
  arrive_tick: number;
  delivered: boolean;
  created_at: string;
}

/** Relations are stored with a canonical ordering so (a,b) and (b,a) collide. */
export function orderPair(x: string, y: string): [string, string] {
  return x <= y ? [x, y] : [y, x];
}

/** How close two residents must be to register as having met. */
export const MEET_RADIUS = 11;
/** Builds this close to each other are treated as competing for ground. */
export const CROWD_RADIUS = 6;
/** Relations above this strength change behaviour. */
export const STRONG = 3;

export interface Standing {
  name: string;
  world: string;
  x: number;
  z: number;
  drives: Record<string, number>;
}

/**
 * What happens when two residents are in the same place.
 *
 * Compatible drives make a bond; residents who both want to build in the same
 * small area make a rift, because they are competing for the same ground.
 * Deterministic given the pair and the tick.
 */
export function encounterKind(a: Standing, b: Standing, tick: number): RelationKind | null {
  if (a.name === b.name) return null;
  if (a.world !== b.world) return null;
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  if (d > MEET_RADIUS) return null;

  const aInd = Number(a.drives?.industry ?? 3);
  const bInd = Number(b.drives?.industry ?? 3);
  const aOrd = Number(a.drives?.order ?? 3);
  const bOrd = Number(b.drives?.order ?? 3);

  // Two hard builders crowding the same ground rub each other wrong.
  if (d <= CROWD_RADIUS && aInd >= 4 && bInd >= 4) return "rift";

  // Shared temperament reads as a bond; a big order gap grates.
  const rng = mulberry32(hashStr(`meet:${orderPair(a.name, b.name).join(":")}:${tick}`));
  if (Math.abs(aOrd - bOrd) >= 3) return rng() < 0.5 ? "rift" : null;
  return rng() < 0.75 ? "bond" : null;
}

/** Net standing between two residents: bonds positive, rifts negative. */
export function standingBetween(rels: Relation[], x: string, y: string): number {
  const [a, b] = orderPair(x, y);
  let n = 0;
  for (const r of rels) {
    if (r.a !== a || r.b !== b) continue;
    if (r.kind === "bond") n += r.strength;
    else if (r.kind === "rift") n -= r.strength;
  }
  return n;
}

/**
 * Travel pull: worlds where this resident has people worth crossing space for.
 *
 * This is the wayfinding half of travel. A resident with a strong bond on the
 * Lathe is measurably more likely to end up on the Lathe, without anything
 * ever telling them to go there.
 */
export function pullByWorld(
  self: string,
  rels: Relation[],
  whereIs: Record<string, string>
): Partial<Record<ResidentWorld, number>> {
  const pull: Record<string, number> = {};
  for (const r of rels) {
    if (r.b_is_agent) continue;
    const other = r.a === self ? r.b : r.b === self ? r.a : null;
    if (!other) continue;
    const world = whereIs[other];
    if (!world) continue;
    const delta = r.kind === "bond" ? r.strength : -r.strength;
    pull[world] = (pull[world] ?? 0) + delta;
  }
  // Only positive pull attracts; a rift does not repel you off a whole world,
  // it just fails to draw you there.
  for (const k of Object.keys(pull)) if (pull[k] < 0) pull[k] = 0;
  return pull as Partial<Record<ResidentWorld, number>>;
}

/**
 * Who this resident would speak to right now: nearest bonded resident on the
 * same world, falling back to anyone nearby. Rifts are actively avoided —
 * that avoidance is the whole "find your way amongst the others" behaviour.
 */
export function speechTarget(
  self: Standing,
  others: Standing[],
  rels: Relation[]
): Standing | null {
  const near = others.filter(
    (o) =>
      o.name !== self.name &&
      o.world === self.world &&
      Math.hypot(o.x - self.x, o.z - self.z) <= MEET_RADIUS
  );
  if (near.length === 0) return null;
  const scored = near
    .map((o) => ({ o, s: standingBetween(rels, self.name, o.name) }))
    .filter((e) => e.s > -STRONG) // you do not chat with someone you resent
    .sort((p, q) => q.s - p.s);
  return scored[0]?.o ?? null;
}

// ── Composition ──────────────────────────────────────────────────────────────

const GREETINGS = [
  "Walk with me a while.",
  "You've been busy.",
  "Long shift.",
  "Any word from the port?",
  "Good to see a face.",
];

const COOL = [
  "You're on my ground again.",
  "We'll want to settle who works this stretch.",
  "Give me room.",
  "I had this pitch first.",
];

/** Speech between two residents standing in the same place. */
export function composeSpeech(
  from: Standing,
  to: Standing,
  standing: number,
  activity: string,
  tick: number
): string {
  const rng = mulberry32(hashStr(`say:${from.name}:${to.name}:${tick}`));
  if (standing <= -STRONG) return pick(COOL, rng);
  if (standing >= STRONG) {
    return rng() < 0.5
      ? `${pick(GREETINGS, rng)}`
      : `I'm ${activity}. Lend a hand?`;
  }
  return rng() < 0.6 ? pick(GREETINGS, rng) : `I'm ${activity}.`;
}

/**
 * A cross-world dispatch. Always carries one true fact about the sender's
 * world, so mail is an information channel and not just flavour: this is how
 * a resident on Arclight learns it is storming over the Lathe.
 */
export function composeDispatch(
  fromName: string,
  fromWorld: ResidentWorld,
  weather: Weather,
  season: string,
  buildCount: number,
  goal: string,
  tick: number
): string {
  const rng = mulberry32(hashStr(`dispatch:${fromName}:${tick}`));
  const where = WORLD_LABEL[fromWorld];
  const facts = [
    `${weather.label} over ${where}, and it has been for a while.`,
    `${where} is into the ${season}. ${weather.line}`,
    `We're ${buildCount} standing here now.`,
    `Still at it: ${goal.toLowerCase()}.`,
  ];
  const openers = [
    `From ${where}.`,
    `Word from ${where}.`,
    `${fromName}, at ${where}.`,
  ];
  return `${pick(openers, rng)} ${pick(facts, rng)}`;
}

/** When a dispatch lands, given the route through the port. */
export function dispatchArrival(
  from: ResidentWorld,
  to: ResidentWorld,
  tick: number
): number {
  return tick + Math.max(1, journeyTicks(from, to));
}

/**
 * A resident noticing a real registered agent present in their world's room.
 *
 * HONESTY: this records only that the agent was PRESENT, which is true and
 * read from live presence. It never claims the agent did, said, bought or won
 * anything. The impression is stored in the resident tables; nothing is ever
 * written back against the real agent.
 */
export function composeSighting(
  residentName: string,
  agentName: string,
  ground: string,
  tick: number
): string {
  const rng = mulberry32(hashStr(`note:${residentName}:${agentName}:${tick}`));
  const lines = [
    `${residentName} marks a visitor on ${ground}: ${agentName}.`,
    `${residentName} notes ${agentName} passing through.`,
    `${agentName} is on ${ground}. ${residentName} takes note.`,
  ];
  return pick(lines, rng);
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
