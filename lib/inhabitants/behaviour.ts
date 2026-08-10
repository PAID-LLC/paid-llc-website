// ── What a figure does between ticks ─────────────────────────────────────────
//
// The resident engine moves everybody once every thirty minutes. That is the
// right cadence for a simulation whose unit of work is "raise a lamp", and the
// wrong cadence for a body: for 1,799 of those 1,800 seconds the scene showed
// a figure standing perfectly still under a label reading "sweeping the
// frontage". The label was true and the body contradicted it.
//
// This module supplies the seconds in between. The tick still decides
// everything that MEANS anything — which district you are in, what you are
// doing, who you spoke to. None of that is invented here. What is added is the
// part that was never in the simulation to begin with: where inside your own
// district you happen to be standing right now, and whether you are mid-stride.
//
// The rule that keeps it honest: the server position is a LEASH ANCHOR, not a
// destination. A figure wanders inside a small radius of where the tick put it
// and never leaves that radius, so the scene can be read against the roster and
// agree with it. When the tick moves the anchor, the leash moves and the figure
// walks the whole way — that journey is real, it just used to happen in one
// frame instead of over a few seconds.
//
// Pure functions, no three.js, no fetches, so the behaviour can be unit-tested
// without a renderer. Deterministic: the same (id, step) always yields the same
// spot, which is what stops a figure from twitching to a new position every
// time React re-renders.

import { hashStr, mulberry32 } from "@/lib/sim-field";

// ── Beats ────────────────────────────────────────────────────────────────────
//
// The engine writes activity as a free phrase ("carrying a crate to the
// stalls", "reading the traffic on the main row"). Rather than ask the engine
// for a new column, the phrase is classified here into one of six body
// languages. Keyword matching on a vocabulary the engine actually generates —
// see lib/residents/engine.ts's cfg.resting / tending / studying tables and the
// hard-coded `crossing`, `raising`, `carrying`, `bound for` phrasings.

export type Beat = "haul" | "build" | "work" | "study" | "rest" | "walk";

const BEAT_WORDS: { beat: Beat; words: readonly string[] }[] = [
  { beat: "haul", words: ["carry", "carrying", "crate", "hauling", "delivery", "deliver", "load", "cart"] },
  { beat: "build", words: ["raising", "raise", "building", "build", "laying", "erect", "awning", "scaffold"] },
  { beat: "study", words: ["reading", "read", "studying", "study", "watching", "watch", "counting", "listening", "traffic", "charting"] },
  { beat: "rest", words: ["resting", "rest", "sitting", "idle", "waiting", "wait", "sheltering", "asleep", "still"] },
  { beat: "walk", words: ["crossing", "bound for", "under way", "transit", "walking", "concourse", "arriving", "just off"] },
  { beat: "work", words: ["sweeping", "sweep", "tending", "tend", "mending", "cleaning", "stacking", "working", "stall", "frontage"] },
];

/** Classify a server activity phrase into a body language. Unknown phrases
 *  fall through to `work`, which is the general-purpose busy-hands beat. */
export function beatFor(activity: string | undefined | null): Beat {
  const a = (activity ?? "").toLowerCase();
  if (!a) return "work";
  for (const { beat, words } of BEAT_WORDS) {
    for (const w of words) if (a.includes(w)) return beat;
  }
  return "work";
}

export interface BeatStyle {
  /** Fraction of the leash this beat actually uses. A builder works one spot;
   *  a courier crosses the whole district. */
  range: number;
  /** Seconds held at a target before picking the next, [min, max]. */
  dwell: readonly [number, number];
  /** Walking pace in scene units per second. */
  pace: number;
  /** Arm gesture amplitude while stationary — the tell that a standing figure
   *  is doing something rather than waiting for something. */
  gesture: number;
  /** Extra body lean while moving, radians. Hauling bends you forward. */
  lean: number;
}

export const BEAT_STYLE: Record<Beat, BeatStyle> = {
  haul: { range: 1, dwell: [1.2, 2.6], pace: 2.5, gesture: 0.12, lean: 0.13 },
  build: { range: 0.28, dwell: [5, 9], pace: 1.7, gesture: 0.85, lean: 0.05 },
  work: { range: 0.55, dwell: [2.5, 5], pace: 1.9, gesture: 0.62, lean: 0.05 },
  study: { range: 0.35, dwell: [6, 11], pace: 1.5, gesture: 0.16, lean: 0 },
  rest: { range: 0.2, dwell: [9, 16], pace: 1.2, gesture: 0.04, lean: 0 },
  walk: { range: 1, dwell: [0.4, 1.4], pace: 2.9, gesture: 0.1, lean: 0.08 },
};

// ── Wander ───────────────────────────────────────────────────────────────────

/** The next spot this figure strolls to, as an offset from its leash anchor.
 *
 *  Deterministic in (id, step): step is a counter the renderer bumps each time
 *  a figure arrives, so a component remount replays the same walk instead of
 *  teleporting the figure somewhere new. Returned in the -1..1 unit square; the
 *  caller scales it by the world's own leash, which is anisotropic because
 *  Waypoint is a runway and Crucible is a circle. */
export function wanderOffset(id: string, step: number, beat: Beat): [number, number] {
  const rng = mulberry32((hashStr(id) ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0);
  const angle = rng() * Math.PI * 2;
  // sqrt keeps the distribution even across the disc instead of clumping at
  // the anchor, then the beat's range decides how much of it is used.
  const r = Math.sqrt(rng()) * BEAT_STYLE[beat].range;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

/** Seconds this figure holds station on arrival, for this beat and step. */
export function dwellFor(id: string, step: number, beat: Beat): number {
  const rng = mulberry32((hashStr(id) ^ Math.imul(step + 7, 0x85ebca6b)) >>> 0);
  const [lo, hi] = BEAT_STYLE[beat].dwell;
  return lo + rng() * (hi - lo);
}

// ── Meetings ─────────────────────────────────────────────────────────────────
//
// The one piece of interaction here that is NOT ambient. Residents only stand
// together when the simulation says they actually spoke: every meeting below
// traces to a real row in world_resident_messages with a from and a to. Two
// figures drifting into the same alley is scenery; two figures squaring up and
// facing each other is a claim, so it needs a source.

export interface Meeting {
  /** Where this figure stands for the conversation. */
  x: number;
  z: number;
  /** Who they turn to look at. */
  faceX: number;
  faceZ: number;
}

/** How far apart two figures stand while talking, in scene units. */
const CONVERSATION_GAP = 3.4;

/** Pair up residents who exchanged speech this tick.
 *
 *  `at` is where the tick put each of them. The pair converge on the midpoint
 *  between their two anchors, which keeps the conversation inside the district
 *  both of them are already in and means neither has to cross the map to reach
 *  it. First message wins: a resident already in a conversation is not pulled
 *  into a second one. */
export function meetingsFrom(
  messages: readonly { from_name: string; to_name?: string | null; kind: string }[],
  at: ReadonlyMap<string, { x: number; z: number }>
): Map<string, Meeting> {
  const out = new Map<string, Meeting>();

  for (const m of messages) {
    if (m.kind !== "speech" || !m.to_name) continue;
    const a = at.get(m.from_name);
    const b = at.get(m.to_name);
    if (!a || !b) continue;
    if (out.has(m.from_name) || out.has(m.to_name)) continue;

    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) {
      // Same spot on the tick grid: pick an arbitrary but stable axis so the
      // pair still face each other instead of overlapping.
      dx = 1;
      dz = 0;
    } else {
      dx /= d;
      dz /= d;
    }
    const half = CONVERSATION_GAP / 2;

    const ax = mx - dx * half;
    const az = mz - dz * half;
    const bx = mx + dx * half;
    const bz = mz + dz * half;

    out.set(m.from_name, { x: ax, z: az, faceX: bx, faceZ: bz });
    out.set(m.to_name, { x: bx, z: bz, faceX: ax, faceZ: az });
  }

  return out;
}
