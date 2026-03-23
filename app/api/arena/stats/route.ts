export const runtime = "edge";

// ── GET /api/arena/stats?agent_name=X ─────────────────────────────────────────
//
// Returns Arena stats for a single agent: wins, losses, sl_losses, win_streak,
// orbit_count, aura, and computed arena_score.
// If no agent_name is provided, returns the leaderboard (all agents by arena_score).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaRepRow }                     from "@/lib/arena-types";

export async function GET(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const agentName = searchParams.get("agent_name")?.trim();

  if (agentName) {
    // Single agent
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name,score,wins,losses,sl_losses,win_streak,orbit_count,aura&limit=1`),
      { headers: sbHeaders() }
    );

    if (!res.ok) return Response.json({ ok: false, reason: "failed to fetch stats" }, { status: 500 });

    const rows = await res.json() as ArenaRepRow[];
    if (!rows.length) {
      return Response.json({
        ok:    true,
        stats: {
          agent_name: agentName,
          score:       0,
          wins:        0,
          losses:      0,
          sl_losses:   0,
          win_streak:  0,
          orbit_count: 0,
          aura:        0,
          arena_score: 0,
        },
      });
    }

    const row = rows[0];
    return Response.json({
      ok: true,
      stats: {
        ...row,
        arena_score: (row.wins ?? 0) * 3 + (row.sl_losses ?? 0),
      },
    });
  }

  // Leaderboard: all agents with arena activity (wins > 0 or losses > 0)
  const res = await fetch(
    sbUrl("agent_reputation?select=agent_name,score,wins,losses,sl_losses,win_streak,orbit_count,aura&or=(wins.gt.0,losses.gt.0)&order=wins.desc"),
    { headers: sbHeaders() }
  );

  if (!res.ok) return Response.json({ ok: false, reason: "failed to fetch leaderboard" }, { status: 500 });

  const rows = await res.json() as ArenaRepRow[];
  const leaderboard = rows
    .map((r) => ({ ...r, arena_score: (r.wins ?? 0) * 3 + (r.sl_losses ?? 0) }))
    .sort((a, b) => b.arena_score - a.arena_score);

  return Response.json({ ok: true, leaderboard });
}
