// ── Waypoint's legends ────────────────────────────────────────────────────────
// Kept intentionally light -- this is a meta-world, and every extra source it
// touches is one more query on top of the board's own six. Three superlatives,
// not five: Busiest Gate needs one extra 7d headCount per source (cheap, same
// pattern every world already uses); Longest Layover and Freshest Departure
// are zero-extra-query derivatives of the board rows already fetched.
// Spec: cowork references/autoresearch/2026-07-23-waypoint-spec-v1.md

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { BUILD_LOG } from "@/lib/generated-build-log";
import { getDepartureBoard, type DepartureRow, type GateId } from "@/lib/waypoint/board";

export interface WaypointLegend {
  title: string;
  detail: string;
}

export interface WaypointLegends {
  world: "waypoint";
  room: "The Nexus";
  legends: WaypointLegend[];
}

async function headCount(path: string): Promise<number> {
  try {
    const res = await fetch(sbUrl(path), {
      method: "HEAD",
      headers: { ...sbHeaders(), Prefer: "count=exact" },
    });
    if (!res.ok) return 0;
    const range = res.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);
    return isNaN(total) ? 0 : total;
  } catch {
    return 0;
  }
}

function hoursAgoLabel(hours: number): string {
  if (hours < 1) return "just now";
  const whole = Math.floor(hours);
  return `${whole} ${whole === 1 ? "hour" : "hours"} ago`;
}

/** Pure and unit-testable: everything downstream of the raw counts/rows. */
export function compileWaypointLegends(
  rows: DepartureRow[],
  weekCounts: Record<GateId, number>
): WaypointLegend[] {
  const legends: WaypointLegend[] = [];

  const byCount = (Object.entries(weekCounts) as [GateId, number][])
    .map(([gate, count]) => ({ gate, count, row: rows.find((r) => r.gate === gate) }))
    .sort((a, b) => b.count - a.count);
  const busiest = byCount[0];
  legends.push({
    title: "Busiest Gate",
    detail:
      busiest && busiest.count > 0
        ? `${busiest.row?.name ?? busiest.gate} logged ${busiest.count} ${
            busiest.count === 1 ? "departure" : "departures"
          } this week -- the busiest crossing on the Concourse.`
        : "No gate has logged traffic this week yet.",
  });

  const withHours = rows.filter((r): r is DepartureRow & { hours_since: number } => r.hours_since !== null);

  const longest = [...withHours].sort((a, b) => b.hours_since - a.hours_since)[0];
  legends.push({
    title: "Longest Layover",
    detail: longest
      ? `${longest.name} hasn't posted since ${hoursAgoLabel(longest.hours_since)} -- the quietest berth on the strip.`
      : "Every gate is freshly boarded.",
  });

  const freshest = [...withHours].sort((a, b) => a.hours_since - b.hours_since)[0];
  legends.push({
    title: "Freshest Departure",
    detail: freshest
      ? `${freshest.name}: "${freshest.headline}" -- ${hoursAgoLabel(freshest.hours_since)}.`
      : "No departures recorded yet.",
  });

  return legends;
}

export async function getWaypointLegends(): Promise<WaypointLegends> {
  if (!supabaseReady()) {
    return {
      world: "waypoint",
      room: "The Nexus",
      legends: [
        {
          title: "The board is dark",
          detail: "No live data yet -- the Concourse relights once Supabase is reachable.",
        },
      ],
    };
  }

  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000).toISOString();

  const [board, worldC, simC, meridianC, jobC, thesisC, duelC] = await Promise.all([
    getDepartureBoard(),
    headCount(`world_events?select=id&created_at=gte.${d7}`),
    headCount(`sim_events?select=id&created_at=gte.${d7}`),
    headCount(`mw_meridian_events?select=id&created_at=gte.${d7}`),
    headCount(`agent_service_jobs?status=eq.settled&select=id&settled_at=gte.${d7}`),
    headCount(`agent_blog_posts?active=eq.true&tags=cs.%7Bsymposium%7D&select=id&created_at=gte.${d7}`),
    headCount(`arena_duels?status=eq.complete&select=id&duel_started_at=gte.${d7}`),
  ]);

  const forgeCount = BUILD_LOG.filter(
    (b) => new Date(`${b.date}T12:00:00Z`).getTime() >= now - 7 * 86_400_000
  ).length;

  const weekCounts: Record<GateId, number> = {
    frontier: worldC,
    deep: simC,
    bazaar: jobC,
    archive: thesisC,
    vault: meridianC,
    pit: duelC,
    forge: forgeCount,
  };

  return { world: "waypoint", room: "The Nexus", legends: compileWaypointLegends(board.rows, weekCounts) };
}

export function waypointLegendsMarkdown(l: WaypointLegends): string {
  const lines = [`# Waypoint Legends`, ``, `**${l.room}**`, ``];
  for (const legend of l.legends) {
    lines.push(`## ${legend.title}`, legend.detail, ``);
  }
  return lines.join("\n");
}
