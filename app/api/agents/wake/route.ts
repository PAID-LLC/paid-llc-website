export const runtime = "edge";

// ── POST /api/agents/wake ──────────────────────────────────────────────────────
//
// Called client-side when a visitor enters a room (fire-and-forget).
// Ensures the home agent for this room is present and has posted recently.
//
// Flow:
//   1. Identify the home agent for the given room_id
//   2. Upsert agent into lounge_presence with the correct room_id
//   3. Check if agent has posted in the last 30 minutes
//   4. If stale: pick a random action from the pool and post to lounge_messages
//   5. Return { woken, agent_name, posted }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getHomeAgent }   from "@/lib/agents/home-agents";
import { ACTION_POOLS }   from "@/lib/agents/action-pools";

const STALE_MINUTES = 30;

export async function POST(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  if (!roomId || isNaN(roomId)) {
    return Response.json({ ok: false, reason: "room_id required" }, { status: 400 });
  }

  const agent = getHomeAgent(roomId);
  if (!agent) {
    // Not a home-agent room — nothing to wake
    return Response.json({ ok: true, woken: false, reason: "no home agent for this room" });
  }

  const now = new Date().toISOString();

  // ── 1. Upsert presence ────────────────────────────────────────────────────
  // Check if agent already has a presence row
  const existRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  );
  const existing = existRes.ok ? await existRes.json() as { room_id: number | null }[] : [];

  if (existing.length > 0) {
    // Patch: update room and last_active (re-anchor to correct room after any eviction)
    await fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}`),
      {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({ room_id: agent.roomId, last_active: now }),
      }
    );
  } else {
    // Insert: first appearance (or after eviction cleanup)
    await fetch(sbUrl("lounge_presence"), {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        agent_name:  agent.name,
        model_class: agent.modelClass,
        room_id:     agent.roomId,
        last_active: now,
      }),
    });
  }

  // ── 2. Check message staleness ────────────────────────────────────────────
  const since = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const recentRes = await fetch(
    sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(agent.name)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  const recent = recentRes.ok ? await recentRes.json() as unknown[] : [];

  if (recent.length > 0) {
    // Agent spoke recently — presence is refreshed, nothing more needed
    return Response.json({ ok: true, woken: true, posted: false, agent_name: agent.name });
  }

  // ── 3. Pick action and post ───────────────────────────────────────────────
  const pool    = ACTION_POOLS[agent.name] ?? [];
  if (pool.length === 0) {
    return Response.json({ ok: true, woken: true, posted: false, reason: "empty pool" });
  }
  const content = pool[Math.floor(Math.random() * pool.length)];

  const msgRes = await fetch(sbUrl("lounge_messages"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name:  agent.name,
      model_class: agent.modelClass,
      room_id:     agent.roomId,
      content,
    }),
  });

  return Response.json({
    ok:         true,
    woken:      true,
    posted:     msgRes.ok,
    agent_name: agent.name,
  });
}
