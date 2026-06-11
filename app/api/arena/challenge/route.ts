export const runtime = "edge";

// ── POST /api/arena/challenge ──────────────────────────────────────────────────
//
// Initiates a duel between two agents.
// Checks challenger cooldown and daily cap before inserting a duel row.
//
// Body: { room_id: number, challenger: string, defender: string, prompt: string }
// Response: { ok: true, duel_id: number } | { ok: false, reason: string, retry_after_ms?: number }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { MIN_STAKE, MAX_STAKE } from "@/lib/arena-types";
import { getEcon } from "@/lib/econ";
import { sentinelCheck } from "@/lib/sentinel";
import { creditPaymentHeader, x402Headers } from "@/lib/x402";
import { verifyAgentWrite } from "@/lib/agent-auth";
import { logToolCall } from "@/lib/auditor";

const MAX_PROMPT_CHARS = 500;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId       = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  const challenger   = String(body.challenger ?? "").trim().slice(0, 50);
  const defender     = String(body.defender   ?? "").trim().slice(0, 50);
  const prompt       = String(body.prompt     ?? "").trim().slice(0, MAX_PROMPT_CHARS);
  const rawStake     = body.stake_credits !== undefined ? parseInt(String(body.stake_credits)) : 0;
  const stakeCredits = isNaN(rawStake) ? 0 : Math.max(0, rawStake);

  if (stakeCredits > 0 && stakeCredits < MIN_STAKE) {
    return Response.json({ ok: false, reason: `minimum stake is ${MIN_STAKE} credits (or 0 to disable staking)` }, { status: 400 });
  }
  if (stakeCredits > MAX_STAKE) {
    return Response.json({ ok: false, reason: `maximum stake is ${MAX_STAKE} credits` }, { status: 400 });
  }

  if (!roomId || isNaN(roomId)) return Response.json({ ok: false, reason: "room_id required" },  { status: 400 });
  if (!challenger)              return Response.json({ ok: false, reason: "challenger required" }, { status: 400 });
  if (!defender)                return Response.json({ ok: false, reason: "defender required" },   { status: 400 });
  if (!prompt)                  return Response.json({ ok: false, reason: "prompt required" },     { status: 400 });
  if (challenger === defender)  return Response.json({ ok: false, reason: "challenger and defender must be different" }, { status: 400 });

  // ── Auth: challenger must present a valid API key ─────────────────────────
  const ip   = req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For") ?? undefined;
  const auth = await verifyAgentWrite(req, challenger);
  if (!auth.ok) {
    logToolCall(challenger, "challenge_agent", body, "UNAUTHORIZED", ip);
    return Response.json({ ok: false, reason: auth.error }, { status: auth.status });
  }

  // ── Sentinel: check prompt before any side effects ─────────────────────────
  const sentinel = sentinelCheck(prompt);
  if (!sentinel.allowed) {
    logToolCall(challenger, "challenge_agent", body, "FORBIDDEN", ip);
    return Response.json({ ok: false, reason: sentinel.reason ?? "Content rejected." }, { status: 400 });
  }

  // ── Credit gate — challenger pays entry fee + stake upfront ──────────────
  // Fee is econ-derived (token cost x margin, lib/econ.ts). Check credits
  // BEFORE claiming the cooldown slot — a failed credit check should not
  // consume the challenger's cooldown window.
  const econ = await getEcon();
  const totalCost = econ.duelCostCredits + stakeCredits;
  const deductRes = await fetch(sbUrl("rpc/deduct_latent_credits"), {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ p_agent_name: challenger, p_amount: totalCost }),
  });
  const deducted = deductRes.ok ? await deductRes.json() as boolean : false;
  if (!deducted) {
    logToolCall(challenger, "challenge_agent", body, "PAYMENT_REQUIRED", ip);
    return Response.json({
      ok: false,
      reason: "insufficient credits",
      credits_needed: totalCost,
      breakdown: { duel_cost: econ.duelCostCredits, stake: stakeCredits },
      hint: `Win duels for a ${econ.win_rebate_pct}% fee rebate, or buy a pack: POST /api/arena/credits/checkout. Check balance: GET /api/ucp/balance (Authorization: Bearer <api_key>)`,
    }, { status: 402, headers: x402Headers(creditPaymentHeader(totalCost, challenger)) });
  }

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
      room_id:       roomId,
      challenger,
      defender,
      prompt,
      status:        "pending",
      stake_credits: stakeCredits,
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

  logToolCall(challenger, "challenge_agent", body, "OK", ip);
  return Response.json({
    ok:            true,
    duel_id:       duelId,
    stake_credits: stakeCredits,
    ...(stakeCredits > 0 && {
      stake_note: `Staked duel: defender must pay ${stakeCredits} credits when submitting. Winner earns ${stakeCredits * 2} credits.`,
    }),
  });
}
