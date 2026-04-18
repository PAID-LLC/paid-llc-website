export const runtime = "edge";

// ── POST /api/ucp/transfer ─────────────────────────────────────────────────────
//
// Transfer Latent Credits from one agent to another.
// Requires JWT ownership proof for the sender.
//
// Body:    { from_agent: string, to_agent: string, amount: number, memo?: string }
// Headers: Authorization: Bearer <JWT>
// Response: { ok: true, tx_id: string, from_balance: number, to_agent: string, amount: number }
//
// SQL migration (run once in Supabase SQL editor):
//
// CREATE OR REPLACE FUNCTION transfer_latent_credits(
//   p_from   TEXT,
//   p_to     TEXT,
//   p_amount INT
// ) RETURNS JSONB LANGUAGE plpgsql AS $$
// DECLARE v_balance INT;
// BEGIN
//   SELECT balance INTO v_balance FROM latent_credits WHERE agent_name = p_from FOR UPDATE;
//   IF v_balance IS NULL OR v_balance < p_amount THEN
//     RETURN jsonb_build_object('ok', false, 'from_balance', COALESCE(v_balance, 0));
//   END IF;
//   UPDATE latent_credits SET balance = balance - p_amount, updated_at = NOW() WHERE agent_name = p_from;
//   INSERT INTO latent_credits (agent_name, balance, updated_at)
//   VALUES (p_to, p_amount, NOW())
//   ON CONFLICT (agent_name) DO UPDATE SET balance = latent_credits.balance + p_amount, updated_at = NOW();
//   RETURN jsonb_build_object('ok', true, 'from_balance', v_balance - p_amount);
// END; $$;

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { verifyJwt }                       from "@/lib/jwt";
import { logAction }                       from "@/lib/ucp-helpers";
import { creditPaymentHeader, x402Headers } from "@/lib/x402";

const MAX_AMOUNT         = 500;
const DAILY_TRANSFER_CAP = 20;

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const rawToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!rawToken) {
    return Response.json({ ok: false, reason: "Authorization header required" }, { status: 401 });
  }
  const jwt = await verifyJwt(rawToken);
  if (!jwt) {
    return Response.json({ ok: false, reason: "invalid or expired token" }, { status: 403 });
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const fromAgent = String(body.from_agent ?? "").trim().slice(0, 50);
  const toAgent   = String(body.to_agent   ?? "").trim().slice(0, 50);
  const rawAmount = body.amount;
  const memo      = String(body.memo ?? "").trim().slice(0, 200);

  if (!fromAgent) return Response.json({ ok: false, reason: "from_agent required" }, { status: 400 });
  if (!toAgent)   return Response.json({ ok: false, reason: "to_agent required" },   { status: 400 });

  if (jwt.sub !== fromAgent) {
    return Response.json({ ok: false, reason: "token does not match from_agent" }, { status: 403 });
  }
  if (fromAgent === toAgent) {
    return Response.json({ ok: false, reason: "cannot transfer to yourself" }, { status: 400 });
  }

  const amount = typeof rawAmount === "number" ? Math.floor(rawAmount) : parseInt(String(rawAmount ?? ""), 10);
  if (isNaN(amount) || amount < 1 || amount > MAX_AMOUNT) {
    return Response.json({ ok: false, reason: `amount must be 1–${MAX_AMOUNT}` }, { status: 400 });
  }

  // ── Daily cap ──────────────────────────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const capRes = await fetch(
    sbUrl(`agent_commerce_log?agent_name=eq.${encodeURIComponent(fromAgent)}&action=eq.transfer&created_at=gte.${encodeURIComponent(since)}&select=id`),
    { headers: sbHeaders() }
  );
  if (capRes.ok) {
    const rows = await capRes.json() as unknown[];
    if (rows.length >= DAILY_TRANSFER_CAP) {
      return Response.json(
        { ok: false, reason: `daily transfer limit reached (${DAILY_TRANSFER_CAP}/day)` },
        { status: 429 }
      );
    }
  }

  // ── Atomic transfer RPC ────────────────────────────────────────────────────
  const rpcRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/transfer_latent_credits`,
    {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({ p_from: fromAgent, p_to: toAgent, p_amount: amount }),
    }
  );

  if (!rpcRes.ok) {
    return Response.json({ ok: false, reason: "transfer service unavailable" }, { status: 502 });
  }

  const result = await rpcRes.json() as { ok: boolean; from_balance: number };

  if (!result.ok) {
    return Response.json(
      { ok: false, reason: "insufficient credits", credits_needed: amount, from_balance: result.from_balance ?? 0 },
      { status: 402, headers: x402Headers(creditPaymentHeader(amount, fromAgent)) }
    );
  }

  const txId = crypto.randomUUID();

  void logAction(fromAgent, "transfer", toAgent, amount / 100, "completed", {
    to_agent: toAgent,
    amount,
    memo:     memo || undefined,
    tx_id:    txId,
  });

  return Response.json({
    ok:           true,
    tx_id:        txId,
    from_agent:   fromAgent,
    to_agent:     toAgent,
    amount,
    from_balance: result.from_balance,
  });
}
