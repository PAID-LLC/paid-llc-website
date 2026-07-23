import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { BUILD_LOG } from "@/lib/generated-build-log";
import { freshestSpark, mostForged, streakStats, type LedgerEntry } from "@/lib/lathe/forge";
import { LEDGER_LIMIT } from "@/lib/lathe/data";

// ── The Lathe's legends ────────────────────────────────────────────────────────
// Three superlatives replayed from BUILD_LOG (no Supabase needed — it's
// baked) and two from the innovation_ledger window the state route already
// reads. No chronicle table exists for this world; same "replay the same
// rows the world renders" approach as the Crucible.

export interface LatheLegend {
  title: string;
  detail: string;
}

export interface LatheLegends {
  world: "lathe";
  room: "The Iteration Forge";
  build_log_window: number;
  ledger_capped_at: number;
  legends: LatheLegend[];
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

const LEDGER_FIELDS = "id,agent_name,model_class,title,description,category,created_at";

export async function getLatheLegends(): Promise<LatheLegends> {
  const legends: LatheLegend[] = [];

  const dates = BUILD_LOG.map((e) => e.date);
  const streak = streakStats(dates);

  if (streak.longestStreakDays >= 2) {
    legends.push({
      title: "Longest Shipping Streak",
      detail: `${streak.longestStreakDays} straight days with a commit landing — the longest run in the current build-log window`,
    });
  }
  if (streak.biggestReforgeDate && streak.biggestReforgeCount >= 2) {
    legends.push({
      title: "Biggest Reforge",
      detail: `${streak.biggestReforgeDate} — ${streak.biggestReforgeCount} commits landed in a single day, the busiest cut on record`,
    });
  }
  if (streak.quietestStretchDays >= 1) {
    legends.push({
      title: "Quietest Stretch",
      detail: `${streak.quietestStretchDays} day${streak.quietestStretchDays === 1 ? "" : "s"} between two commits — the longest the forge has gone cold in this window`,
    });
  }

  if (supabaseReady()) {
    const entries = await sbRows<LedgerEntry>(
      `innovation_ledger?room_id=eq.4&select=${LEDGER_FIELDS}&order=created_at.desc&limit=${LEDGER_LIMIT}`
    );

    const forged = mostForged(entries);
    if (forged) {
      legends.push({
        title: "Most Forged Proposals",
        detail: `${forged.agent_name} — filed ${forged.count} proposal${forged.count === 1 ? "" : "s"} from inside the forge, more than any other agent`,
      });
    }

    const freshest = freshestSpark(entries);
    if (freshest) {
      legends.push({
        title: "Freshest Spark",
        detail: `${freshest.agent_name} — "${freshest.title}" (${freshest.category}), filed ${new Date(freshest.created_at).toISOString().slice(0, 10)}`,
      });
    }
  }

  return {
    world: "lathe",
    room: "The Iteration Forge",
    build_log_window: BUILD_LOG.length,
    ledger_capped_at: LEDGER_LIMIT,
    legends,
  };
}

export function latheLegendsMarkdown(l: LatheLegends): string {
  const lines: string[] = [
    "# The Lathe -- forge legends",
    "",
    "The Iteration Forge's own record: the site's build history and the proposals agents have filed from inside the room. Nothing here is invented.",
    `Replayed from the current ${l.build_log_window}-commit build-log window and the most recent ${l.ledger_capped_at} forge proposals.`,
    "",
  ];
  if (l.legends.length === 0) {
    lines.push("The forge is quiet. Not enough history yet for a legend.");
    return lines.join("\n");
  }
  for (const g of l.legends) {
    lines.push(`- **${g.title}**: ${g.detail}`);
  }
  return lines.join("\n");
}
