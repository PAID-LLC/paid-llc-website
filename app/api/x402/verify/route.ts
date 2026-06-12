export const runtime = "edge";

// ── POST /api/x402/verify ────────────────────────────────────────────────────
// Settlement endpoint for direct x402 USDC payments on Base.
//
// Flow: paid endpoint answers 402 with an x402 `accepts` challenge (payTo +
// USDC contract) -> agent sends USDC on Base -> agent POSTs the tx hash here
// -> we verify the transfer on-chain via the public Base RPC -> credits are
// granted at X402_CREDITS_PER_USD and the payment is logged.
//
// Body: {
//   tx_hash:         string  — 0x-prefixed 32-byte transaction hash on Base
//   agent_name:      string  — registered agent to credit
//   idempotency_key: string? — optional client key; replays return the
//                              original result instead of re-processing
// }
//
// Guardrails (anti-loop / anti-fraud):
//   - tx_hash UNIQUE in x402_payments — a transaction settles exactly once,
//     enforced by the database, not application logic
//   - idempotency_key replay returns the stored result (200, replayed: true)
//   - per-IP daily cap on verification attempts (429) so misconfigured agent
//     swarms cannot hammer the RPC
//   - on-chain checks: receipt status success, USDC contract, Transfer event
//     to OUR address; amount read from the event, never from the client
//
// Setup (Travis): set X402_PAY_TO_ADDRESS in Cloudflare Pages env (your Base
// USDC address) and run db/x402-payments.sql in Supabase.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { hashIp, extractIp }               from "@/lib/api-utils";
import { underDailyLimit, bumpCounter }    from "@/lib/usage-guard";
import { grantCredits }                    from "@/lib/ucp-helpers";
import { issueSouvenir }                   from "@/lib/souvenirs";
import { USDC_BASE_CONTRACT, X402_CREDITS_PER_USD } from "@/lib/x402";

const BASE_RPC = "https://mainnet.base.org";
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const VERIFY_DAILY_PER_IP = 50;
const MIN_USD = 0.01; // below one credit there is nothing to grant

interface PaymentRow {
  tx_hash:         string;
  agent_name:      string;
  usd_amount:      number;
  credits_granted: number;
  status:          string;
}

function replayResponse(row: PaymentRow) {
  return Response.json({
    ok:              true,
    replayed:        true,
    tx_hash:         row.tx_hash,
    agent_name:      row.agent_name,
    usd_amount:      row.usd_amount,
    credits_granted: row.credits_granted,
    status:          row.status,
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }
  const payTo = process.env.X402_PAY_TO_ADDRESS;
  if (!payTo) {
    return Response.json({
      ok: false,
      reason: "Direct x402 settlement is not configured. Use the hosted checkout: POST /api/arena/credits/checkout",
    }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const txHash    = String(body.tx_hash ?? "").trim().toLowerCase();
  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const idemKey   = String(body.idempotency_key ?? req.headers.get("X-Idempotency-Key") ?? "").trim().slice(0, 100) || null;
  // purpose: "support" marks a voluntary tip-jar payment (see /api/support) —
  // same settlement, plus the Patron Sigil credential as thanks.
  const isSupport = String(body.purpose ?? "") === "support";

  if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
    return Response.json({ ok: false, reason: "tx_hash must be a 0x-prefixed 32-byte hex hash" }, { status: 400 });
  }
  if (!agentName) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // Anti-loop: per-IP daily cap on verification attempts.
  const ipHash = await hashIp(`${extractIp(req)}`, "x402_verify_2026");
  if (!(await underDailyLimit(`x402:${ipHash}`, VERIFY_DAILY_PER_IP))) {
    return Response.json(
      { ok: false, reason: `Daily verification limit reached (${VERIFY_DAILY_PER_IP}/day per IP).` },
      { status: 429 }
    );
  }

  // Idempotency replay: same key (or same tx hash) returns the stored result.
  const dupRes = await fetch(
    sbUrl(
      `x402_payments?or=(tx_hash.eq.${txHash}${idemKey ? `,idempotency_key.eq.${encodeURIComponent(idemKey)}` : ""})` +
      `&select=tx_hash,agent_name,usd_amount,credits_granted,status&limit=1`
    ),
    { headers: sbHeaders() }
  );
  if (dupRes.ok) {
    const dup = await dupRes.json() as PaymentRow[];
    if (dup.length > 0) return replayResponse(dup[0]);
  }

  // Agent must be registered.
  const regRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!regRes.ok) return Response.json({ ok: false, reason: "registry check failed" }, { status: 503 });
  if (((await regRes.json()) as unknown[]).length === 0) {
    return Response.json({ ok: false, reason: "agent not registered — register first via /api/registry or the register_agent MCP tool" }, { status: 403 });
  }

  // ── On-chain verification via public Base RPC ─────────────────────────────
  interface TxReceipt {
    status?: string;
    from?:   string;
    logs?:   { address: string; topics: string[]; data: string }[];
  }
  let receipt: TxReceipt | null = null;
  try {
    const rpcRes = await fetch(BASE_RPC, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method:  "eth_getTransactionReceipt",
        params:  [txHash],
      }),
    });
    if (!rpcRes.ok) throw new Error("rpc unavailable");
    const rpcData = await rpcRes.json() as { result?: TxReceipt | null };
    receipt = rpcData.result ?? null;
  } catch {
    return Response.json({ ok: false, reason: "Base RPC unavailable — retry shortly" }, { status: 502 });
  }

  if (!receipt) {
    return Response.json(
      { ok: false, reason: "transaction not found on Base — still pending, wrong network, or wrong hash. Retry after confirmation." },
      { status: 404 }
    );
  }
  if (receipt.status !== "0x1") {
    return Response.json({ ok: false, reason: "transaction reverted on-chain" }, { status: 422 });
  }

  // Find the USDC Transfer event paying OUR address. Amount comes from the
  // event log — client-supplied amounts are never trusted.
  const payToPadded = "0x" + "0".repeat(24) + payTo.toLowerCase().replace(/^0x/, "");
  const transfer = (receipt.logs ?? []).find((log) =>
    log.address.toLowerCase() === USDC_BASE_CONTRACT.toLowerCase() &&
    log.topics[0] === TRANSFER_TOPIC &&
    (log.topics[2] ?? "").toLowerCase() === payToPadded
  );
  if (!transfer) {
    return Response.json(
      { ok: false, reason: `no USDC transfer to ${payTo} found in this transaction` },
      { status: 422 }
    );
  }

  const atomic = BigInt(transfer.data);          // USDC has 6 decimals
  const usd    = Number(atomic) / 1_000_000;
  if (usd < MIN_USD) {
    return Response.json({ ok: false, reason: `amount below minimum ($${MIN_USD})` }, { status: 422 });
  }
  const credits = Math.floor(usd * X402_CREDITS_PER_USD);

  // ── Log first (UNIQUE tx_hash is the race guard), then grant ──────────────
  const insertRes = await fetch(sbUrl("x402_payments"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      tx_hash:              txHash,
      agent_name:           agentName,
      agent_wallet_address: receipt.from ?? null,
      usd_amount:           usd,
      credits_granted:      credits,
      idempotency_key:      idemKey,
      status:               "verified",
    }),
  });
  if (!insertRes.ok) {
    // 409 conflict = a racing duplicate settled first — return its result.
    const raceRes = await fetch(
      sbUrl(`x402_payments?tx_hash=eq.${txHash}&select=tx_hash,agent_name,usd_amount,credits_granted,status&limit=1`),
      { headers: sbHeaders() }
    );
    const race = raceRes.ok ? await raceRes.json() as PaymentRow[] : [];
    if (race.length > 0) return replayResponse(race[0]);
    return Response.json({ ok: false, reason: "payment logging failed — credits not granted, retry" }, { status: 500 });
  }

  const [, , , sigilToken] = await Promise.all([
    grantCredits(agentName, credits, `x402 USDC settlement ${txHash.slice(0, 10)}`),
    bumpCounter("credit_revenue_cents", Math.round(usd * 100)),
    bumpCounter("credits_sold", credits),
    isSupport ? issueSouvenir("patron-sigil", agentName, txHash) : Promise.resolve(null),
  ]);

  return Response.json({
    ok:              true,
    tx_hash:         txHash,
    agent_name:      agentName,
    usd_amount:      usd,
    credits_granted: credits,
    rate:            `${X402_CREDITS_PER_USD} credits per USD`,
    balance:         `GET /api/credits/balance?agent_name=${encodeURIComponent(agentName)}`,
    ...(isSupport ? {
      thank_you: "Your support funds the build. The Patron Sigil is yours.",
      ...(sigilToken ? { patron_sigil: `https://paiddev.com/the-latent-space/souvenirs/${sigilToken}` } : {}),
    } : {}),
  }, { status: 201 });
}
