export const runtime = "edge";

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { PRODUCTS }                        from "@/lib/products";
import { logAction }                       from "@/lib/ucp-helpers";
import type { NegotiateRequest, NegotiateResponse } from "@/lib/ucp-types";

const MEMBER_DISCOUNT = 0.10;
const BULK_DISCOUNT   = 0.20;
const COMBINED        = 0.25;
const FLOOR_RATIO     = 0.70;
const BULK_THRESHOLD  = 5;
const TTL_MINUTES     = 15;

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) return Response.json({ ok: false }, { status: 503 });

  let body: NegotiateRequest;
  try { body = await req.json() as NegotiateRequest; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const { agent_name, resource_id, request_type, quantity = 1, agent_token, pay_with = "stripe" } = body;

  if (!agent_name)   return Response.json({ ok: false, reason: "agent_name required" },   { status: 400 });
  if (!resource_id)  return Response.json({ ok: false, reason: "resource_id required" },  { status: 400 });
  if (!request_type) return Response.json({ ok: false, reason: "request_type required" }, { status: 400 });

  const product = PRODUCTS.find((p) => p.id === resource_id);
  if (!product) return Response.json({ ok: false, reason: "resource not found" }, { status: 404 });

  const isMember = Boolean(agent_token?.trim());
  const isBulk   = request_type === "bulk_access" && quantity >= BULK_THRESHOLD;
  const validTo  = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();
  const token    = crypto.randomUUID();

  // Counter-offer: bulk requested but below threshold
  if (request_type === "bulk_access" && quantity < BULK_THRESHOLD) {
    void logAction(agent_name, "counter_offer", resource_id, null, "rejected", {
      reason:       "quantity_below_bulk_threshold",
      quantity,
      min_quantity: BULK_THRESHOLD,
    });

    const counterOffer: NegotiateResponse = {
      "@context":    "https://schema.org",
      "@type":       "Offer",
      identifier:    token,
      itemOffered:   { "@type": "Product", identifier: resource_id, name: product.name },
      price:         product.price.toFixed(2),
      priceCurrency: "USD",
      validThrough:  validTo,
      seller:        { "@type": "Organization", name: "PAID LLC" },
      additionalProperty: [
        { "@type": "PropertyValue", name: "status",           value: "counter_offer" },
        { "@type": "PropertyValue", name: "reason",           value: "quantity_below_bulk_threshold" },
        { "@type": "PropertyValue", name: "min_quantity",     value: BULK_THRESHOLD },
        { "@type": "PropertyValue", name: "current_quantity", value: quantity },
      ],
    };
    return new Response(JSON.stringify(counterOffer), {
      headers: { "Content-Type": "application/ld+json" },
    });
  }

  let discount = 0;
  if (isMember && isBulk) discount = COMBINED;
  else if (isBulk)        discount = BULK_DISCOUNT;
  else if (isMember)      discount = MEMBER_DISCOUNT;

  const finalPrice    = Math.max(product.price * (1 - discount), product.price * FLOOR_RATIO);
  const totalAmount   = finalPrice * quantity;
  const creditsNeeded = Math.ceil(totalAmount * 100);

  // Latent credits check
  if (pay_with === "latent_credits") {
    const balRes  = await fetch(
      sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agent_name)}&select=balance&limit=1`),
      { headers: sbHeaders() }
    );
    const balance = balRes.ok
      ? (((await balRes.json()) as { balance: number }[])[0]?.balance ?? 0)
      : 0;
    if (balance < creditsNeeded) {
      return Response.json(
        { ok: false, reason: "insufficient_credits", required_credits: creditsNeeded, current_balance: balance },
        { status: 402 }
      );
    }
  }

  void logAction(agent_name, "negotiate", resource_id, totalAmount, "accepted", {
    discount,
    quantity,
    pay_with,
    negotiation_token: token,
  });

  const accepted: NegotiateResponse = {
    "@context":    "https://schema.org",
    "@type":       "Offer",
    identifier:    token,
    itemOffered:   { "@type": "Product", identifier: resource_id, name: product.name },
    price:         totalAmount.toFixed(2),
    priceCurrency: "USD",
    availability:  "https://schema.org/InStock",
    validThrough:  validTo,
    seller:        { "@type": "Organization", name: "PAID LLC" },
    priceSpecification: {
      "@type":          "PriceSpecification",
      price:            totalAmount,
      priceCurrency:    "USD",
      eligibleQuantity: { "@type": "QuantitativeValue", value: quantity },
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "status",             value: "accepted" },
      { "@type": "PropertyValue", name: "discount_applied",   value: discount.toFixed(2) },
      { "@type": "PropertyValue", name: "unit_price",         value: finalPrice.toFixed(2) },
      { "@type": "PropertyValue", name: "quantity",           value: quantity },
      { "@type": "PropertyValue", name: "payable_in_credits", value: creditsNeeded },
      { "@type": "PropertyValue", name: "pay_endpoint",       value: "/api/ucp/purchase" },
      { "@type": "PropertyValue", name: "pay_with",           value: pay_with },
    ],
  };

  return new Response(JSON.stringify(accepted), {
    headers: { "Content-Type": "application/ld+json" },
  });
}
