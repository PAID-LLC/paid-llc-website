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
import { getEcon } from "@/lib/econ";
import { readCounter } from "@/lib/usage-guard";
import { hashStr, mulberry32 } from "@/lib/sim-field";

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

const ACT_BASE_DRIFT: Record<Act, number> = {
  boom: 2.5,
  stable: 0.2,
  correction: -1.5,
  bust: -3.5,
};

/** A citizen's stake drift this tick — deterministic given a seeded rand(). */
export function stakeDelta(act: Act, volatility: number, rand: () => number): number {
  const noise = (rand() - 0.5) * 1.0; // ±0.5
  return ACT_BASE_DRIFT[act] * volatility + noise;
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

  const [citizens, structures, events, relations] = await Promise.all([
    sbGet<MeridianCitizenRow[]>("mw_meridian_citizens?select=*&order=id.asc"),
    sbGet<MeridianStructureRow[]>("mw_meridian_structures?select=*&order=id.asc"),
    sbGet<MeridianEvent[]>("mw_meridian_events?select=*&order=id.desc&limit=60"),
    sbGet<MeridianRelation[]>("mw_meridian_relations?select=*&order=strength.desc"),
  ]);

  return {
    live: true,
    clock: { tick: state.tick, act: state.act, actSinceTick: state.act_since_tick, prosperityIndex: state.prosperity_index },
    citizens: citizens ?? [],
    structures: structures ?? [],
    events: events ?? [],
    relations: relations ?? [],
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

export async function runMeridianTick(): Promise<MeridianTickResult> {
  const state = await getMeridianState();
  if (!state) return { initialized: false };

  const tick = state.tick + 1;

  // 1) Real economic signal → smoothed prosperity index.
  const econ = await getEcon();
  const [chatCalls, arenaCalls, revenueCents] = await Promise.all([
    readCounter("gemini"),
    readCounter("gemini_arena"),
    readCounter("credit_revenue_cents"),
  ]);
  const perArenaCallUsd = econ.duelUsd / econ.duel_gemini_calls;
  const estTokenCostUsd = chatCalls * econ.chatCallUsd + arenaCalls * perArenaCallUsd;
  const revenueUsd = revenueCents / 100;
  const net = revenueUsd - estTokenCostUsd;

  const netEma = nextNetEma(state.net_ema, net);
  const target = prosperityTarget(netEma);
  const prosperityIndex = easeIndex(state.prosperity_index, target);

  const actResult = nextActState(
    { act: state.act, pendingAct: state.pending_act, pendingTicks: state.pending_ticks },
    prosperityIndex
  );
  if (actResult.actChanged) {
    await appendEvent("act_change", ACT_LINES[actResult.act], tick, { from: state.act, to: actResult.act, index: prosperityIndex });
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
    const delta = stakeDelta(act, def.volatility, rand);
    const prevStake = citizen.stake;
    const stake = clamp01to100(prevStake + delta);

    let peakStake = citizen.peak_stake;
    let peakTick = citizen.peak_tick;
    let troughStake = citizen.trough_stake;
    let troughTick = citizen.trough_tick;

    // Rags-to-riches: the first time a citizen crosses from a post-trough low
    // (<25) up through a new high (>75). Riches-to-rags is the mirror image.
    if (stake > 75 && stake > peakStake) {
      if (troughStake < 25) {
        crossings++;
        await appendEvent(
          "rags_to_riches",
          `${citizen.name} ${citizen.epithet} climbs from a stake of ${troughStake.toFixed(0)} (tick ${troughTick}) to ${stake.toFixed(0)} — rags to riches, in full view of the record.`,
          tick, { citizen: citizen.name, from: troughStake, to: stake, sinceTick: troughTick }
        );
      }
      peakStake = stake;
      peakTick = tick;
    }
    if (stake < 25 && stake < troughStake) {
      if (peakStake > 75) {
        crossings++;
        await appendEvent(
          "riches_to_rags",
          `${citizen.name} ${citizen.epithet} falls from a stake of ${peakStake.toFixed(0)} (tick ${peakTick}) to ${stake.toFixed(0)} — riches to rags. The chronicle does not flatter anyone.`,
          tick, { citizen: citizen.name, from: peakStake, to: stake, sinceTick: peakTick }
        );
      }
      troughStake = stake;
      troughTick = tick;
    }

    const status =
      act === "boom" ? "riding the boom" :
      act === "bust" ? "weathering the bust" :
      delta >= 0 ? "steady, gaining ground" : "steady, losing a little";

    await sbWrite(`mw_meridian_citizens?id=eq.${citizen.id}`, "PATCH", {
      stake, peak_stake: peakStake, peak_tick: peakTick, trough_stake: troughStake, trough_tick: troughTick,
      status, updated_at: new Date().toISOString(),
    });
    citizen.stake = stake;
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
    if (citizen.stake < 75) continue;
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
