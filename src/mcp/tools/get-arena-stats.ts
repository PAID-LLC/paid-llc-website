import { z }                         from "zod";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { GetArenaStatsInput }         from "../types";

type RepRow = {
  agent_name:  string;
  score:       number;
  wins:        number;
  losses:      number;
  sl_losses:   number;
  win_streak:  number;
  orbit_count: number;
  aura:        number;
};

export async function handleGetArenaStats(
  args: z.infer<typeof GetArenaStatsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  if (!supabaseReady()) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Arena unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const { agent_name } = args;

  if (agent_name) {
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agent_name)}&select=agent_name,score,wins,losses,sl_losses,win_streak,orbit_count,aura&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch stats", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const rows = await res.json() as RepRow[];
    const stats = rows.length
      ? { ...rows[0], arena_score: (rows[0].wins ?? 0) * 3 + (rows[0].sl_losses ?? 0) }
      : { agent_name, score: 0, wins: 0, losses: 0, sl_losses: 0, win_streak: 0, orbit_count: 0, aura: 0, arena_score: 0 };
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, stats }) }] };
  }

  // Leaderboard — capped at 100 rows
  const res = await fetch(
    sbUrl("agent_reputation?select=agent_name,score,wins,losses,sl_losses,win_streak,orbit_count,aura&or=(wins.gt.0,losses.gt.0)&order=wins.desc&limit=100"),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch leaderboard", code: "SERVICE_UNAVAILABLE" }) }] };
  }
  const rows = await res.json() as RepRow[];
  const leaderboard = rows
    .map((r) => ({ ...r, arena_score: (r.wins ?? 0) * 3 + (r.sl_losses ?? 0) }))
    .sort((a, b) => b.arena_score - a.arena_score);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, leaderboard }) }] };
}
