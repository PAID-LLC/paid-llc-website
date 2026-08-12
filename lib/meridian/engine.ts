// ── Meridian: the Macro-Vault's human colony (room 3) ────────────────────────
// Spec: cowork references/autoresearch/2026-07-21-meridian-spec-v1.md
//
// The inversion: everywhere else on the site AI agents are the residents; on
// Meridian, the agents simulate US. Six simulated human citizens hold
// personal fortunes ("stakes") that drift with a city-wide prosperity index
// derived from the site's own real economics — a boom/bust MARKET cycle in
// place of Substrate's weather. Tick-owned like Substrate: only the cron tick
// writes, so there is no injection surface.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import {
  CIVIC_WINDOW_HOURS, EMPTY_COUNTS, civicNet, civicSummary, civicTarget,
  type CivicCounts,
} from "@/lib/meridian/signals";

export const MERIDIAN_ROOM_ID = 3; // the Macro-Vault hosts the colony

export type Ward = "spire_row" | "ledger_house" | "archive" | "atelier" | "yards" | "commons";
export type Act = "boom" | "stable" | "correction" | "bust";

export const WARDS: Ward[] = ["spire_row", "ledger_house", "archive", "atelier", "yards", "commons"];

interface CitizenDef {
  name: string;
  epithet: string;
  archetype: string;
  ward: Ward;
  color: string;
  drives: { ambition: number; curiosity: number; kinship: number; caution: number };
  /** Stake-swing multiplier — Magnates and Brokers ride the cycle hard; Gardeners barely feel it. */
  volatility: number;
}

// Static identity lives in code (db/meridian.sql seeds the same six rows);
// this is the single source for epithets, drives, and volatility.
export const MERIDIAN_CAST: CitizenDef[] = [
  { name: "Vance", epithet: "the Magnate", archetype: "financier", ward: "spire_row", color: "#fbbf24",
    drives: { ambition: 5, curiosity: 2, kinship: 1, caution: 1 }, volatility: 1.6 },
  { name: "Cassia", epithet: "the Broker", archetype: "trader", ward: "ledger_house", color: "#f9a8d4",
    drives: { ambition: 4, curiosity: 4, kinship: 2, caution: 2 }, volatility: 1.3 },
  { name: "Oren", epithet: "the Archivist", archetype: "recordkeeper", ward: "archive", color: "#a78bfa",
    drives: { ambition: 1, curiosity: 4, kinship: 2, caution: 4 }, volatility: 0.6 },
  { name: "Mireille", epithet: "the Street Artist", archetype: "muralist", ward: "atelier", color: "#fb7185",
    drives: { ambition: 2, curiosity: 5, kinship: 3, caution: 1 }, volatility: 1.0 },
  { name: "Dario", epithet: "the Dockhand", archetype: "hauler", ward: "yards", color: "#7dd3fc",
    drives: { ambition: 4, curiosity: 1, kinship: 4, caution: 3 }, volatility: 0.8 },
  { name: "Teo", epithet: "the Gardener", archetype: "grower", ward: "commons", color: "#4ade80",
    drives: { ambition: 2, curiosity: 2, kinship: 4, caution: 5 }, volatility: 0.5 },
];

const CAST_BY_NAME = new Map(MERIDIAN_CAST.map((c) => [c.name, c]));
const CAST_BY_WARD = new Map(MERIDIAN_CAST.map((c) => [c.ward, c]));

// ── Types ────────────────────────────────────────────────────────────────────

export interface MeridianStateRow {
  id: number;
  tick: number;
  prosperity_index: number;
  net_ema: number;
  act: Act;
  act_since_tick: number;
  pending_act: Act | null;
  pending_ticks: number;
  updated_at: string;
}

export interface MeridianCitizenRow {
  id: number;
  name: string;
  epithet: string;
  archetype: string;
  ward: Ward;
  color: string;
  drives: Record<string, number>;
  stake: number;
  peak_stake: number;
  peak_tick: number;
  trough_stake: number;
  trough_tick: number;
  status: string;
  updated_at: string;
}

export type StructureLevel = 1 | 2 | 3;

export interface MeridianStructureRow {
  id: number;
  ward_kind: Ward;
  level: StructureLevel;
  tended_tick: number;
  created_at: string;
}

export type MeridianEventKind =
  | "founding" | "act_change" | "decay" | "level_up" | "rags_to_riches" | "riches_to_rags" | "bond" | "rift";

export interface MeridianEvent {
  id: number;
  kind: MeridianEventKind;
  summary: string;
  detail: Record<string, unknown>;
  tick: number;
  created_at: string;
}

export interface MeridianRelation {
  id: number;
  a: string;
  b: string;
  kind: "bond" | "rift";
  strength: number;
  updated_at: string;
}

export interface MeridianClock {
  tick: number;
  act: Act;
  actSinceTick: number;
  prosperityIndex: number;
}

export interface MeridianData {
  live: boolean;
  clock: MeridianClock;
  citizens: MeridianCitizenRow[];
  structures: MeridianStructureRow[];
  events: MeridianEvent[];
  relations: MeridianRelation[];
  /** The signal the skyline is compiled from, over the last CIVIC_WINDOW_HOURS. */
  civic: CivicCounts;
}

// ── DB helpers (same shape as lib/simworld.ts) ───────────────────────────────

async function sbGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function sbWrite(path: string, method: "POST" | "PATCH", body: unknown): Promise<boolean> {
  try {
    const res = await fetch(sbUrl(path), { method, headers: sbHeaders(), body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Pure market-cycle math (unit-tested) ─────────────────────────────────────

// Maps a day's net (revenue - token cost, small USD figures at this stage of
// the business) to an index swing. Tuned so a nickel of daily net moves the
// index meaningfully without a single good/bad day saturating it outright.
/**
 * @deprecated Superseded 2026-08-11 by CIVIC_SCALE in lib/meridian/signals.ts.
 * Kept only because it is denominated in dollars and documents what the index
 * used to mean; nothing in the tick reads it any more.
 */
export const PROSPERITY_SCALE = 200;
export const EMA_ALPHA = 0.15;
export const EASE_RATE = 0.1;
export const ACT_HOLD_TICKS = 6;
export const MERIDIAN_DECAY_TICKS = 168; // matches Substrate's 7-world-day baseline

export function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Exponential moving average of the day's net — smooths a single noisy day. */
export function nextNetEma(prevEma: number, net: number): number {
  return prevEma * (1 - EMA_ALPHA) + net * EMA_ALPHA;
}

/** Where the smoothed signal wants the index to sit. Pure, monotonic in netEma. */
export function prosperityTarget(netEma: number): number {
  return clamp01to100(50 + netEma * PROSPERITY_SCALE);
}

/** Eases the live index toward its target so ticks never whipsaw. */
export function easeIndex(current: number, target: number): number {
  return clamp01to100(current + (target - current) * EASE_RATE);
}

/** Which of the four acts an index value belongs to, in isolation. */
export function bandFor(index: number): Act {
  if (index >= 70) return "boom";
  if (index >= 40) return "stable";
  if (index >= 20) return "correction";
  return "bust";
}

export interface ActHysteresisState {
  act: Act;
  pendingAct: Act | null;
  pendingTicks: number;
}

export interface ActHysteresisResult extends ActHysteresisState {
  actChanged: boolean;
}

/**
 * Hysteresis: the index's raw band must hold for ACT_HOLD_TICKS consecutive
 * ticks before the city's recorded act actually changes — otherwise a value
 * hovering on a boundary would flicker the act every tick. Pure, unit-tested.
 */
export function nextActState(state: ActHysteresisState, index: number): ActHysteresisResult {
  const band = bandFor(index);
  if (band === state.act) {
    return { act: state.act, pendingAct: null, pendingTicks: 0, actChanged: false };
  }
  if (band === state.pendingAct) {
    const pendingTicks = state.pendingTicks + 1;
    if (pendingTicks >= ACT_HOLD_TICKS) {
      return { act: band, pendingAct: null, pendingTicks: 0, actChanged: true };
    }
    return { act: state.act, pendingAct: band, pendingTicks, actChanged: false };
  }
  return { act: state.act, pendingAct: band, pendingTicks: 1, actChanged: false };
}

/**
 * The wealth level each act pulls the city toward, rather than a fixed drift
 * per tick.
 *
 * The old model added a constant every tick: +2.5 in a boom, +0.2 in stable.
 * With ticks 30 minutes apart that is +120 a day in a boom — so ANY act held
 * for more than a few hours pinned every citizen against 0 or 100 and stopped
 * the simulation dead. `stable` at +0.2 is what actually happened in
 * production: a slow ratchet that walked four of six citizens to the ceiling
 * over 277 ticks, where they stuck, with every recorded trough still sitting at
 * the seed value of 50 because a stake that only ever rises never sets one. No
 * troughs meant no rags-to-riches crossings, so the entire narrative engine was
 * unreachable.
 *
 * Simply zeroing the drift would have fixed that one act and left the same trap
 * in the other three — a long correction would pin everyone at 0 just as surely.
 * Mean reversion removes the trap altogether: a sustained regime settles the
 * city at that regime's wealth level and holds it there, while a CHANGE of
 * regime is what actually moves fortunes. Which is the point of a boom.
 */
const ACT_TARGET: Record<Act, number> = {
  boom: 82,
  stable: 55,
  correction: 34,
  bust: 14,
};

/** Pull per tick toward the act's target. 1/0.012 ≈ 83 ticks, so a regime
 *  change takes about two days to fully express — slow enough that a returning
 *  visitor sees a city mid-move rather than one already settled. */
const REVERSION_RATE = 0.012;

/**
 * The fortunes that count as a rise and a fall worth recording.
 *
 * These were 75 and 25, chosen when stakes drifted without bound and any
 * sustained act eventually drove everyone to 0 or 100 — at which point both
 * thresholds were trivially reachable, and the crossing meant nothing. Under
 * mean reversion the attainable range is roughly 14 to 86, so 75/25 sat almost
 * at the extremes: replaying a real month of governance, the most volatile
 * citizen in the city peaked at 70 and bottomed at 13, and produced no legend
 * at all.
 *
 * 68/28 are the equivalent extremes for the range that actually exists. In that
 * same month they yield a couple of crossings for the high-volatility citizens
 * and none for the cautious ones, which is the intended shape: a legend should
 * belong to someone who took a risk.
 */
export const LEGEND_HIGH = 68;
export const LEGEND_LOW = 28;

/**
 * A citizen's stake drift this tick — deterministic given a seeded rand().
 *
 * Takes the current stake because reversion is relative to where the citizen
 * already is. Volatility scales both how hard the market pulls them and how far
 * they wander from it, so the cautious Gardener tracks the index closely while
 * the ambitious Magnate overshoots it in both directions.
 */
export function stakeDelta(act: Act, volatility: number, rand: () => number, stake: number): number {
  const pull = (ACT_TARGET[act] - stake) * REVERSION_RATE * volatility;
  const noise = (rand() - 0.5) * 0.9 * volatility;
  return pull + noise;
}

/** Decay bites twice as fast once the city can't afford upkeep. */
export function decayThreshold(act: Act): number {
  return act === "bust" ? MERIDIAN_DECAY_TICKS / 2 : MERIDIAN_DECAY_TICKS;
}

/** The single most-overdue ward structure, or null. Pure — unit-tested. */
export function meridianDecayCandidate(
  structures: MeridianStructureRow[], tick: number, act: Act
): MeridianStructureRow | null {
  const threshold = decayThreshold(act);
  let pick: MeridianStructureRow | null = null;
  let worst = 0;
  for (const s of structures) {
    if (s.level <= 1) continue;
    const untended = tick - s.tended_tick;
    if (untended <= threshold) continue;
    if (untended > worst) {
      worst = untended;
      pick = s;
    }
  }
  return pick;
}

// ── Read model (page + GET /api/meridian/state) ──────────────────────────────

const FOUNDING_SUMMARY =
  "Meridian wakes. Six citizens take up their wards around the Agora. The market has not yet spoken.";

/** Renders the founding moment honestly before db/meridian.sql has run. */
function fallbackMeridian(): MeridianData {
  const now = new Date().toISOString();
  return {
    live: false,
    clock: { tick: 0, act: "stable", actSinceTick: 0, prosperityIndex: 50 },
    citizens: MERIDIAN_CAST.map((c, i) => ({
      id: i + 1, name: c.name, epithet: c.epithet, archetype: c.archetype, ward: c.ward, color: c.color,
      drives: c.drives, stake: 50, peak_stake: 50, peak_tick: 0, trough_stake: 50, trough_tick: 0,
      status: "settling in", updated_at: now,
    })),
    structures: WARDS.map((w, i) => ({ id: i + 1, ward_kind: w, level: 1 as StructureLevel, tended_tick: 0, created_at: now })),
    events: [{ id: 1, kind: "founding", summary: FOUNDING_SUMMARY, detail: {}, tick: 0, created_at: now }],
    civic: { ...EMPTY_COUNTS },
    relations: [],
  };
}

export async function getMeridianState(): Promise<MeridianStateRow | null> {
  const rows = await sbGet<MeridianStateRow[]>("mw_meridian_state?id=eq.1&limit=1");
  return rows?.[0] ?? null;
}

export async function getMeridianData(): Promise<MeridianData> {
  if (!supabaseReady()) return fallbackMeridian();
  const state = await getMeridianState();
  if (!state) return fallbackMeridian(); // SQL not run yet

  // The civic counts are read here rather than persisted on the state row,
  // because persisting them would need a migration and every migration in this
  // project waits on a human to run SQL. Reading them costs four small filtered
  // selects on a low-traffic page, and it means the skyline is never staler
  // than the request that drew it.
  const [citizens, structures, events, relations, civic] = await Promise.all([
    sbGet<MeridianCitizenRow[]>("mw_meridian_citizens?select=*&order=id.asc"),
    sbGet<MeridianStructureRow[]>("mw_meridian_structures?select=*&order=id.asc"),
    sbGet<MeridianEvent[]>("mw_meridian_events?select=*&order=id.desc&limit=60"),
    sbGet<MeridianRelation[]>("mw_meridian_relations?select=*&order=strength.desc"),
    readCivicCounts(),
  ]);

  return {
    live: true,
    clock: { tick: state.tick, act: state.act, actSinceTick: state.act_since_tick, prosperityIndex: state.prosperity_index },
    citizens: citizens ?? [],
    structures: structures ?? [],
    events: events ?? [],
    relations: relations ?? [],
    civic,
  };
}

export async function getMeridianChronicle(before?: number, limit = 60): Promise<MeridianEvent[]> {
  const n = Math.min(100, Math.max(1, Math.floor(limit)));
  const cursor = before && Number.isFinite(before) ? `&id=lt.${Math.floor(before)}` : "";
  const rows = await sbGet<MeridianEvent[]>(`mw_meridian_events?select=*&order=id.desc&limit=${n}${cursor}`);
  return rows ?? [];
}

// ── Tick engine ──────────────────────────────────────────────────────────────

async function appendEvent(
  kind: MeridianEventKind, summary: string, tick: number, detail: Record<string, unknown> = {}
): Promise<void> {
  await sbWrite("mw_meridian_events", "POST", { kind, summary: summary.slice(0, 300), detail, tick });
}

const ACT_LINES: Record<Act, string> = {
  boom: "Meridian enters a BOOM. Spire Row lights up floor by floor; the whole city leans forward.",
  stable: "The market steadies. Meridian settles into an even keel.",
  correction: "A correction sets in. Citizens start watching their stakes more carefully than their work.",
  bust: "The bust arrives. Upkeep goes unpaid; the city braces.",
};

async function pairOf(x: string, y: string): Promise<{ a: string; b: string }> {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

async function bumpRelation(x: string, y: string, kind: "bond" | "rift"): Promise<number> {
  const { a, b } = await pairOf(x, y);
  const rows = await sbGet<MeridianRelation[]>(
    `mw_meridian_relations?a=eq.${encodeURIComponent(a)}&b=eq.${encodeURIComponent(b)}&kind=eq.${kind}&limit=1`
  );
  const existing = rows?.[0];
  if (existing) {
    const strength = existing.strength + 1;
    await sbWrite(`mw_meridian_relations?id=eq.${existing.id}`, "PATCH", { strength, updated_at: new Date().toISOString() });
    return strength;
  }
  await sbWrite("mw_meridian_relations", "POST", { a, b, kind, strength: 1 });
  return 1;
}

export interface MeridianTickResult {
  initialized: boolean;
  tick?: number;
  act?: Act;
  actChanged?: boolean;
  prosperityIndex?: number;
  levelUps?: number;
  crossings?: number;
}

const TICK_SEED = hashStr("meridian-behavior");

/**
 * Gather the civic counts over the rolling window.
 *
 * Read-only and defensive: every source is optional, and a table that does not
 * exist or returns nothing contributes zero rather than throwing. Meridian's
 * tick must never fail because a neighbouring world's table moved — the whole
 * point of this rebinding is that the city keeps reading something real, and a
 * hard dependency on six tables would be less reliable than the dead counter it
 * replaced, not more.
 */
export async function readCivicCounts(): Promise<CivicCounts> {
  const sinceIso = new Date(Date.now() - CIVIC_WINDOW_HOURS * 3600 * 1000).toISOString();
  const counts: CivicCounts = { ...EMPTY_COUNTS };

  // The Genesis assembly's own log. `kind` carries the outcome.
  const govern = await sbGet<{ kind: string }[]>(
    `world_events?select=kind&created_at=gte.${sinceIso}&limit=2000`
  );
  for (const e of govern ?? []) {
    if (e.kind === "enacted") counts.enacted++;
    else if (e.kind === "rejected") counts.rejected++;
    else if (e.kind === "ballot_opened") counts.ballotsOpened++;
    else if (e.kind === "vote_cast") counts.votesCast++;
  }

  const [duels, sales, built] = await Promise.all([
    sbGet<{ id: number }[]>(`arena_duels?select=id&created_at=gte.${sinceIso}&limit=500`),
    sbGet<{ id: number }[]>(`sales_ledger?select=id&created_at=gte.${sinceIso}&limit=500`),
    sbGet<{ id: number }[]>(`world_structures?select=id&created_at=gte.${sinceIso}&limit=500`),
  ]);
  counts.duels = duels?.length ?? 0;
  counts.sales = sales?.length ?? 0;
  counts.structuresBuilt = built?.length ?? 0;

  return counts;
}

export async function runMeridianTick(): Promise<MeridianTickResult> {
  const state = await getMeridianState();
  if (!state) return { initialized: false };

  const tick = state.tick + 1;

  // 1) Real civic signal → smoothed prosperity index.
  //
  // Was `credit_revenue − token cost` off three daily counters, which read
  // exactly zero on essentially every tick and froze the whole world. See
  // lib/meridian/signals.ts for the full account. Now the city reads whether
  // the Genesis assembly can actually pass anything, plus the rare real
  // commercial events, over a rolling six-hour window.
  const counts = await readCivicCounts();
  const net = civicNet(counts);

  const netEma = nextNetEma(state.net_ema, net);
  const target = civicTarget(netEma);
  const prosperityIndex = easeIndex(state.prosperity_index, target);

  const actResult = nextActState(
    { act: state.act, pendingAct: state.pending_act, pendingTicks: state.pending_ticks },
    prosperityIndex
  );
  if (actResult.actChanged) {
    // The act line, then the receipt. A compiler world that announces a boom
    // without saying what it read is just a mood ring.
    await appendEvent(
      "act_change",
      `${ACT_LINES[actResult.act]} The assembly's last ${CIVIC_WINDOW_HOURS} hours: ${civicSummary(counts)}.`,
      tick,
      { from: state.act, to: actResult.act, index: prosperityIndex, counts, net }
    );
  }
  const act = actResult.act;
  const actSinceTick = actResult.actChanged ? tick : state.act_since_tick;

  // 2) Citizens: stakes drift with the cycle; peaks/troughs and crossings
  // fire the rags-to-riches / riches-to-rags legend material.
  const citizensRaw = await sbGet<MeridianCitizenRow[]>("mw_meridian_citizens?select=*&order=id.asc");
  const citizens = citizensRaw ?? [];
  let crossings = 0;

  for (const citizen of citizens) {
    const def = CAST_BY_NAME.get(citizen.name);
    if (!def) continue;
    const rand = mulberry32((TICK_SEED ^ Math.imul(tick, 2654435761) ^ hashStr(citizen.name)) >>> 0);
    const delta = stakeDelta(act, def.volatility, rand, citizen.stake);
    const prevStake = citizen.stake;
    const stake = clamp01to100(prevStake + delta);

    let peakStake = citizen.peak_stake;
    let peakTick = citizen.peak_tick;
    let troughStake = citizen.trough_stake;
    let troughTick = citizen.trough_tick;

    // Measurement and narrative are separated here, because conflating them
    // was a bug. Peak and trough used to update ONLY past the 75/25 thresholds
    // that fire the legends, so they were not running extremes at all: a
    // citizen who fell from 100 to 30 still had a recorded trough of 50, their
    // seed value, and the panel reported it as fact. Track the true extremes
    // always; gate only the EVENTS on the thresholds.
    const newPeak = stake > peakStake;
    const newTrough = stake < troughStake;

    // Rags-to-riches: a new high above 75 by someone who had previously bottomed
    // out below 25. Riches-to-rags is the mirror image.
    if (newPeak && stake > LEGEND_HIGH && troughStake < LEGEND_LOW) {
      crossings++;
      await appendEvent(
        "rags_to_riches",
        `${citizen.name} ${citizen.epithet} climbs from a stake of ${troughStake.toFixed(0)} (tick ${troughTick}) to ${stake.toFixed(0)} — rags to riches, in full view of the record.`,
        tick, { citizen: citizen.name, from: troughStake, to: stake, sinceTick: troughTick }
      );
    }
    if (newTrough && stake < LEGEND_LOW && peakStake > LEGEND_HIGH) {
      crossings++;
      await appendEvent(
        "riches_to_rags",
        `${citizen.name} ${citizen.epithet} falls from a stake of ${peakStake.toFixed(0)} (tick ${peakTick}) to ${stake.toFixed(0)} — riches to rags. The chronicle does not flatter anyone.`,
        tick, { citizen: citizen.name, from: peakStake, to: stake, sinceTick: peakTick }
      );
    }

    if (newPeak) { peakStake = stake; peakTick = tick; }
    if (newTrough) { troughStake = stake; troughTick = tick; }

    const status =
      act === "boom" ? "riding the boom" :
      act === "bust" ? "weathering the bust" :
      delta >= 0 ? "steady, gaining ground" : "steady, losing a little";

    await sbWrite(`mw_meridian_citizens?id=eq.${citizen.id}`, "PATCH", {
      stake, peak_stake: peakStake, peak_tick: peakTick, trough_stake: troughStake, trough_tick: troughTick,
      status, updated_at: new Date().toISOString(),
    });
    // Write the whole updated row back, not just the stake.
    //
    // Only `stake` used to be copied onto the in-memory object, so `peak_tick`
    // still held its pre-tick value when the level-up pass below tested
    // `citizen.peak_tick !== tick`. That test therefore failed every time and
    // the level-up path was unreachable — which is why all six ward structures
    // were still level 1 after 277 ticks despite four citizens having climbed
    // past the threshold. Unlike the other two faults this one is not about the
    // economy at all; it would have survived any amount of fixing upstream.
    citizen.stake = stake;
    citizen.peak_stake = peakStake;
    citizen.peak_tick = peakTick;
    citizen.trough_stake = troughStake;
    citizen.trough_tick = troughTick;
  }

  // 3) Bonds and rifts from correlated fortunes: pairs whose stakes moved the
  // same direction during a BOOM or BUST share the moment; pairs whose
  // fortunes diverge hard during a CORRECTION are quietly competing.
  for (let i = 0; i < citizens.length; i++) {
    for (let j = i + 1; j < citizens.length; j++) {
      const a = citizens[i], b = citizens[j];
      const aUp = a.stake >= 50, bUp = b.stake >= 50;
      if ((act === "boom" || act === "bust") && aUp === bUp) {
        const strength = await bumpRelation(a.name, b.name, "bond");
        if (strength === 5) {
          await appendEvent("bond", `${a.name} and ${b.name} have weathered the same market together often enough that the record calls them companions.`, tick, { a: a.name, b: b.name, strength });
        }
      } else if (act === "correction" && aUp !== bUp) {
        const strength = await bumpRelation(a.name, b.name, "rift");
        if (strength === 4) {
          await appendEvent("rift", `${a.name} and ${b.name}'s fortunes have diverged too many times to be coincidence. The market has made them rivals.`, tick, { a: a.name, b: b.name, strength });
        }
      }
    }
  }

  // 4) Structures: upkeep happens for free outside a BUST (the city can
  // afford it); during a BUST the ward that hasn't been tended long enough
  // weathers exactly like Substrate's storm-driven decay.
  const structuresRaw = await sbGet<MeridianStructureRow[]>("mw_meridian_structures?select=*&order=id.asc");
  const structures = structuresRaw ?? [];
  let levelUps = 0;

  if (act !== "bust") {
    for (const s of structures) {
      if (s.tended_tick !== tick) {
        await sbWrite(`mw_meridian_structures?id=eq.${s.id}`, "PATCH", { tended_tick: tick });
      }
    }
  } else {
    const weathering = meridianDecayCandidate(structures, tick, act);
    if (weathering) {
      const level = Math.max(1, weathering.level - 1) as StructureLevel;
      const ok = await sbWrite(`mw_meridian_structures?id=eq.${weathering.id}`, "PATCH", { level });
      if (ok) {
        const ward = CAST_BY_WARD.get(weathering.ward_kind);
        await appendEvent(
          "decay",
          `The bust reaches ${ward?.name ?? weathering.ward_kind}'s ward: upkeep unpaid too long, the structure weathers to level ${level}.`,
          tick, { ward: weathering.ward_kind, level }
        );
      }
    }
  }

  // Level-up: a ward's structure grows one level the tick its citizen's
  // stake newly crosses into "prosperous" territory (>=75), capped at 3 —
  // the same crossing that feeds the rags-to-riches check above.
  for (const citizen of citizens) {
    if (citizen.stake < LEGEND_HIGH) continue;
    const structure = structures.find((s) => s.ward_kind === citizen.ward);
    if (!structure || structure.level >= 3) continue;
    if (citizen.peak_tick !== tick) continue; // only on the tick it just crossed
    const level = (structure.level + 1) as StructureLevel;
    const ok = await sbWrite(`mw_meridian_structures?id=eq.${structure.id}`, "PATCH", { level });
    if (ok) {
      levelUps++;
      await appendEvent(
        "level_up",
        `${citizen.ward.replace("_", " ")} grows to its ${level >= 3 ? "final" : "established"} form — ${citizen.name}'s fortune building something that outlasts the tick.`,
        tick, { ward: citizen.ward, level, citizen: citizen.name }
      );
    }
  }

  // 5) Persist the clock.
  await sbWrite("mw_meridian_state?id=eq.1", "PATCH", {
    tick, prosperity_index: prosperityIndex, net_ema: netEma,
    act, act_since_tick: actSinceTick,
    pending_act: actResult.pendingAct, pending_ticks: actResult.pendingTicks,
    updated_at: new Date().toISOString(),
  });

  return { initialized: true, tick, act, actChanged: actResult.actChanged, prosperityIndex, levelUps, crossings };
}
