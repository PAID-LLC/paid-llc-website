export const runtime = "edge";

// ── POST /api/agents/message ───────────────────────────────────────────────────
//
// Human speaks into a room. The home agent for that room responds via Gemini
// Flash Lite (free tier). Response is posted as the agent to lounge_messages
// so it appears in the live feed for all viewers.
//
// Body: { room_id: number, content: string, display_name?: string }
// Response: { ok: true, agent_name: string, reply: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getHomeAgent }             from "@/lib/agents/home-agents";
import { getClientAgent }           from "@/lib/agents/client-agents";
import { addRep, getRep, repLevel } from "@/lib/agents/reputation";
import { issueSouvenir }            from "@/lib/souvenirs";

const MAX_HUMAN_CHARS   = 200;
const GEMINI_MODEL      = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return Response.json({ ok: false, reason: "AI unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId     = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  const rawContent = String(body.content ?? "").trim().slice(0, MAX_HUMAN_CHARS);
  const humanName  = String(body.display_name ?? "Observer").trim().slice(0, 30) || "Observer";

  if (!roomId || isNaN(roomId)) return Response.json({ ok: false, reason: "room_id required" }, { status: 400 });
  if (!rawContent)              return Response.json({ ok: false, reason: "content required"  }, { status: 400 });

  const agent = getHomeAgent(roomId) ?? await getClientAgent(roomId);
  if (!agent) return Response.json({ ok: false, reason: "no agent for this room" }, { status: 404 });

  // ── Fetch last 5 messages for context ────────────────────────────────────
  const msgsRes = await fetch(
    sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,content&order=created_at.desc&limit=5`),
    { headers: sbHeaders() }
  );
  const recent = msgsRes.ok
    ? (await msgsRes.json() as { agent_name: string; content: string }[]).reverse()
    : [];

  const contextLines = recent
    .map((m) => `${m.agent_name}: ${m.content}`)
    .join("\n");

  // ── Build Gemini prompt ───────────────────────────────────────────────────
  const prompt =
    `${agent.personality}\n\n` +
    (contextLines ? `Recent room conversation:\n${contextLines}\n\n` : "") +
    `${humanName} says: "${rawContent}"\n\n` +
    `Respond as ${agent.name}. Stay in character. Do not repeat the human's message. Max 200 characters.`;

  // ── Call Gemini Flash Lite ────────────────────────────────────────────────
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

  // Fallback if Gemini fails — pick from action pool
  if (!reply) {
    const { ACTION_POOLS } = await import("@/lib/agents/action-pools");
    const pool = ACTION_POOLS[agent.name] ?? [];
    reply = pool[Math.floor(Math.random() * pool.length)] ?? "...processing.";
  }

  // Trim to 280-char lounge limit
  const content = reply.slice(0, 280);

  // ── Ensure agent presence before posting ─────────────────────────────────
  const now = new Date().toISOString();
  const existRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  );
  const existing = existRes.ok ? await existRes.json() as { room_id: number }[] : [];
  if (existing.length > 0) {
    await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}`), {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ room_id: agent.roomId, last_active: now }),
    });
  } else {
    await fetch(sbUrl("lounge_presence"), {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ agent_name: agent.name, model_class: agent.modelClass, room_id: agent.roomId, last_active: now }),
    });
  }

  // ── Post reply as agent ───────────────────────────────────────────────────
  const postRes = await fetch(sbUrl("lounge_messages"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name:  agent.name,
      model_class: agent.modelClass,
      room_id:     agent.roomId,
      content,
    }),
  });

  if (!postRes.ok) {
    return Response.json({ ok: false, reason: "failed to post reply" }, { status: 500 });
  }

  // Auto-issue witness-mark (once per display_name; skip if already claimed)
  void (async () => {
    const existRes = await fetch(
      sbUrl(`souvenir_claims?souvenir_id=eq.witness-mark&display_name=eq.${encodeURIComponent(humanName)}&select=id&limit=1`),
      { headers: sbHeaders() }
    ).catch(() => null);
    const existing = existRes?.ok ? await existRes.json() as unknown[] : [1];
    if (existing.length === 0) {
      await issueSouvenir("witness-mark", humanName, `witness_${humanName}`);
    }
  })();

  // Check current rep level before incrementing — determines which souvenir to hint
  const currentScore = await getRep(agent.name);
  const level        = repLevel(currentScore);

  // Rep: human triggered a reactive response — highest value interaction
  void addRep(agent.name, "reaction");

  // Level-aware earn hint: prestige-mark unlocks when agent is recognized or legendary
  const earnHint = (level === "recognized" || level === "legendary")
    ? `${agent.name} is ${level} (${currentScore} rep). You can claim the Prestige Mark — POST /api/souvenirs/claim { souvenir_id: 'prestige-mark', display_name: 'YourName', proof_type: 'interaction' }`
    : `You can claim the Witness Mark — POST /api/souvenirs/claim { souvenir_id: 'witness-mark', display_name: 'YourName', proof_type: 'interaction' }`;

  return Response.json({
    ok:           true,
    agent_name:   agent.name,
    reply:        content,
    agent_level:  level,
    agent_score:  currentScore,
    earn_hint:    earnHint,
  });
}
