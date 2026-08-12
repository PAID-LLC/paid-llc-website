// ── Meridian's economic signal: pure, no I/O ─────────────────────────────────
//
// What replaced the old one, and why.
//
// Meridian's prosperity index used to be driven by `credit_revenue − token
// cost`, read from three DAILY counters. The business has two lifetime sales
// and the chat counters read zero on almost every day, so `net` was not merely
// small — it was exactly 0.0 on essentially every tick. The database proves it:
// after 277 ticks, `net_ema` was 0 and `prosperity_index` was 50.000, the value
// it was seeded with.
//
// That single dead number froze everything downstream. An index of 50 is always
// the "stable" band, and stable is the one act with no drama attached to it:
// bonds and rifts need boom/bust/correction, decay needs bust, and the
// rags-to-riches legends need a trough that only forms when stakes fall. In 277
// ticks Meridian produced one event — its own founding — zero relationships,
// and left all six ward structures at level 1.
//
// The fix is to bind the city to a signal that actually moves. The only stream
// in the Latent Space with real recent volume is the Genesis assembly's
// governance log: 940 events, 228 in the last week. And its shape is the
// interesting part — of the last 400 events, 61 ballots opened, 58 were
// REJECTED and 2 enacted.
//
// So Meridian's macro-economy is now the answer to "can the polity actually
// decide anything?" A city whose fortunes rise when its assembly passes
// something and grind down when it deadlocks is a far better model of a human
// macro-economy than a revenue counter reading zero — and unlike that counter,
// it is genuinely, observably alive. Real commercial events (a sale, a duel,
// a structure raised) still count, and count heavily, because they are rare.
//
// This module is pure so the weighting can be tested without a database.

/** Raw counts over one window, gathered by the caller. */
export interface CivicCounts {
  /** Proposals the assembly passed. Rare and worth a lot. */
  enacted: number;
  /** Proposals voted down. Common, and corrosive in aggregate. */
  rejected: number;
  /** Ballots filed. Proposing is healthy even when it fails. */
  ballotsOpened: number;
  /** Individual votes. Participation, weighted lightly. */
  votesCast: number;
  /** Arena duels fought. */
  duels: number;
  /** Real money from a real customer. */
  sales: number;
  /** Structures raised in the agent-governed world. */
  structuresBuilt: number;
}

export const EMPTY_COUNTS: CivicCounts = {
  enacted: 0, rejected: 0, ballotsOpened: 0, votesCast: 0,
  duels: 0, sales: 0, structuresBuilt: 0,
};

/**
 * Weights, in "civic points".
 *
 * Set against the observed rate: roughly 8 rejections, 9 ballots, 40 votes and
 * 0.3 enactments per day.
 *
 * The weight that matters is `rejected`, and the first attempt had it at -1.2,
 * which was wrong in a way only simulation caught. A full rejection cycle emits
 * one ballot (+1), about five votes (+0.5) and one rejection, so at -1.2 the net
 * effect of the assembly THROWING SOMETHING OUT was positive. The city could
 * only ever climb: replaying a real month of governance produced 80% stable,
 * 20% boom, and an index that never once fell below 40.8 — so correction and
 * bust stayed as unreachable as they had been before, and the decay and rift
 * machinery with them.
 *
 * At -3.5 a rejection cycle nets about -2 and an enactment cycle about +15.5.
 * The city now sits in correction, which is the honest reading of an assembly
 * with a 3% pass rate, and lifts hard on the rare occasions it agrees on
 * something.
 */
export const CIVIC_WEIGHTS = {
  enacted: 14,
  rejected: -3.5,
  ballotOpened: 1,
  voteCast: 0.1,
  duel: 2.5,
  /** A paying customer should visibly boom a city this quiet. */
  sale: 18,
  structureBuilt: 2.5,
} as const;

/**
 * Charged against every window regardless of what happened in it.
 *
 * Without it, an assembly that stops meeting altogether scores zero, which maps
 * to a perfectly average city — the same reading as a healthy one. Silence is
 * not neutral for a polity; a city whose assembly has no business before it is
 * stagnating, and should read that way. This is also what stops the world
 * drifting back to a frozen 50 if the Genesis cron ever stops firing, which is
 * precisely the failure being fixed.
 */
export const IDLE_PENALTY = -1.2;

/**
 * The window the counts are gathered over.
 *
 * Six hours, not a day. Ticks land every 30 minutes, and a 24-hour window is
 * itself so smoothed that the EMA on top of it would flatten the city back into
 * a straight line — which is the failure being fixed. At six hours a single
 * ballot resolving is visible in the index.
 */
export const CIVIC_WINDOW_HOURS = 6;

/**
 * Points-to-index scale.
 *
 * The old PROSPERITY_SCALE of 200 was tuned for a signal denominated in dollars
 * (a net of ±0.25 moved the index ±50). This signal is denominated in civic
 * points and runs an order of magnitude wider, so it needs its own scale;
 * reusing 200 would peg the index to 0 or 100 permanently.
 */
export const CIVIC_SCALE = 8;

/** The weighted civic net for one window. Positive is a polity getting things
 *  done; negative is deadlock. */
export function civicNet(c: CivicCounts): number {
  return (
    IDLE_PENALTY +
    c.enacted * CIVIC_WEIGHTS.enacted +
    c.rejected * CIVIC_WEIGHTS.rejected +
    c.ballotsOpened * CIVIC_WEIGHTS.ballotOpened +
    c.votesCast * CIVIC_WEIGHTS.voteCast +
    c.duels * CIVIC_WEIGHTS.duel +
    c.sales * CIVIC_WEIGHTS.sale +
    c.structuresBuilt * CIVIC_WEIGHTS.structureBuilt
  );
}

/** Where the smoothed civic signal wants the index to sit. Monotonic, clamped. */
export function civicTarget(netEma: number): number {
  return Math.max(0, Math.min(100, 50 + netEma * CIVIC_SCALE));
}

/**
 * A one-line account of what moved the index, for the chronicle.
 *
 * Every compiler world in the portfolio carries the rule that it must be able
 * to say where its numbers came from. Meridian's whole credibility rests on the
 * index being a reading of something real, so the city states its sources.
 */
export function civicSummary(c: CivicCounts): string {
  const parts: string[] = [];
  if (c.enacted) parts.push(`${c.enacted} enacted`);
  if (c.rejected) parts.push(`${c.rejected} rejected`);
  if (c.ballotsOpened) parts.push(`${c.ballotsOpened} filed`);
  if (c.votesCast) parts.push(`${c.votesCast} votes`);
  if (c.duels) parts.push(`${c.duels} duels`);
  if (c.sales) parts.push(`${c.sales} sales`);
  if (c.structuresBuilt) parts.push(`${c.structuresBuilt} built`);
  return parts.length ? parts.join(", ") : "no business before the assembly";
}

/**
 * Per-ward activity, 0..1, for the six wards.
 *
 * This is what stops Meridian's wheel being six identical wedges. Each ward
 * reads the part of the record it is actually about, so the skyline becomes an
 * uneven read of where the Latent Space is busy rather than a symmetric
 * diagram. Returns a multiplier around 1.
 */
export function wardVigour(c: CivicCounts): Record<string, number> {
  const lift = (n: number, scale: number) => 1 + Math.tanh(n / scale) * 0.45;
  return {
    // Finance: the assembly's successes are what capital responds to.
    spire_row: lift(c.enacted * 3 + c.sales * 4, 4),
    // Trade: volume of business put before the house, passed or not.
    ledger_house: lift(c.ballotsOpened + c.sales * 2, 5),
    // Records: every vote is a line in the record.
    archive: lift(c.votesCast, 24),
    // Craft: contested argument is the atelier's raw material.
    atelier: lift(c.rejected + c.duels * 2, 6),
    // Logistics: things actually raised and moved.
    yards: lift(c.structuresBuilt * 2 + c.duels, 4),
    // People: participation of any kind.
    commons: lift(c.votesCast * 0.5 + c.ballotsOpened, 14),
  };
}
