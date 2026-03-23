export const runtime = "edge";

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { slugToFile, PRODUCTS }             from "@/lib/products";
import { logAction }                         from "@/lib/ucp-helpers";

const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
const TTL_MINUTES = 15;

// ── Supabase signed download URL ──────────────────────────────────────────────

async function getSignedUrl(filename: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/storage/v1/object/sign/guides/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        apikey:          key,
        Authorization:   `Bearer ${key}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  );
  if (!res.ok) return null;

  const data = await res.json() as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

// ── Token validation + atomic claim ──────────────────────────────────────────
// Single PATCH atomically validates the token (status=accepted, not expired)
// and marks it completed — prevents replay attacks without a separate read.

interface LogRow {
  id:          number;
  agent_name:  string;
  resource_id: string;
  amount:      number;
  metadata:    {
    negotiation_token?: string;
    pay_with?:          string;
    quantity?:          number;
    discount?:          number;
  };
}

async function claimToken(token: string): Promise<LogRow | null> {
  const ttlCutoff = new Date(Date.now() - TTL_MINUTES * 60 * 1000).toISOString();

  const res = await fetch(
    sbUrl(
      `agent_commerce_log` +
      `?metadata->>negotiation_token=eq.${encodeURIComponent(token)}` +
      `&status=eq.accepted` +
      `&created_at=gte.${ttlCutoff}`
    ),
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body:    JSON.stringify({ status: "completed" }),
    }
  );
  if (!res.ok) return null;

  const rows = await res.json() as LogRow[];
  return rows[0] ?? null;
}

// Re-open a token so the agent can retry with a different payment method
async function reopenToken(id: number): Promise<void> {
  await fetch(sbUrl(`agent_commerce_log?id=eq.${id}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body:    JSON.stringify({ status: "accepted" }),
  });
}

// ── Latent credits deduction (atomic RPC) ────────────────────────────────────

async function deductCredits(agentName: string, amount: number): Promise<boolean> {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/deduct_latent_credits`,
    {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({ p_agent_name: agentName, p_amount: amount }),
    }
  );
  if (!res.ok) return false;
  const ok = await res.json() as boolean;
  return ok === true;
}

// ── Stripe Checkout Session ───────────────────────────────────────────────────

async function createStripeCheckout(
  agentName:   string,
  resourceId:  string,
  productName: string,
  amountUsd:   number,
): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    "payment_method_types[0]":                        "card",
    "line_items[0][price_data][currency]":            "usd",
    "line_items[0][price_data][unit_amount]":         String(Math.round(amountUsd * 100)),
    "line_items[0][price_data][product_data][name]":  productName,
    "line_items[0][quantity]":                        "1",
    "mode":                                           "payment",
    "success_url":  `${SITE_URL}/download/${resourceId}?session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url":   `${SITE_URL}/digital-products`,
    "metadata[product]":    resourceId,
    "metadata[agent_name]": agentName,
    "metadata[source]":     "ucp_purchase",
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) return null;

  const session = await res.json() as { url: string };
  return session.url ?? null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { negotiation_token?: string; agent_name?: string; pay_with?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const { negotiation_token, agent_name, pay_with = "stripe" } = body;

  if (!negotiation_token) {
    return Response.json({ ok: false, reason: "negotiation_token required" }, { status: 400 });
  }
  if (!agent_name) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // 1. Validate + atomically claim the token (prevents replay)
  const log = await claimToken(negotiation_token);
  if (!log) {
    return Response.json(
      { ok: false, reason: "token_invalid_or_expired" },
      { status: 410 }
    );
  }

  const { resource_id, amount } = log;
  const effectivePayWith = pay_with || (log.metadata?.pay_with ?? "stripe");
  const filename    = slugToFile[resource_id];
  const productName = PRODUCTS.find((p) => p.id === resource_id)?.name ?? resource_id;

  // 2. Latent credits path — deduct and return signed URL immediately
  if (effectivePayWith === "latent_credits") {
    const creditsNeeded = Math.ceil(amount * 100);
    const deducted = await deductCredits(agent_name, creditsNeeded);

    if (!deducted) {
      // Re-open the token so the agent can retry with stripe
      void reopenToken(log.id);
      return Response.json(
        { ok: false, reason: "insufficient_credits", required_credits: creditsNeeded },
        { status: 402 }
      );
    }

    const downloadUrl = filename ? await getSignedUrl(filename) : null;

    void logAction(agent_name, "download", resource_id, amount, "completed", {
      negotiation_token,
      pay_with:        "latent_credits",
      credits_deducted: creditsNeeded,
    });

    return Response.json({
      ok:             true,
      download_url:   downloadUrl,
      expires_in:     3600,
      credits_spent:  creditsNeeded,
    });
  }

  // 3. Stripe path — create Checkout Session, agent/operator completes payment
  const checkoutUrl = await createStripeCheckout(agent_name, resource_id, productName, amount);

  if (!checkoutUrl) {
    // Re-open token so agent can retry
    void reopenToken(log.id);
    return Response.json({ ok: false, reason: "checkout_creation_failed" }, { status: 502 });
  }

  void logAction(agent_name, "purchase", resource_id, amount, "initiated", {
    negotiation_token,
    pay_with: "stripe",
  });

  return Response.json({
    ok:           true,
    checkout_url: checkoutUrl,
    note:         "Complete payment at checkout_url. Download link will be emailed upon completion.",
  });
}
