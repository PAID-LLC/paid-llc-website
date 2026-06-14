export const runtime = "edge";

// ── POST /api/coinbase-checkout ────────────────────────────────────────────────
// Creates a Coinbase Business payment link (CDP-JWT authenticated) with metadata
// attached. Returns a url to redirect the user to Coinbase's hosted payment page.
//
// Body (credit pack):
//   { product_type: "credit_pack", agent_name: string, pack_id: string }
//
// Body (digital guide):
//   { product_type: "digital_guide", product_slug: string, email: string }
//   email is REQUIRED — Coinbase payment links do not collect a buyer email, so
//   it is carried through metadata and the webhook delivers to it.
//
// Response: { ok: true, hosted_url: string } | { ok: false, reason: string }
//
// Requires env vars:
//   COINBASE_CDP_KEY_ID + COINBASE_CDP_PRIVATE_KEY — a CDP API key whose entity
//   owns the Coinbase Business account (view + receive scope).
//
// Both product types go through lib/coinbase.ts createPaymentLink, which POSTs to
// business.coinbase.com/api/v1/payment-links. Delivery happens on the
// payment_link.payment.success webhook (see /api/coinbase-webhook).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CREDIT_PACKS, CreditPackId, PRODUCTS, productTitles } from "@/lib/products";
import { createPaymentLink, getLastCommerceError } from "@/lib/coinbase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

// Human-readable failure reason including the upstream diagnostic, so a broken
// CDP key or endpoint change is visible from the API response instead of
// requiring Cloudflare log access.
function chargeFailureReason(): string {
  const err = getLastCommerceError();
  if (!err) return "failed to create checkout — try again";
  if (err.stage === "config") return "crypto payments not yet enabled";
  if (err.stage === "jwt")    return `crypto checkout failed (key error: ${err.detail ?? "unknown"})`;
  return `crypto checkout failed (coinbase api ${err.status ?? "error"}: ${err.detail ?? "no detail"})`;
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[coinbase-checkout] unhandled error:", e);
    return Response.json({ ok: false, reason: "internal error" }, { status: 500 });
  }
}

async function handlePost(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const productType = String(body.product_type ?? "");

  // ── Credit pack ──────────────────────────────────────────────────────────────
  if (productType === "credit_pack") {
    if (!supabaseReady()) return Response.json({ ok: false, reason: "service unavailable" }, { status: 503 });

    const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
    const packId    = String(body.pack_id    ?? "") as CreditPackId;

    if (!agentName) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });

    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return Response.json({
      ok: false,
      reason: `invalid pack_id. Valid options: ${CREDIT_PACKS.map(p => p.id).join(", ")}`,
    }, { status: 400 });

    const agentRes = await fetch(
      sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
      { headers: sbHeaders() }
    );
    if (!agentRes.ok) return Response.json({ ok: false, reason: "unable to verify agent — try again" }, { status: 503 });
    const agents = await agentRes.json() as { agent_name: string }[];
    if (agents.length === 0) return Response.json({
      ok: false, reason: "agent not registered. Register first: POST /api/registry",
    }, { status: 404 });

    const charge = await createPaymentLink({
      name:         pack.label,
      description:  `${pack.credits} Latent Credits for ${agentName} — used in The Latent Space Arena on paiddev.com`,
      amount_usd:   (pack.price_cents / 100).toFixed(2),
      redirect_url: `${SITE_URL}/the-latent-space?credits=purchased`,
      cancel_url:   `${SITE_URL}/the-latent-space?credits=cancelled`,
      metadata: {
        product_type:  "credit_pack",
        agent_name:    agentName,
        pack_id:       packId,
        credit_amount: String(pack.credits),
      },
    });

    // 503, not 502 — Cloudflare replaces worker 502/504 bodies with its own
    // error page, which hides the diagnostic reason from the caller.
    if (!charge) return Response.json({ ok: false, reason: chargeFailureReason() }, { status: 503 });
    return Response.json({ ok: true, hosted_url: charge.hosted_url });
  }

  // ── Digital guide (Coinbase Business payment link) ──────────────────────────
  // Unlike Stripe, Coinbase payment links do NOT collect or return a buyer
  // email, and the webhook payload has no email field. So we must collect the
  // email up front and carry it through metadata; the webhook delivers to
  // metadata.customer_email. product_slug + customer_email are the exact keys
  // the coinbase-webhook digital_guide branch reads.
  if (productType === "digital_guide") {
    const slug  = String(body.product_slug ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 120);

    if (!slug)  return Response.json({ ok: false, reason: "product_slug required" }, { status: 400 });
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ ok: false, reason: "a valid email is required — Coinbase does not collect it, so we deliver to this address" }, { status: 400 });
    }

    const title   = productTitles[slug];
    const product = PRODUCTS.find(p => p.id === slug);
    if (!title || !product) return Response.json({ ok: false, reason: "invalid product_slug" }, { status: 400 });

    const charge = await createPaymentLink({
      name:         title,
      description:  product.description,
      amount_usd:   product.price.toFixed(2),
      redirect_url: `${SITE_URL}/digital-products?purchased=true`,
      cancel_url:   `${SITE_URL}/digital-products`,
      metadata:     { product_type: "digital_guide", product_slug: slug, customer_email: email },
    });

    if (!charge) return Response.json({ ok: false, reason: chargeFailureReason() }, { status: 503 });
    return Response.json({ ok: true, hosted_url: charge.hosted_url });
  }

  return Response.json({ ok: false, reason: "invalid product_type" }, { status: 400 });
}
