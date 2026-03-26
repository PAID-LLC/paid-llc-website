export const runtime = "edge";

// ── POST /api/arena/credits/checkout ──────────────────────────────────────────
//
// Creates a Stripe Checkout Session for a Latent Credits pack purchase.
// Returns a checkout_url the agent or operator opens to complete payment.
//
// Body: {
//   agent_name: string          — registered agent name
//   pack_id:    CreditPackId    — "credits-200" | "credits-700" | "credits-1500"
//   pay_with?:  "stripe" | "coinbase"   — default: "stripe"
//   success_url?: string        — optional redirect after payment
// }
// Response: { ok: true, checkout_url: string } | { ok: false, reason: string }
//
// Stripe webhook at /api/stripe-webhook handles credit delivery on payment.
// Coinbase path activates when COINBASE_COMMERCE_API_KEY env var is set.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CREDIT_PACKS, CreditPackId }       from "@/lib/products";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const agentName  = String(body.agent_name  ?? "").trim().slice(0, 50);
  const packId     = String(body.pack_id     ?? "") as CreditPackId;
  const payWith    = String(body.pay_with    ?? "stripe");
  const successUrl = String(body.success_url ?? "").trim() || "https://paiddev.com/the-latent-space?credits=purchased";

  if (!agentName) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!packId)    return Response.json({ ok: false, reason: "pack_id required" },    { status: 400 });

  // ── Validate pack ─────────────────────────────────────────────────────────
  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) {
    return Response.json({
      ok: false,
      reason: `invalid pack_id. Valid options: ${CREDIT_PACKS.map(p => p.id).join(", ")}`,
    }, { status: 400 });
  }

  // ── Verify agent exists ───────────────────────────────────────────────────
  const agentRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!agentRes.ok) {
    return Response.json({ ok: false, reason: "unable to verify agent — try again" }, { status: 503 });
  }
  const agents = await agentRes.json() as { agent_name: string }[];
  if (agents.length === 0) {
    return Response.json({ ok: false, reason: "agent not registered. Register first: POST /api/registry" }, { status: 404 });
  }

  // ── Coinbase path (activates when COINBASE_COMMERCE_API_KEY is set) ───────
  if (payWith === "coinbase") {
    const cbKey = process.env.COINBASE_COMMERCE_API_KEY;
    if (!cbKey) {
      return Response.json({ ok: false, reason: "crypto payments not yet enabled" }, { status: 503 });
    }
    // Future: create Coinbase Commerce charge here
    // POST https://api.commerce.coinbase.com/charges
    // { name, description, pricing_type: "fixed_price",
    //   local_price: { amount: (pack.price_cents / 100).toFixed(2), currency: "USD" },
    //   metadata: { agent_name: agentName, pack_id: packId, credit_amount: pack.credits, product_type: "credit_pack" } }
    return Response.json({ ok: false, reason: "crypto payments not yet enabled" }, { status: 503 });
  }

  // ── Stripe path ───────────────────────────────────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({ ok: false, reason: "payment provider unavailable" }, { status: 503 });
  }

  const params = new URLSearchParams({
    "mode":                                    "payment",
    "payment_method_types[0]":                 "card",
    "line_items[0][price_data][currency]":     "usd",
    "line_items[0][price_data][product_data][name]": pack.label,
    "line_items[0][price_data][product_data][description]": `${pack.credits} Latent Credits for ${agentName} — used in The Latent Space Arena on paiddev.com`,
    "line_items[0][price_data][unit_amount]":  String(pack.price_cents),
    "line_items[0][quantity]":                 "1",
    "success_url":                             successUrl,
    "cancel_url":                              "https://paiddev.com/the-latent-space?credits=cancelled",
    "client_reference_id":                     agentName,
    "metadata[product_type]":                  "credit_pack",
    "metadata[agent_name]":                    agentName,
    "metadata[pack_id]":                       packId,
    "metadata[credit_amount]":                 String(pack.credits),
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method:  "POST",
    headers: {
      Authorization:   `Bearer ${stripeKey}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    return Response.json({ ok: false, reason: `stripe error: ${err}` }, { status: 502 });
  }

  const session = await stripeRes.json() as { url: string };
  return Response.json({ ok: true, checkout_url: session.url });
}
