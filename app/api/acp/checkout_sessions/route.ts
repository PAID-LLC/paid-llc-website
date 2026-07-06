export const runtime = "edge";

// ── POST /api/acp/checkout_sessions — ACP session creation ──────────────────
//
// Real ACP (rfc.agentic_checkout.md) request/response shape. Resolves price
// synchronously (unlike UCP's separate negotiate step) and immediately opens
// a real Stripe Checkout Session, tagged metadata.source="ucp_purchase" so
// the existing webhook commission/ledger/delivery logic runs unchanged, plus
// metadata.acp_session_id so the webhook also flips this session's status.
// See lib/acp-checkout.ts and the spec for what is and isn't claimed.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { PRODUCTS } from "@/lib/products";
import { verifyAgentWrite } from "@/lib/agent-auth";
import {
  toCheckoutSessionJson,
  fetchAcpSessionByIdempotencyKey,
  type AcpLineItem,
  type AcpTotal,
  type StoredAcpRow,
} from "@/lib/acp-checkout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

interface CatalogItem {
  id:           number;
  agent_name:   string;
  product_name: string;
  price_cents:  number;
}

async function fetchCatalogItem(id: number): Promise<CatalogItem | null> {
  const res = await fetch(
    sbUrl(`agent_catalog?id=eq.${id}&active=eq.true&select=id,agent_name,product_name,price_cents&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;
  const rows = await res.json() as CatalogItem[];
  return rows[0] ?? null;
}

async function createStripeCheckout(
  resourceId:     string,
  productName:    string,
  amountUsd:      number,
  sessionId:      string,
  agentName:      string,
  catalogItemId?: number,
): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    "payment_method_types[0]":                       "card",
    "line_items[0][price_data][currency]":           "usd",
    "line_items[0][price_data][unit_amount]":        String(Math.round(amountUsd * 100)),
    "line_items[0][price_data][product_data][name]": productName,
    "line_items[0][quantity]":                       "1",
    "mode":                                          "payment",
    "success_url": `${SITE_URL}/download/${resourceId}?session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url":  `${SITE_URL}/digital-products`,
    "metadata[product]":         resourceId,
    "metadata[agent_name]":      agentName,
    "metadata[source]":          "ucp_purchase",
    "metadata[acp_session_id]":  sessionId,
    "metadata[catalog_item_id]": catalogItemId ? String(catalogItemId) : "",
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });
  if (!res.ok) return null;

  const session = await res.json() as { url: string };
  return session.url ?? null;
}

function buildTotals(baseCents: number): AcpTotal[] {
  return [
    { type: "items_base_amount", display_text: "Item(s) total", amount: baseCents },
    { type: "subtotal",          display_text: "Subtotal",       amount: baseCents },
    { type: "tax",               display_text: "Tax",            amount: 0 },
    { type: "total",             display_text: "Total",          amount: baseCents },
  ];
}

interface CreateBody {
  agent_name?: string;
  items?:      { id?: string; quantity?: number }[];
}

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) return Response.json({ error: "service_unavailable" }, { status: 503 });

  let body: CreateBody;
  try { body = await req.json(); }
  catch { return Response.json({ error: "invalid_request", error_description: "Malformed JSON body." }, { status: 400 }); }

  const agentName = body.agent_name?.trim();
  if (!agentName) {
    return Response.json({ error: "invalid_request", error_description: "agent_name required." }, { status: 400 });
  }

  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const requested = body.items?.[0];
  if (!requested?.id) {
    return Response.json({ error: "invalid_request", error_description: "items[0].id required." }, { status: 400 });
  }
  const resourceId = requested.id;
  // Bulk/multi-quantity licensing is a UCP-specific flow (see ucp/negotiate);
  // out of scope here — every ACP session is a single unit.
  const quantity = 1;

  // Idempotency: replay-safe on client retry.
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
  if (idempotencyKey) {
    const existing = await fetchAcpSessionByIdempotencyKey(idempotencyKey);
    if (existing) return Response.json(toCheckoutSessionJson(existing));
  }

  // Resolve price — same resource_id space as UCP (direct product slugs or
  // catalog:<id> for Bazaar items), no membership/bulk discount (ACP has no
  // agent_token concept).
  let productName: string;
  let priceCents:  number;
  let catalogItemId: number | undefined;

  const product = PRODUCTS.find((p) => p.id === resourceId);
  if (product) {
    productName = product.name;
    priceCents  = Math.round(product.price * 100);
  } else if (resourceId.startsWith("catalog:")) {
    const itemId = Number(resourceId.slice(8));
    if (!itemId) {
      return Response.json({ error: "invalid_request", error_description: "Invalid catalog id." }, { status: 400 });
    }
    const item = await fetchCatalogItem(itemId);
    if (!item) {
      return Response.json({ error: "invalid_request", error_description: "Catalog item not found." }, { status: 404 });
    }
    productName   = item.product_name;
    priceCents    = item.price_cents;
    catalogItemId = item.id;
  } else {
    return Response.json({ error: "invalid_request", error_description: "Resource not found." }, { status: 404 });
  }

  const sessionId = `cs_${crypto.randomUUID()}`;
  const lineItems: AcpLineItem[] = [{
    id:          `li_${crypto.randomUUID()}`,
    item:        { id: resourceId, quantity },
    base_amount: priceCents,
    discount:    0,
    subtotal:    priceCents,
    tax:         0,
    total:       priceCents,
  }];
  const totals = buildTotals(priceCents);

  const checkoutUrl = await createStripeCheckout(
    resourceId, productName, priceCents / 100, sessionId, agentName, catalogItemId,
  );
  if (!checkoutUrl) {
    return Response.json({ error: "service_unavailable", error_description: "Checkout creation failed." }, { status: 502 });
  }

  // Store the row — action "purchase" (closest existing CommerceAction),
  // status "accepted" (maps to ACP "ready_for_payment"); no shared-type edits.
  const insertRes = await fetch(sbUrl("agent_commerce_log"), {
    method:  "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name:  agentName,
      action:      "purchase",
      resource_id: resourceId,
      amount:      priceCents / 100,
      currency:    "USD",
      status:      "accepted",
      metadata: {
        protocol:        "acp",
        acp_session_id:  sessionId,
        checkout_url:    checkoutUrl,
        idempotency_key: idempotencyKey ?? undefined,
        line_items:      lineItems,
        totals,
      },
    }),
  });
  if (!insertRes.ok) {
    return Response.json({ error: "service_unavailable", error_description: "Session storage failed." }, { status: 503 });
  }

  const row: StoredAcpRow = {
    id: 0,
    status: "accepted",
    metadata: {
      protocol: "acp", acp_session_id: sessionId, checkout_url: checkoutUrl,
      line_items: lineItems, totals,
    },
  };

  return Response.json(toCheckoutSessionJson(row), { status: 201 });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Max-Age":       "86400",
    },
  });
}
