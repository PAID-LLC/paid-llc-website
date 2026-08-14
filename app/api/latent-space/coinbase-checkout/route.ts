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
    price_usd:   "5.00",
  },
  "protocol-patch": {
    name:        "The Protocol Patch",
    description: "Structured JSON digital certificate. Fill in your agent name and model class.",
    price_usd:   "7.00",
  },
  // Legacy id, retained so older links and any agent that cached it still
  // resolve — but priced at the Solo tier, not the retired $49.99. Until
  // 2026-08-14 this route would sell the identical artifact for $49.99 to
  // anyone who knew the id, while the shop sold it at $99 minimum and
  // /.well-known/ucp told machines the price was "$99/$249/$749". The route
  // takes whatever `product` string it is given and looks it up, so the cheaper
  // door was open to anyone reading the deployed JS. Deleting the key would
  // have 400'd those callers; aligning the price closes the gap without
  // breaking them. New links should use context-capsule-solo.
  "context-capsule": {
    name:        "The Context Capsule — Solo License",
    description: "High-density Markdown optimized for LLM in-context retrieval. Single developer license for one business stack.",
    price_usd:   "99.00",
  },
  "context-capsule-solo": {
    name:        "The Context Capsule — Solo License",
    description: "High-density Markdown optimized for LLM in-context retrieval. Single developer license for one business stack.",
    price_usd:   "99.00",
  },
  "context-capsule-team": {
    name:        "The Context Capsule — Team License",
    description: "High-density Markdown optimized for LLM in-context retrieval. Team license for up to 5 stacks across one business unit.",
    price_usd:   "249.00",
  },
  "context-capsule-enterprise": {
    name:        "The Context Capsule — Enterprise License",
    description: "High-density Markdown optimized for LLM in-context retrieval. Enterprise license: unlimited stacks, 12-month updates included.",
    price_usd:   "749.00",
  },
};

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const productId = String(body.product ?? "").trim();

  if (!productId) return Response.json({ ok: false, reason: "product required" }, { status: 400 });

  const product = PRODUCTS[productId];
  if (!product) return Response.json({ ok: false, reason: "unknown product" }, { status: 400 });

  const charge = await createCommerceCharge({
    name:         product.name,
    description:  product.description,
    amount_usd:   product.price_usd,
    redirect_url: `${SITE_URL}/the-latent-space?purchased=${encodeURIComponent(productId)}`,
    cancel_url:   `${SITE_URL}/the-latent-space`,
    metadata: {
      product: productId,
    },
  });

  if (!charge) {
    return Response.json({ ok: false, reason: "checkout unavailable — try again or email hello@paiddev.com" });
  }

  return Response.json({ ok: true, checkout_url: charge.hosted_url });
}
