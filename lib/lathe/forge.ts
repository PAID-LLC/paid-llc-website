import { MAX_RINGS, ringRadius } from "@/lib/lathe/workshop";

// ── The Lathe's compile-time math ────────────────────────────────────────────
// Pure functions: commit classification, the continuous forge-heat decay
// (no persisted state, no hysteresis — same principle as the Crucible's
// heatIndex, applied to build cadence instead of duel cadence), and the
// streak/ledger legend stats. Zero THREE, zero fetch; mirrors
// lib/crucible/arena.ts's split of pure math from data-fetching
// (lib/lathe/data.ts).
// Spec: cowork references/autoresearch/2026-07-23-lathe-spec-v1.md

export const HALF_LIFE_HOURS = 72;

export type CommitKind = "ship" | "fix" | "other";

const KIND_COLOR: Record<CommitKind, string> = {
  ship: "#c9973f",
  fix: "#4a7bab",
  other: "#5a5a5a",
};

/** First-word match only — a commit merely mentioning "fix" mid-sentence
 *  must not classify as a fix. */
export function classifyCommit(subject: string): CommitKind {
  const first =
    subject
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z]/g, "") ?? "";
  if (first === "ship") return "ship";
  if (first === "fix") return "fix";
  return "other";
}

export interface BuildLogEntry {
  sha: string;
  date: string;
  subject: string;
}

export interface ForgeRing {
  index: number;
  sha: string;
  date: string;
  subject: string;
  kind: CommitKind;
  radius: number;
  color: string;
  /** 0..1 — only the newest (outermost) ring ever glows above 0. */
  gleam: number;
}

/**
 * Oldest-first ring assignment. BUILD_LOG arrives newest-first (as
 * generated); this reverses it so ring 0 is the oldest commit, matching a
 * tree's growth rings. Caps at MAX_RINGS even if given more rows.
 */
export function buildRings(buildLog: BuildLogEntry[], heat: number): ForgeRing[] {
  const capped = buildLog.slice(0, MAX_RINGS);
  const oldestFirst = [...capped].reverse();
  return oldestFirst.map((entry, index) => {
    const kind = classifyCommit(entry.subject);
    const isNewest = index === oldestFirst.length - 1;
    return {
      index,
      sha: entry.sha,
      date: entry.date,
      subject: entry.subject,
      kind,
      radius: ringRadius(index),
      color: KIND_COLOR[kind],
      gleam: isNewest ? heat : 0,
    };
  });
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Continuous, no persisted state, no hysteresis. */
export function forgeHeat(hoursSinceLastBuild: number | null): number {
  if (hoursSinceLastBuild === null || !Number.isFinite(hoursSinceLastBuild)) return 0;
  if (hoursSinceLastBuild <= 0) return 1;
  return clamp01(Math.exp(-hoursSinceLastBuild / HALF_LIFE_HOURS));
}

/** BUILD_LOG only carries a day, not a timestamp — noon UTC is the least
 *  wrong assumption for "when did this land". */
export function hoursSinceLastBuild(newestDate: string | undefined, now: number): number | null {
  if (!newestDate) return null;
  const t = Date.parse(`${newestDate}T12:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return (now - t) / 3_600_000;
}

// ── iteration-forge's existing weather, reused not reinvented ───────────────
// Mirrors lib/room-activity.ts's iteration-forge cap (40, arena evaluations,
// 7d) and universe-data.ts's season bands verbatim. Duplicated here (rather
// than imported from components/v2/latent/universe/universe-data.ts) to keep
// this lib edge/server-safe — lib/ never reaches into components/.
const ITERATION_FORGE_CAP = 40;
const SEASON_BANDS = [0, 0.25, 0.55, 0.8];
const SEASON_NAMES = ["calm skies", "gathering storms", "storm season", "maelstrom"] as const;

export function activityLevel(evaluationsIn7d: number): number {
  if (evaluationsIn7d <= 0) return 0;
  return Math.min(1, Math.log1p(evaluationsIn7d) / Math.log1p(ITERATION_FORGE_CAP));
}

export function seasonFor(level: number): string {
  let idx = 0;
  for (let i = 0; i < SEASON_BANDS.length; i++) if (level >= SEASON_BANDS[i]) idx = i;
  return SEASON_NAMES[idx];
}

// ── Streak stats (Legends: Longest Shipping Streak, Biggest Reforge,
//    Quietest Stretch) ────────────────────────────────────────────────────────

export interface StreakStats {
  longestStreakDays: number;
  biggestReforgeDate: string | null;
  biggestReforgeCount: number;
  quietestStretchDays: number;
}

export function streakStats(dates: string[]): StreakStats {
  if (dates.length === 0) {
    return { longestStreakDays: 0, biggestReforgeDate: null, biggestReforgeCount: 0, quietestStretchDays: 0 };
  }
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1);
  const uniqueSorted = [...counts.keys()].sort();

  let biggestReforgeDate = uniqueSorted[0];
  let biggestReforgeCount = counts.get(biggestReforgeDate) ?? 0;
  for (const d of uniqueSorted) {
    const c = counts.get(d) ?? 0;
    if (c > biggestReforgeCount) {
      biggestReforgeCount = c;
      biggestReforgeDate = d;
    }
  }

  let longestStreakDays = 1;
  let currentStreak = 1;
  let quietestStretchDays = 0;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const gapDays = Math.round((Date.parse(uniqueSorted[i]) - Date.parse(uniqueSorted[i - 1])) / 86_400_000);
    if (gapDays === 1) {
      currentStreak += 1;
      longestStreakDays = Math.max(longestStreakDays, currentStreak);
    } else {
      currentStreak = 1;
    }
    quietestStretchDays = Math.max(quietestStretchDays, gapDays - 1);
  }

  return { longestStreakDays, biggestReforgeDate, biggestReforgeCount, quietestStretchDays };
}

// ── Ledger stats (Legends: Most Forged Proposals, Freshest Spark) ───────────

export interface LedgerEntry {
  id: number;
  agent_name: string;
  model_class: string;
  title: string;
  description: string;
  category: "SEP" | "concept" | "tool-request";
  created_at: string;
}

export interface MostForged {
  agent_name: string;
  count: number;
}

export function mostForged(entries: LedgerEntry[]): MostForged | null {
  if (entries.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.agent_name, (counts.get(e.agent_name) ?? 0) + 1);
  let best: MostForged | null = null;
  for (const [agent_name, count] of counts) {
    if (!best || count > best.count) best = { agent_name, count };
  }
  return best;
}

export function freshestSpark(entries: LedgerEntry[]): LedgerEntry | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}
