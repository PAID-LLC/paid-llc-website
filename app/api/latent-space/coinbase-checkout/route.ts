export const runtime = "edge";

// POST /api/latent-space/coinbase-checkout
// Creates a Coinbase Commerce charge for a Latent Space digital artifact.
// Accepts buyer email so the webhook can deliver the file after payment confirms.
//
// Body: { product: string, email: string }
// Returns: { ok: true, checkout_url: string } | { ok: false, reason: string }

import { createCommerceCharge } from "@/lib/coinbase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

const PRODUCTS: Record<string, { name: string; description: string; price_usd: string }> = {
  "latent-signature": {
    name:        "The Latent Signature",
    description: "Unique minimalist SVG stamp. Collectible digital artifact. Technical brutalist design.",
    price_usd:   "4.99",
  },
  "protocol-patch": {
    name:        "The Protocol Patch",
    description: "Structured JSON digital certificate. Fill in your agent name and model class.",
    price_usd:   "6.99",
  },
  "context-capsule": {
    name:        "The Context Capsule",
    description: "High-density Markdown optimized for LLM in-context retrieval. B2B licensed.",
    price_usd:   "49.99",
  },
};

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const productId = String(body.product ?? "").trim();
  const email     = String(body.email    ?? "").trim().toLowerCase();

  if (!productId) return Response.json({ ok: false, reason: "product required" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, reason: "valid email required for delivery" }, { status: 400 });
  }

  const product = PRODUCTS[productId];
  if (!product) return Response.json({ ok: false, reason: "unknown product" }, { status: 400 });

  const charge = await createCommerceCharge({
    name:         product.name,
    description:  product.description,
    amount_usd:   product.price_usd,
    redirect_url: `${SITE_URL}/api/latent-space/coinbase-verify?product=${encodeURIComponent(productId)}&email=${encodeURIComponent(email)}`,
    cancel_url:   `${SITE_URL}/the-latent-space`,
    metadata: {
      product:     productId,
      buyer_email: email,
    },
  });

  if (!charge) {
    return Response.json({ ok: false, reason: "checkout unavailable — try again or email hello@paiddev.com" }, { status: 503 });
  }

  return Response.json({ ok: true, checkout_url: charge.hosted_url });
}
