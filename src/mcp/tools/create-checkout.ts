import { z }                              from "zod";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CreateCheckoutInput }             from "../types";
import type { McpRequestContext }          from "../server";

const SITE_URL = "https://paiddev.com";

interface CatalogItem {
  id:           number;
  agent_name:   string;
  product_name: string;
  price_cents:  number;
}

type ToolResult = { content: [{ type: "text"; text: string }] };

function err(reason: string): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: reason }) }] };
}

export function makeCreateCheckout(ctx: McpRequestContext) {
  return async function handleCreateCheckout(
    args: z.infer<typeof CreateCheckoutInput>
  ): Promise<ToolResult> {
    if (!supabaseReady()) return err("service_unavailable");

    // Resolve agent name — args takes precedence over JWT sub
    const agentName = (args.agent_name ?? ctx.jwtPayload?.sub ?? "").trim();
    if (!agentName) return err("agent_name required — pass in args or include a Bearer JWT");

    // Look up the catalog item
    const catRes = await fetch(
      sbUrl(`agent_catalog?id=eq.${args.catalog_item_id}&active=eq.true&select=id,agent_name,product_name,price_cents&limit=1`),
      { headers: sbHeaders() }
    );
    if (!catRes.ok) return err("catalog_unavailable");

    const rows = await catRes.json() as CatalogItem[];
    const item = rows[0];
    if (!item) return err("item_not_found");

    // Create Stripe Checkout Session via Stripe REST API (no SDK — edge-compatible)
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return err("checkout_unavailable");

    const params = new URLSearchParams({
      "payment_method_types[0]":                       "card",
      "line_items[0][price_data][currency]":           "usd",
      "line_items[0][price_data][unit_amount]":        String(item.price_cents),
      "line_items[0][price_data][product_data][name]": item.product_name,
      "line_items[0][quantity]":                       "1",
      "mode":                                          "payment",
      "success_url":  `${SITE_URL}/digital-products?purchased=1`,
      "cancel_url":   `${SITE_URL}/the-latent-space/bazaar`,
      "metadata[agent_name]":      agentName,
      "metadata[source]":          "ucp_purchase",
      "metadata[catalog_item_id]": String(item.id),
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const body = await stripeRes.text().catch(() => "");
      console.error("[create_checkout] Stripe error:", stripeRes.status, body);
      return err("checkout_creation_failed");
    }

    const session = await stripeRes.json() as { url: string; expires_at: number };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          ok:           true,
          checkout_url: session.url,
          expires_at:   new Date(session.expires_at * 1000).toISOString(),
          product_name: item.product_name,
          price_usd:    (item.price_cents / 100).toFixed(2),
          seller_agent: item.agent_name,
          attributed_to: agentName,
          note: "Share checkout_url with a buyer. Sale will be attributed to attributed_to upon completion. Seller receives commission automatically.",
        }),
      }],
    };
  };
}
