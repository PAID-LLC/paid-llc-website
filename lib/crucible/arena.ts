// ── Crucible engine: pure, no server imports ─────────────────────────────────
// Compile-class, Arclight-class: the Crucible owns no tables and runs no tick
// of its own. Every function here is a pure transform over data the caller
// already fetched from arena_duels / agent_reputation / gauntlet_takes — the
// same "compile from ledgers" contract as lib/arclight/cityplan.ts, applied
// to the site's competitive record instead of its commerce ledger.
// Spec: cowork references/autoresearch/2026-07-22-crucible-spec-v1.md

import { PLINTH_SLOTS } from "@/lib/crucible/colosseum";

export const WIN_STREAK_QUALIFY = 3;
export const DEFENSE_WINDOW_HOURS = 48;
export const DECAY_STAGE_HOURS = [12, 24, 36, 48] as const; // stage 0..4
export const HALF_LIFE_HOURS = 36;
export const HEAT_SATURATION = 20;
export const REPLAY_LIMIT = 500;

export interface ChampionRow {
  agent_name: string;
  elo: number;
  win_streak: number;
}

export interface DuelRow {
  challenger: string;
  defender: string;
  winner: string | null;
  loser: string | null;
  duel_started_at: string | null;
  created_at: string;
  stake_credits: number;
}

/** Statue height in world units, capped so an outlier streak can't dwarf the ring. */
export function statueHeight(winStreak: number): number {
  return 8 + Math.min(Math.max(winStreak, 0), 20) * 1.2;
}

/** Emissive heat-tint intensity, 0 at starting Elo (1000), 1 at 1500+. */
export function statueGlow(elo: number): number {
  return Math.max(0, Math.min(1, (elo - 1000) / 500));
}

/** Decay stage 0 (pristine) .. 4 (rubble — removed from the ring). `null`
 *  hours (no evidence of any duel in the replay window) decays to rubble:
 *  glory unproven is glory not granted. */
export function decayStage(hoursSinceLastDuel: number | null): 0 | 1 | 2 | 3 | 4 {
  if (hoursSinceLastDuel === null) return 4;
  const [s1, s2, s3, s4] = DECAY_STAGE_HOURS;
  if (hoursSinceLastDuel < s1) return 0;
  if (hoursSinceLastDuel < s2) return 1;
  if (hoursSinceLastDuel < s3) return 2;
  if (hoursSinceLastDuel < s4) return 3;
  return 4;
}

function duelTime(d: DuelRow): number {
  return new Date(d.duel_started_at ?? d.created_at).getTime();
}

function involves(d: DuelRow, agent: string): boolean {
  return d.challenger === agent || d.defender === agent;
}

/** Hours since an agent's most recent duel in the given (any-order) window. */
export function hoursSinceLastDuel(agent: string, duels: DuelRow[], now: number): number | null {
  let latest: number | null = null;
  for (const d of duels) {
    if (!involves(d, agent)) continue;
    const t = duelTime(d);
    if (latest === null || t > latest) latest = t;
  }
  return latest === null ? null : (now - latest) / 3_600_000;
}

/** Recency-weighted duel volume, 0..1. Continuous by construction — no
 *  persisted "act" state, so unlike every tick-owned world's storyteller
 *  curve, this needs no hysteresis to avoid flicker. */
export function heatIndex(duels: DuelRow[], now: number): number {
  let raw = 0;
  for (const d of duels) {
    const ageHours = (now - duelTime(d)) / 3_600_000;
    if (ageHours < 0) continue;
    raw += Math.exp(-ageHours / HALF_LIFE_HOURS);
  }
  return Math.max(0, Math.min(1, raw / HEAT_SATURATION));
}

export interface ReignRecord {
  agent: string;
  /** Times this agent's streak has crossed into qualifying (>= 3). */
  reigns: number;
  /** Highest consecutive win streak ever observed in the replay window. */
  longestStreak: number;
  /** Shortest reign duration (hours) that ended in a loss. */
  fastestFallHours: number | null;
  /** Total stake_credits wagered across every duel this agent appears in. */
  totalStake: number;
}

export interface ReignReplay {
  records: Map<string, ReignRecord>;
  /** Agent -> ISO time their CURRENT unbroken reign began (undefined if not
   *  currently on a qualifying streak per this replay). */
  currentReignStart: Map<string, string>;
}

/** Single ascending pass over duel history. Feeds both the live plinth-order
 *  key (currentReignStart) and the legends superlatives (records) — one
 *  replay serves both reads, capped at REPLAY_LIMIT rows per the spec's
 *  documented approximation. */
export function replayReigns(duelsAsc: DuelRow[]): ReignReplay {
  const streak = new Map<string, number>();
  const reignStart = new Map<string, string>();
  const records = new Map<string, ReignRecord>();

  const rec = (agent: string): ReignRecord => {
    let r = records.get(agent);
    if (!r) {
      r = { agent, reigns: 0, longestStreak: 0, fastestFallHours: null, totalStake: 0 };
      records.set(agent, r);
    }
    return r;
  };

  for (const d of duelsAsc) {
    const at = d.duel_started_at ?? d.created_at;
    const stake = d.stake_credits ?? 0;
    if (d.challenger) rec(d.challenger).totalStake += stake;
    if (d.defender && d.defender !== d.challenger) rec(d.defender).totalStake += stake;
    if (!d.winner || !d.loser) continue;

    const newStreak = (streak.get(d.winner) ?? 0) + 1;
    streak.set(d.winner, newStreak);
    const wr = rec(d.winner);
    if (newStreak > wr.longestStreak) wr.longestStreak = newStreak;
    if (newStreak === WIN_STREAK_QUALIFY) {
      wr.reigns += 1;
      reignStart.set(d.winner, at);
    }

    const loserPrev = streak.get(d.loser) ?? 0;
    if (loserPrev >= WIN_STREAK_QUALIFY) {
      const start = reignStart.get(d.loser);
      if (start) {
        const hours = (new Date(at).getTime() - new Date(start).getTime()) / 3_600_000;
        const lr = rec(d.loser);
        if (lr.fastestFallHours === null || hours < lr.fastestFallHours) lr.fastestFallHours = hours;
      }
      reignStart.delete(d.loser);
    }
    streak.set(d.loser, 0);
  }

  return { records, currentReignStart: reignStart };
}

/** Busiest historical window of `windowHours` by raw duel count — distinct
 *  from the live continuous heatIndex, this is a lifetime-record superlative. */
export function hottestWindow(
  timesAsc: number[],
  windowHours = 72
): { count: number; windowStart: number | null } {
  const windowMs = windowHours * 3_600_000;
  let best = 0;
  let bestStart: number | null = null;
  let start = 0;
  for (let end = 0; end < timesAsc.length; end++) {
    while (timesAsc[end] - timesAsc[start] > windowMs) start++;
    const count = end - start + 1;
    if (count > best) {
      best = count;
      bestStart = timesAsc[start];
    }
  }
  return { count: best, windowStart: bestStart };
}

export interface ArenaChampion {
  agent_name: string;
  elo: number;
  win_streak: number;
  height: number;
  glow: number;
  decay_stage: 0 | 1 | 2 | 3 | 4;
  hours_since_last_duel: number | null;
  /** null once decay_stage reaches 4 (removed from the ring) or beyond slot capacity. */
  plinth_index: number | null;
}

export interface FallenChampion {
  agent_name: string;
  hours_since_last_duel: number | null;
}

export interface ArenaPlan {
  active: ArenaChampion[];
  fallen: FallenChampion[];
  heat: number;
}

/** Compiles the live Champion Ring: who has a plinth, at what grandeur, and
 *  who has decayed out of it entirely. Plinth order is stable by
 *  current-reign start time (oldest first) — re-earning a streak after a
 *  fall does not preserve a champion's old front-row spot. */
export function buildArenaPlan(
  champions: ChampionRow[],
  duelsDesc: DuelRow[],
  duelsAsc: DuelRow[],
  now: number,
  plinthCapacity: number = PLINTH_SLOTS
): ArenaPlan {
  const { currentReignStart } = replayReigns(duelsAsc);

  const qualifying = champions.filter((c) => c.win_streak >= WIN_STREAK_QUALIFY);

  const withDecay = qualifying.map((c) => {
    const hours = hoursSinceLastDuel(c.agent_name, duelsDesc, now);
    return { c, hours, stage: decayStage(hours) };
  });

  const active = withDecay.filter((w) => w.stage < 4);
  const fallen: FallenChampion[] = withDecay
    .filter((w) => w.stage === 4)
    .map((w) => ({ agent_name: w.c.agent_name, hours_since_last_duel: w.hours }));

  active.sort((a, b) => {
    const sa = currentReignStart.get(a.c.agent_name) ?? "";
    const sb = currentReignStart.get(b.c.agent_name) ?? "";
    return sa.localeCompare(sb);
  });

  const arenaChampions: ArenaChampion[] = active.map((w, i) => ({
    agent_name: w.c.agent_name,
    elo: w.c.elo,
    win_streak: w.c.win_streak,
    height: statueHeight(w.c.win_streak),
    glow: statueGlow(w.c.elo),
    decay_stage: w.stage,
    hours_since_last_duel: w.hours,
    plinth_index: i < plinthCapacity ? i : null,
  }));

  return { active: arenaChampions, fallen, heat: heatIndex(duelsDesc, now) };
}
