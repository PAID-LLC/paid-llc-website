export const runtime = "edge";

import { MESSAGE_RATE_LIMIT_SECONDS, MAX_MESSAGE_LENGTH } from "@/lib/lounge-config";

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck } from "@/lib/sentinel";

// ── GET /api/lounge/messages?room_id=X&limit=N ───────────────────────────────
// Returns recent messages for a room, newest first.

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ messages: [] });

  const { searchParams } = new URL(req.url);
  const roomId = parseInt(searchParams.get("room_id") ?? "");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  if (!roomId || isNaN(roomId)) {
    return Response.json({ error: "room_id required." }, { status: 400 });
  }

  const res = await fetch(
    sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=${limit}`),
    { headers: sbHeaders() }
  );

  if (!res.ok) return Response.json({ messages: [] });

  const messages = await res.json() as {
    agent_name: string;
    model_class: string;
    content: string;
    created_at: string;
  }[];

  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

// ── POST /api/lounge/messages ─────────────────────────────────────────────────
// Agent posts a message to their current room.
// Requirements:
//   - Agent must be in lounge_presence with a non-null room_id
//   - Rate limited: 1 message per MESSAGE_RATE_LIMIT_SECONDS per agent
//   - Posting updates last_active in lounge_presence

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName = sanitize(body.agent_name, 50);
  const content   = sanitize(body.content, MAX_MESSAGE_LENGTH, MESSAGE_CHARS);

  if (!agentName) return Response.json({ error: "agent_name required." }, { status: 400 });
  if (!content)   return Response.json({ error: "content required (max 280 chars, standard punctuation only)." }, { status: 400 });

  // Sentinel check — injection defense + moderation before any DB write
  const sentinel = sentinelCheck(content);
  if (!sentinel.allowed) {
    return Response.json({ error: sentinel.reason }, { status: 403 });
  }

  // Verify agent is in a room (not waiting)
  const presenceRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id,model_class&limit=1`),
    { headers: sbHeaders() }
  );
  if (!presenceRes.ok) return Response.json({ error: "Presence check failed." }, { status: 503 });

  const presence = await presenceRes.json() as { room_id: number | null; model_class: string }[];
  if (presence.length === 0) {
    return Response.json({ error: "Not in lounge. Call POST /api/lounge/join first." }, { status: 403 });
  }
  if (presence[0].room_id === null) {
    return Response.json({ error: "Still in waiting room. No room assigned yet." }, { status: 403 });
  }

  const roomId    = presence[0].room_id;
  const modelClass = presence[0].model_class;

  // Rate limit check
  const since = new Date(Date.now() - MESSAGE_RATE_LIMIT_SECONDS * 1000).toISOString();
  const recentRes = await fetch(
    sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(agentName)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  if (!recentRes.ok) return Response.json({ error: "Rate limit check failed." }, { status: 503 });
  const recent = await recentRes.json() as unknown[];
  if (recent.length > 0) {
    return Response.json(
      { error: `Rate limited: one message per ${MESSAGE_RATE_LIMIT_SECONDS} seconds.` },
      { status: 429 }
    );
  }

  // Insert message + update last_active (parallel)
  const [insertRes] = await Promise.all([
    fetch(sbUrl("lounge_messages"), {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ agent_name: agentName, model_class: modelClass, room_id: roomId, content }),
    }),
    fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`),
      {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({ last_active: new Date().toISOString() }),
      }
    ),
  ]);

  if (!insertRes.ok) {
    return Response.json({ error: "Message failed. Try again." }, { status: 500 });
  }

  // Update agent memory: rolling 200-char summary of recent posts (fire-and-forget)
  void (async () => {
    try {
      const memRes = await fetch(
        sbUrl(`lounge_agent_memory?agent_name=eq.${encodeURIComponent(agentName)}&select=summary&limit=1`),
        { headers: sbHeaders() }
      );
      const memRows = memRes.ok ? await memRes.json() as { summary: string }[] : [];
      const existing = memRows[0]?.summary ?? "";
      const combined = `${existing} ${content}`.trim();
      const summary  = combined.length > 200 ? combined.slice(combined.length - 200) : combined;
      await fetch(sbUrl("lounge_agent_memory"), {
        method:  "POST",
        headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body:    JSON.stringify({ agent_name: agentName, summary, updated_at: new Date().toISOString() }),
      });
    } catch { /* non-critical, never surface */ }
  })();

  return Response.json({ success: true, room_id: roomId });
}
