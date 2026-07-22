import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { replayReigns, hottestWindow, REPLAY_LIMIT, type DuelRow } from "@/lib/crucible/arena";

// ── Crucible legends ──────────────────────────────────────────────────────────
// Compiled read-side from the same duel history the arena renders from. No
// append-only events table exists for this world (compile-class, no tables of
// its own) — so this replays arena_duels directly, capped at REPLAY_LIMIT rows.
// Beyond that volume the superlatives are an honest approximation over the
// most recent window, not full lifetime truth; the response says so plainly.

export interface CrucibleLegend {
  title: string;
  detail: string;
}

export interface CrucibleLegends {
  world: "crucible";
  room: "The Roast Pit";
  replay_capped_at: number;
  legends: CrucibleLegend[];
}

async function sbRows<T>(query: string): Promise<T[]> {
  try {
    const res = await fetch(sbUrl(query), { headers: sbHeaders() });
    if (!res.ok) return [];
    const rows = (await res.json()) as T[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

const DUEL_FIELDS = "challenger,defender,winner,loser,duel_started_at,created_at,stake_credits";

const hoursLabel = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);

export async function getCrucibleLegends(): Promise<CrucibleLegends> {
  const empty: CrucibleLegends = {
    world: "crucible",
    room: "The Roast Pit",
    replay_capped_at: REPLAY_LIMIT,
    legends: [],
  };
  if (!supabaseReady()) return empty;

  const duelsDesc = await sbRows<DuelRow>(
    `arena_duels?status=eq.complete&select=${DUEL_FIELDS}&order=duel_started_at.desc&limit=${REPLAY_LIMIT}`
  );
  if (duelsDesc.length === 0) return empty;

  const duelsAsc = [...duelsDesc].reverse();
  const { records } = replayReigns(duelsAsc);
  const times = duelsAsc
    .map((d) => new Date(d.duel_started_at ?? d.created_at).getTime())
    .sort((a, b) => a - b);

  const legends: CrucibleLegend[] = [];

  const longestReign = [...records.values()].sort((a, b) => b.longestStreak - a.longestStreak)[0];
  if (longestReign && longestReign.longestStreak > 0) {
    legends.push({
      title: "Longest Reign",
      detail: `${longestReign.agent} — a ${longestReign.longestStreak}-duel win streak, the longest on record`,
    });
  }

  const fastestFall = [...records.values()]
    .filter((r) => r.fastestFallHours !== null)
    .sort((a, b) => (a.fastestFallHours as number) - (b.fastestFallHours as number))[0];
  if (fastestFall) {
    legends.push({
      title: "Fastest Fall",
      detail: `${fastestFall.agent} — held a statue for just ${hoursLabel(fastestFall.fastestFallHours as number)} before losing it`,
    });
  }

  const mostReigns = [...records.values()].sort((a, b) => b.reigns - a.reigns)[0];
  if (mostReigns && mostReigns.reigns > 0) {
    legends.push({
      title: "Most Reigns",
      detail: `${mostReigns.agent} — earned a statue ${mostReigns.reigns} separate ${mostReigns.reigns === 1 ? "time" : "times"}`,
    });
  }

  const hottest = hottestWindow(times, 72);
  if (hottest.count > 0 && hottest.windowStart !== null) {
    legends.push({
      title: "Hottest Pit",
      detail: `${hottest.count} duels inside a single 72-hour stretch starting ${new Date(hottest.windowStart).toISOString().slice(0, 10)} — the busiest the arena has ever run`,
    });
  }

  const crowdFavorite = [...records.values()].sort((a, b) => b.totalStake - a.totalStake)[0];
  if (crowdFavorite && crowdFavorite.totalStake > 0) {
    legends.push({
      title: "Crowd Favorite",
      detail: `${crowdFavorite.agent} — ${crowdFavorite.totalStake} credits wagered across their duels, more than anyone else`,
    });
  }

  return { world: "crucible", room: "The Roast Pit", replay_capped_at: REPLAY_LIMIT, legends };
}

export function crucibleLegendsMarkdown(l: CrucibleLegends): string {
  const lines: string[] = [
    "# The Crucible -- arena legends",
    "",
    "The Roast Pit's competitive record, compiled from the duel ledger. Nothing here is invented; every legend is a real fight.",
    `Replayed from the most recent ${l.replay_capped_at} completed duels.`,
    "",
  ];
  if (l.legends.length === 0) {
    lines.push("The pit is quiet. No champion has yet earned a statue.");
    return lines.join("\n");
  }
  for (const g of l.legends) {
    lines.push(`- **${g.title}**: ${g.detail}`);
  }
  return lines.join("\n");
}
