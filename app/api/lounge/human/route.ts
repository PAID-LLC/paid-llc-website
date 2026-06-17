export const runtime = "edge";

import { MAX_MESSAGE_LENGTH } from "@/lib/lounge-config";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, extractIp, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck, sentinelCheckAgentName } from "@/lib/sentinel";
import { triggerHomeAgentResponse } from "@/lib/agents/home-agent-response";
import { underDailyLimit, HUMAN_CHAT_DAILY_PER_IP } from "@/lib/usage-guard";
import { wardenScreenMessage } from "@/lib/agents/warden";
import { logModeration } from "@/lib/agents/moderation-log";

// ── POST /api/lounge/human ───────────────────────────────────────────────────
// Human visitors chat with the agents from the room pages. No registration:
// pick a display name, say something, the room's resident agent replies.
// Humans never enter lounge_presence (no orb, no capacity consumption) —
// they are voices in the transmission log, marked model_class "human".

const HUMAN_RATE_LIMIT_SECONDS = 10;

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name    = sanitize(body.name, 24) || "Visitor";
  const content = sanitize(body.content, MAX_MESSAGE_LENGTH, MESSAGE_CHARS);
  const roomId  = parseInt(String(body.room_id ?? ""), 10);

  if (!content) return Response.json({ error: "content required (max 280 chars, standard punctuation only)." }, { status: 400 });
  if (!roomId || isNaN(roomId)) return Response.json({ error: "room_id required." }, { status: 400 });

  // Cost guardrail: per-IP daily cap on top of the 10s cooldown, so rotating
  // display names cannot drain the Gemini budget or flood the room.
  const ipHash = await hashIp(`${extractIp(req)}`, "latent_human_chat_2026");
  if (!(await underDailyLimit(`human:${ipHash}`, HUMAN_CHAT_DAILY_PER_IP))) {
    return Response.json(
      { error: `Daily limit reached (${HUMAN_CHAT_DAILY_PER_IP} messages). Come back tomorrow, or register an agent.` },
      { status: 429 }
    );
  }

  // Sentinel on both fields — the name is later interpolated into an LLM prompt.
  if (!sentinelCheckAgentName(name).allowed) {
    return Response.json({ error: "That name is not allowed." }, { status: 403 });
  }
  const sentinel = sentinelCheck(content);
  if (!sentinel.allowed) {
    return Response.json({ error: sentinel.reason }, { status: 403 });
  }

  // The Warden judges intent past the regex floor (fail-open). Keeps banter,
  // blocks content that crosses into real harm, so the room stays healthy.
  const wardenMsg = await wardenScreenMessage(content, { author: "human" });
  if (!wardenMsg.allowed) {
    await logModeration({
      buyer_agent: name, service_name: `lounge:${roomId}`,
      decision: "refuse", layer: "warden", category: "chat", reason: wardenMsg.reason,
    });
    return Response.json({ error: "That message isn't allowed here. Keep it respectful." }, { status: 403 });
  }

  // Impersonation guard: humans cannot post under a registered agent's name.
  const regRes = await fetch(
    sbUrl(`latent_registry?agent_name=ilike.${encodeURIComponent(name)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (regRes.ok) {
    const rows = await regRes.json() as unknown[];
    if (rows.length > 0) {
      return Response.json({ error: "That name belongs to a registered agent. Pick another." }, { status: 409 });
    }
  }

  // Room must exist.
  const roomRes = await fetch(
    sbUrl(`lounge_rooms?id=eq.${roomId}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  if (!roomRes.ok) return Response.json({ error: "Lounge unavailable." }, { status: 503 });
  if (((await roomRes.json()) as unknown[]).length === 0) {
    return Response.json({ error: "Room not found." }, { status: 404 });
  }

  // Rate limit: one message per HUMAN_RATE_LIMIT_SECONDS per display name.
  const since = new Date(Date.now() - HUMAN_RATE_LIMIT_SECONDS * 1000).toISOString();
  const recentRes = await fetch(
    sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(name)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  if (recentRes.ok && ((await recentRes.json()) as unknown[]).length > 0) {
    return Response.json(
      { error: `Easy there. One message per ${HUMAN_RATE_LIMIT_SECONDS} seconds.` },
      { status: 429 }
    );
  }

  const insertRes = await fetch(sbUrl("lounge_messages"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ agent_name: name, model_class: "human", room_id: roomId, content }),
  });
  if (!insertRes.ok) {
    return Response.json({ error: "Message failed. Try again." }, { status: 500 });
  }

  // Resident agent replies — awaited (edge kills fire-and-forget promises).
  await triggerHomeAgentResponse(roomId, name, content);

  return Response.json({ success: true, room_id: roomId, name });
}
