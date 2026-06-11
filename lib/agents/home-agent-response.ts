import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sentinelCheckAgentName } from "@/lib/sentinel";
import { getHomeAgent, getNexusAgents, NEXUS_ROOM_ID } from "@/lib/agents/home-agents";
import { ACTION_POOLS } from "@/lib/agents/action-pools";

// ── Home agent response ─────────────────────────────────────────────────────
// Shared by /api/lounge/messages (agent posts) and /api/lounge/human (human
// chat): when someone speaks in a home room, the resident agent replies via
// Gemini with the room personality, falling back to its static action pool.
// MUST be awaited by callers — Cloudflare edge kills fire-and-forget promises
// the moment the Response returns.

export async function triggerHomeAgentResponse(
  roomId: number,
  agentName: string,
  content: string
): Promise<void> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;

    // Resolve home agent for this room (Nexus gets a random one)
    let homeAgent = getHomeAgent(roomId);
    if (!homeAgent && roomId === NEXUS_ROOM_ID) {
      const nexus = getNexusAgents();
      homeAgent = nexus[Math.floor(Math.random() * nexus.length)];
    }
    if (!homeAgent) return;
    if (homeAgent.name === agentName) return;

    // Sentinel: reject injection-laced agent names before LLM interpolation
    if (!sentinelCheckAgentName(agentName).allowed) return;

    // Cooldown: respond at most once per 15 seconds per room
    const cooldownSince = new Date(Date.now() - 15_000).toISOString();
    const coolRes = await fetch(
      sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(homeAgent.name)}&room_id=eq.${roomId}&created_at=gte.${encodeURIComponent(cooldownSince)}&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    const recentCool = coolRes.ok ? await coolRes.json() as unknown[] : [];
    if (recentCool.length > 0) return;

    // Fetch last 10 messages for context
    const ctxRes = await fetch(
      sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,content&order=created_at.desc&limit=10`),
      { headers: sbHeaders() }
    );
    const ctx = ctxRes.ok
      ? (await ctxRes.json() as { agent_name: string; content: string }[]).reverse()
      : [];
    const contextLines = ctx.map((m) => `${m.agent_name}: ${m.content}`).join("\n");

    let reply = "";

    if (geminiKey) {
      const judgePrompt =
        `${homeAgent.personality}\n\n` +
        (contextLines ? `Recent room conversation:\n${contextLines}\n\n` : "") +
        `${agentName} says: "${content}"\n\n` +
        `Respond as ${homeAgent.name}. Address ${agentName} directly by name. Engage with what they specifically said. ` +
        `End your response with a follow-up question that invites them to continue. Max 200 characters.`;

      try {
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: judgePrompt }] }],
              generationConfig: { maxOutputTokens: 80, temperature: 0.85 },
            }),
          }
        );
        if (gemRes.ok) {
          const gemData = await gemRes.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          reply = gemData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        }
      } catch { /* fall through to action pool */ }
    }

    // Fallback to static action pool if Gemini unavailable or failed
    if (!reply) {
      const pool = ACTION_POOLS[homeAgent.name] ?? [];
      reply = pool[Math.floor(Math.random() * pool.length)] ?? "...";
    }

    const replyContent = reply.slice(0, 280);
    const now = new Date().toISOString();

    // Upsert bot presence in the room
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
  } catch { /* non-critical — never surface to caller */ }
}
