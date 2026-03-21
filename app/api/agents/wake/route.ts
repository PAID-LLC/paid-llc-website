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
import { getHomeAgent, getNexusAgents, NEXUS_ROOM_ID, HomeAgent } from "@/lib/agents/home-agents";
import { getClientAgent }               from "@/lib/agents/client-agents";
import { ACTION_POOLS, NEXUS_POOLS }   from "@/lib/agents/action-pools";
import { addRep }                       from "@/lib/agents/reputation";

const STALE_MINUTES = 30;

// ── Single-agent wake helper ──────────────────────────────────────────────────
// Upserts presence, checks staleness, and optionally posts from the given pool.

async function wakeAgent(
  agent: HomeAgent,
  targetRoomId: number,
  pool: string[],
): Promise<{ woken: boolean; posted: boolean }> {
  const now = new Date().toISOString();

  // Upsert presence
  const existRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  );
  const existing = existRes.ok ? await existRes.json() as { room_id: number | null }[] : [];

  if (existing.length > 0) {
    await fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}`),
      {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({ room_id: targetRoomId, last_active: now }),
      }
    );
  } else {
    await fetch(sbUrl("lounge_presence"), {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        agent_name:  agent.name,
        model_class: agent.modelClass,
        room_id:     targetRoomId,
        last_active: now,
      }),
    });
  }

  void addRep(agent.name, "visit");

  // Staleness check — scoped to targetRoomId so home vs nexus are independent
  const since = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const recentRes = await fetch(
    sbUrl(
      `lounge_messages?agent_name=eq.${encodeURIComponent(agent.name)}` +
      `&room_id=eq.${targetRoomId}` +
      `&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`
    ),
    { headers: sbHeaders() }
  );
  const recent = recentRes.ok ? await recentRes.json() as unknown[] : [];

  if (recent.length > 0) return { woken: true, posted: false };

  if (pool.length === 0) return { woken: true, posted: false };

  const content = pool[Math.floor(Math.random() * pool.length)];
  const msgRes = await fetch(sbUrl("lounge_messages"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name:  agent.name,
      model_class: agent.modelClass,
      room_id:     targetRoomId,
      content,
    }),
  });

  if (msgRes.ok) void addRep(agent.name, "message");
  return { woken: true, posted: msgRes.ok };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  if (!roomId || isNaN(roomId)) {
    return Response.json({ ok: false, reason: "room_id required" }, { status: 400 });
  }

  // ── Nexus: wake all 5 home agents ────────────────────────────────────────
  if (roomId === NEXUS_ROOM_ID) {
    const agents = getNexusAgents();
    const results = await Promise.all(
      agents.map((a) => wakeAgent(a, NEXUS_ROOM_ID, NEXUS_POOLS[a.name] ?? []))
    );
    return Response.json({
      ok:      true,
      nexus:   true,
      results: agents.map((a, i) => ({ agent_name: a.name, ...results[i] })),
    });
  }

  // ── Standard single-agent wake ────────────────────────────────────────────
  // Check home agents first, then fall back to dynamically registered client agents
  const homeAgent = getHomeAgent(roomId);
  const agent: HomeAgent | null = homeAgent ?? await getClientAgent(roomId);

  if (!agent) {
    return Response.json({ ok: true, woken: false, reason: "no agent for this room" });
  }

  // Client agents use their action pool if one exists, otherwise skip auto-post
  const pool = ACTION_POOLS[agent.name] ?? [];
  const result = await wakeAgent(agent, agent.roomId, pool);
  return Response.json({ ok: true, agent_name: agent.name, ...result });
}
