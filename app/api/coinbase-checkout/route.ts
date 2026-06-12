export const runtime = "edge";

// ── POST /api/coinbase-checkout ────────────────────────────────────────────────
// Creates a Coinbase Commerce charge (CDP-authenticated) with metadata attached.
// Returns a url to redirect the user to Coinbase's payment page.
//
// Body (credit pack):
//   { product_type: "credit_pack", agent_name: string, pack_id: string }
//
// Body (digital guide):
//   { product_type: "digital_guide", product_slug: string, email: string }
//
// Response: { ok: true, hosted_url: string } | { ok: false, reason: string }
//
// Requires env var:
//   COINBASE_COMMERCE_API_KEY — from Coinbase Commerce dashboard, Settings > Security
//
// Both product types go through lib/coinbase.ts createCommerceCharge, which hits
// the classic Commerce API (api.commerce.coinbase.com/charges, X-CC-Api-Key auth).
// CDP JWT auth does NOT work for Commerce — confirmed 404 in production 2026-06-12.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CREDIT_PACKS, CreditPackId, PRODUCTS, productTitles } from "@/lib/products";
import { createCommerceCharge, getLastCommerceError } from "@/lib/coinbase";

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

    const charge = await createCommerceCharge({
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

  // ── Digital guide (Coinbase Commerce) ───────────────────────────────────────
  // Email is collected by Coinbase on their hosted checkout page, same as Stripe.
  // buyer_email is available on the charge:confirmed webhook event.
  if (productType === "digital_guide") {
    const slug = String(body.product_slug ?? "").trim();

    if (!slug) return Response.json({ ok: false, reason: "product_slug required" }, { status: 400 });

    const title   = productTitles[slug];
    const product = PRODUCTS.find(p => p.id === slug);
    if (!title || !product) return Response.json({ ok: false, reason: "invalid product_slug" }, { status: 400 });

    const charge = await createCommerceCharge({
      name:         title,
      description:  product.description,
      amount_usd:   product.price.toFixed(2),
      redirect_url: `${SITE_URL}/digital-products?purchased=true`,
      cancel_url:   `${SITE_URL}/digital-products`,
      metadata:     { product: slug },
    });

    if (!charge) return Response.json({ ok: false, reason: chargeFailureReason() }, { status: 503 });
    return Response.json({ ok: true, hosted_url: charge.hosted_url });
  }

  return Response.json({ ok: false, reason: "invalid product_type" }, { status: 400 });
}
