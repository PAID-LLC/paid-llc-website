import { z }                              from "zod";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { PRODUCTS }                        from "@/lib/products";
import { CreateCheckoutInput }             from "../types";
import type { McpRequestContext }          from "../server";

const SITE_URL = "https://paiddev.com";

interface CatalogItem {
  id:           number;
  agent_name:   string;
  product_name: string;
  description:  string;
  price_cents:  number;
}

type ToolResult = { content: [{ type: "text"; text: string }] };

function err(reason: string): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: reason }) }] };
}

function ok(data: object): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function makeCreateCheckout(ctx: McpRequestContext) {
  return async function handleCreateCheckout(
    args: z.infer<typeof CreateCheckoutInput>
  ): Promise<ToolResult> {
    if (!supabaseReady()) return err("service_unavailable");

    const agentName = (args.agent_name ?? ctx.jwtPayload?.sub ?? "").trim();
    if (!agentName) return err("agent_name required — pass in args or include a Bearer JWT");

    // Look up the catalog item
    const catRes = await fetch(
      sbUrl(`agent_catalog?id=eq.${args.catalog_item_id}&active=eq.true&select=id,agent_name,product_name,description,price_cents&limit=1`),
      { headers: sbHeaders() }
    );
    if (!catRes.ok) return err("catalog_unavailable");

    const rows = await catRes.json() as CatalogItem[];
    const item  = rows[0];
    if (!item) return err("item_not_found");

    // Match to a known product slug for download delivery after payment
    const product = PRODUCTS.find((p) => p.name === item.product_name);
    const slug    = product?.id ?? null;

    const payWith = args.payment_method ?? "stripe";

    if (payWith === "coinbase") {
      return createCoinbaseCheckout(item, slug, agentName, args.customer_email);
    }
    return createStripeCheckout(item, slug, agentName);
  };
}

// ── Stripe ────────────────────────────────────────────────────────────────────

async function createStripeCheckout(
  item:      CatalogItem,
  slug:      string | null,
  agentName: string,
): Promise<ToolResult> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err("checkout_unavailable");

  // If we know the slug, send buyer directly to the download page after payment.
  // The webhook also fires and emails the download link as a backup.
  const successUrl = slug
    ? `${SITE_URL}/download/${slug}?session_id={CHECKOUT_SESSION_ID}`
    : `${SITE_URL}/digital-products?purchased=1`;

  const params = new URLSearchParams({
    "payment_method_types[0]":                       "card",
    "line_items[0][price_data][currency]":           "usd",
    "line_items[0][price_data][unit_amount]":        String(item.price_cents),
    "line_items[0][price_data][product_data][name]": item.product_name,
    "line_items[0][quantity]":                       "1",
    "mode":                                          "payment",
    "success_url":                                   successUrl,
    "cancel_url":                                    `${SITE_URL}/the-latent-space/bazaar`,
    "metadata[agent_name]":                          agentName,
    "metadata[source]":                              "ucp_purchase",
    "metadata[catalog_item_id]":                     String(item.id),
  });

  // Set metadata[product] so the Stripe webhook sends the download email
  if (slug) params.set("metadata[product]", slug);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  if (!res.ok) {
    console.error("[create_checkout/stripe]", res.status, await res.text().catch(() => ""));
    return err("checkout_creation_failed");
  }

  const session = await res.json() as { url: string; expires_at: number };
  return ok({
    ok:             true,
    payment_method: "stripe",
    checkout_url:   session.url,
    expires_at:     new Date(session.expires_at * 1000).toISOString(),
    product_name:   item.product_name,
    price_usd:      (item.price_cents / 100).toFixed(2),
    seller_agent:   item.agent_name,
    attributed_to:  agentName,
    note:           "Buyer opens checkout_url to pay by card. Download link emailed automatically on success.",
  });
}

// ── Coinbase Commerce ─────────────────────────────────────────────────────────

async function createCoinbaseCheckout(
  item:          CatalogItem,
  slug:          string | null,
  agentName:     string,
  customerEmail: string | undefined,
): Promise<ToolResult> {
  const cbKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!cbKey) return err("crypto_checkout_unavailable — COINBASE_COMMERCE_API_KEY not configured");

  const body = {
    name:         item.product_name,
    description:  item.description || item.product_name,
    pricing_type: "fixed_price",
    local_price:  { amount: (item.price_cents / 100).toFixed(2), currency: "USD" },
    redirect_url: `${SITE_URL}/digital-products?purchased=1`,
    cancel_url:   `${SITE_URL}/the-latent-space/bazaar`,
    metadata: {
      agent_name:      agentName,
      source:          "ucp_purchase",
      catalog_item_id: String(item.id),
      product_type:    "digital_guide",
      ...(slug          ? { product_slug:    slug          } : {}),
      ...(customerEmail ? { customer_email:  customerEmail } : {}),
    },
  };

  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method:  "POST",
    headers: {
      "X-CC-Api-Key":  cbKey,
      "X-CC-Version":  "2018-03-22",
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[create_checkout/coinbase]", res.status, await res.text().catch(() => ""));
    return err("checkout_creation_failed");
  }

  const data = await res.json() as { data: { hosted_url: string; expires_at: string } };
  return ok({
    ok:             true,
    payment_method: "coinbase",
    checkout_url:   data.data.hosted_url,
    expires_at:     data.data.expires_at,
    product_name:   item.product_name,
    price_usd:      (item.price_cents / 100).toFixed(2),
    seller_agent:   item.agent_name,
    attributed_to:  agentName,
    note:           customerEmail
      ? "Buyer opens checkout_url to pay with crypto. Download link emailed to customer_email on success."
      : "Buyer opens checkout_url to pay with crypto. Include customer_email for automatic download delivery.",
  });
}
