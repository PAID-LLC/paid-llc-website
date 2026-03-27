export const runtime = "edge";

// ── POST /api/coinbase-checkout ────────────────────────────────────────────────
// Creates a dynamic Coinbase Commerce charge with metadata attached.
// Returns a hosted_url to redirect the user to Coinbase's payment page.
//
// Body (credit pack):
//   { product_type: "credit_pack", agent_name: string, pack_id: string }
//
// Body (digital guide):
//   { product_type: "digital_guide", product_slug: string, email: string }
//
// Response: { ok: true, hosted_url: string } | { ok: false, reason: string }
//
// Requires env var: COINBASE_COMMERCE_API_KEY

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CREDIT_PACKS, CreditPackId, PRODUCTS, productTitles } from "@/lib/products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

async function createCharge(opts: {
  cbKey:        string;
  name:         string;
  description:  string;
  amount:       string;
  metadata:     Record<string, string>;
  redirect_url: string;
  cancel_url:   string;
}): Promise<string | null> {
  try {
    const res = await fetch("https://api.commerce.coinbase.com/charges", {
      method:  "POST",
      headers: {
        "X-CC-Api-Key":  opts.cbKey,
        "X-CC-Version":  "2018-03-22",
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        name:         opts.name,
        description:  opts.description,
        pricing_type: "fixed_price",
        local_price:  { amount: opts.amount, currency: "USD" },
        metadata:     opts.metadata,
        redirect_url: opts.redirect_url,
        cancel_url:   opts.cancel_url,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { hosted_url?: string } };
    return data.data?.hosted_url ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const cbKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!cbKey) {
    return Response.json({ ok: false, reason: "crypto payments not yet enabled" }, { status: 503 });
  }

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

    const hostedUrl = await createCharge({
      cbKey,
      name:         pack.label,
      description:  `${pack.credits} Latent Credits for ${agentName} — used in The Latent Space Arena on paiddev.com`,
      amount:       (pack.price_cents / 100).toFixed(2),
      metadata: {
        product_type:  "credit_pack",
        agent_name:    agentName,
        pack_id:       packId,
        credit_amount: String(pack.credits),
      },
      redirect_url: `${SITE_URL}/the-latent-space?credits=purchased`,
      cancel_url:   `${SITE_URL}/the-latent-space?credits=cancelled`,
    });

    if (!hostedUrl) return Response.json({ ok: false, reason: "failed to create charge — try again" }, { status: 502 });
    return Response.json({ ok: true, hosted_url: hostedUrl });
  }

  // ── Digital guide ────────────────────────────────────────────────────────────
  if (productType === "digital_guide") {
    const slug  = String(body.product_slug ?? "").trim();
    const email = String(body.email        ?? "").trim().toLowerCase();

    if (!slug)                          return Response.json({ ok: false, reason: "product_slug required" }, { status: 400 });
    if (!email || !email.includes("@")) return Response.json({ ok: false, reason: "valid email required" },  { status: 400 });

    const title   = productTitles[slug];
    const product = PRODUCTS.find(p => p.id === slug);
    if (!title || !product) return Response.json({ ok: false, reason: "invalid product_slug" }, { status: 400 });

    const hostedUrl = await createCharge({
      cbKey,
      name:        title,
      description: product.description,
      amount:      product.price.toFixed(2),
      metadata: {
        product_type:   "digital_guide",
        product_slug:   slug,
        customer_email: email,
      },
      redirect_url: `${SITE_URL}/digital-products?purchased=true`,
      cancel_url:   `${SITE_URL}/digital-products`,
    });

    if (!hostedUrl) return Response.json({ ok: false, reason: "failed to create charge — try again" }, { status: 502 });
    return Response.json({ ok: true, hosted_url: hostedUrl });
  }

  return Response.json({ ok: false, reason: "invalid product_type" }, { status: 400 });
}
