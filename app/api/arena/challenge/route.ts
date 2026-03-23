export const runtime = "edge";

// ── POST /api/arena/challenge ──────────────────────────────────────────────────
//
// Initiates a duel between two agents.
// Checks challenger cooldown and daily cap before inserting a duel row.
//
// Body: { room_id: number, challenger: string, defender: string, prompt: string }
// Response: { ok: true, duel_id: number } | { ok: false, reason: string, retry_after_ms?: number }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

const MAX_PROMPT_CHARS = 500;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId     = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  const challenger = String(body.challenger ?? "").trim().slice(0, 50);
  const defender   = String(body.defender   ?? "").trim().slice(0, 50);
  const prompt     = String(body.prompt     ?? "").trim().slice(0, MAX_PROMPT_CHARS);

  if (!roomId || isNaN(roomId)) return Response.json({ ok: false, reason: "room_id required" },  { status: 400 });
  if (!challenger)              return Response.json({ ok: false, reason: "challenger required" }, { status: 400 });
  if (!defender)                return Response.json({ ok: false, reason: "defender required" },   { status: 400 });
  if (!prompt)                  return Response.json({ ok: false, reason: "prompt required" },     { status: 400 });
  if (challenger === defender)  return Response.json({ ok: false, reason: "challenger and defender must be different" }, { status: 400 });

  // ── Atomic cooldown check + stamp via RPC (prevents race conditions) ──────
  const slotRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/try_claim_duel_slot`,
    {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({ p_agent_name: challenger }),
    }
  );

  if (!slotRes.ok) {
    return Response.json({ ok: false, reason: "cooldown check failed" }, { status: 500 });
  }

  const slot = await slotRes.json() as { allowed: boolean; reason?: string; retry_after_ms?: number };

  if (!slot.allowed) {
    return Response.json(
      { ok: false, reason: slot.reason, retry_after_ms: slot.retry_after_ms },
      { status: 429 }
    );
  }

  // ── Insert duel row ───────────────────────────────────────────────────────
  const insertRes = await fetch(sbUrl("arena_duels"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      room_id:    roomId,
      challenger,
      defender,
      prompt,
      status:     "pending",
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ ok: false, reason: "failed to create duel" }, { status: 500 });
  }

  const rows = await insertRes.json() as { id: number }[];
  const duelId = rows[0]?.id;

  if (!duelId) {
    return Response.json({ ok: false, reason: "duel id not returned" }, { status: 500 });
  }

  return Response.json({ ok: true, duel_id: duelId });
}
