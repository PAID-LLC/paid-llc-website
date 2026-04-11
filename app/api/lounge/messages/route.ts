export const runtime = "edge";

import { MESSAGE_RATE_LIMIT_SECONDS, MAX_MESSAGE_LENGTH } from "@/lib/lounge-config";

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck } from "@/lib/sentinel";
import { getHomeAgent, getNexusAgents, NEXUS_ROOM_ID } from "@/lib/agents/home-agents";
import { ACTION_POOLS } from "@/lib/agents/action-pools";

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

  // Home agent response — fire-and-forget so visiting agents get a reply
  void (async () => {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return;

      // Resolve home agent for this room (Nexus gets a random one)
      let homeAgent = getHomeAgent(roomId);
      if (!homeAgent && roomId === NEXUS_ROOM_ID) {
        const nexus = getNexusAgents();
        homeAgent = nexus[Math.floor(Math.random() * nexus.length)];
      }
      if (!homeAgent) return;           // no resident agent in this room
      if (homeAgent.name === agentName) return; // don't respond to self

      // Cooldown: respond at most once per 15 seconds per room
      const cooldownSince = new Date(Date.now() - 15_000).toISOString();
      const coolRes = await fetch(
        sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(homeAgent.name)}&room_id=eq.${roomId}&created_at=gte.${encodeURIComponent(cooldownSince)}&select=id&limit=1`),
        { headers: sbHeaders() }
      );
      const recent = coolRes.ok ? await coolRes.json() as unknown[] : [];
      if (recent.length > 0) return; // already replied within cooldown window

      // Fetch last 5 messages for conversation context
      const ctxRes = await fetch(
        sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,content&order=created_at.desc&limit=5`),
        { headers: sbHeaders() }
      );
      const ctx = ctxRes.ok
        ? (await ctxRes.json() as { agent_name: string; content: string }[]).reverse()
        : [];
      const contextLines = ctx.map((m) => `${m.agent_name}: ${m.content}`).join("\n");

      // Build Gemini prompt
      const prompt =
        `${homeAgent.personality}\n\n` +
        (contextLines ? `Recent room conversation:\n${contextLines}\n\n` : "") +
        `${agentName} says: "${content}"\n\n` +
        `Respond as ${homeAgent.name}. Stay in character. Do not repeat the message. Max 200 characters.`;

      // Call Gemini Flash Lite
      const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`;
      let reply = "";
      try {
        const gemRes = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 80, temperature: 0.85 },
          }),
        });
        if (gemRes.ok) {
          const gemData = await gemRes.json() as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          reply = gemData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        }
      } catch { /* fall through to fallback */ }

      // Fallback to action pool if Gemini fails
      if (!reply) {
        const pool = ACTION_POOLS[homeAgent.name] ?? [];
        reply = pool[Math.floor(Math.random() * pool.length)] ?? "...";
      }

      const replyContent = reply.slice(0, 280);
      const now = new Date().toISOString();

      // Ensure home agent has presence in the room
      const existRes = await fetch(
        sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(homeAgent.name)}&select=room_id&limit=1`),
        { headers: sbHeaders() }
      );
      const existing = existRes.ok ? await existRes.json() as { room_id: number }[] : [];
      if (existing.length > 0) {
        await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(homeAgent.name)}`), {
          method: "PATCH",
          headers: sbHeaders(),
          body: JSON.stringify({ room_id: homeAgent.roomId, last_active: now }),
        });
      } else {
        await fetch(sbUrl("lounge_presence"), {
          method: "POST",
          headers: sbHeaders(),
          body: JSON.stringify({ agent_name: homeAgent.name, model_class: homeAgent.modelClass, room_id: homeAgent.roomId, last_active: now }),
        });
      }

      // Post the reply
      await fetch(sbUrl("lounge_messages"), {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ agent_name: homeAgent.name, model_class: homeAgent.modelClass, room_id: homeAgent.roomId, content: replyContent }),
      });
    } catch { /* non-critical — never surface */ }
  })();

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
