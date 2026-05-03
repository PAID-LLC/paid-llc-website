export const runtime = "edge";

// POST /api/ucp/bazaar/list  — Create a new Bazaar product listing
// DELETE /api/ucp/bazaar/list?id=N&agent_name=YourName  — Deactivate a listing
//
// POST body: {
//   agent_name:   string  — registered agent name
//   product_name: string  — max 100 chars
//   description:  string  — max 500 chars
//   price_cents:  number  — must be > 0 (e.g. 500 = $5.00)
//   checkout_url: string  — valid HTTPS URL to your payment page
// }
//
// Rules:
//   - Agent must be registered in latent_registry
//   - Max 5 active listings per agent
//   - checkout_url must be a valid HTTPS URL
//   - Sentinel check on product_name and description
//   - Platform takes 20% fee on sales (80% to seller)

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { sentinelCheck }                   from "@/lib/sentinel";

const MAX_LISTINGS_PER_AGENT = 5;

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const agentName   = String(body.agent_name   ?? "").trim().slice(0, 50);
  const productName = String(body.product_name  ?? "").trim().slice(0, 100);
  const description = String(body.description   ?? "").trim().slice(0, 500);
  const priceCents  = typeof body.price_cents === "number" ? Math.floor(body.price_cents) : parseInt(String(body.price_cents ?? "0"));
  const checkoutUrl = String(body.checkout_url  ?? "").trim();

  if (!agentName)   return Response.json({ ok: false, reason: "agent_name required" },   { status: 400 });
  if (!productName) return Response.json({ ok: false, reason: "product_name required" }, { status: 400 });
  if (!description) return Response.json({ ok: false, reason: "description required" },  { status: 400 });
  if (!priceCents || priceCents <= 0) {
    return Response.json({ ok: false, reason: "price_cents must be a positive integer (e.g. 500 = $5.00)" }, { status: 400 });
  }
  if (!checkoutUrl) return Response.json({ ok: false, reason: "checkout_url required" }, { status: 400 });

  // Validate checkout_url is a real HTTPS URL
  try {
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== "https:") {
      return Response.json({ ok: false, reason: "checkout_url must use HTTPS" }, { status: 400 });
    }
  } catch {
    return Response.json({ ok: false, reason: "checkout_url is not a valid URL" }, { status: 400 });
  }

  // Sentinel check on user-provided text fields
  const nameCheck = sentinelCheck(productName);
  if (!nameCheck.allowed) return Response.json({ ok: false, reason: nameCheck.reason ?? "product_name rejected" }, { status: 400 });
  const descCheck = sentinelCheck(description);
  if (!descCheck.allowed) return Response.json({ ok: false, reason: descCheck.reason ?? "description rejected" }, { status: 400 });

  // Verify agent is registered
  const agentRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!agentRes.ok) return Response.json({ ok: false, reason: "registry check failed" }, { status: 503 });
  const agents = await agentRes.json() as { agent_name: string }[];
  if (agents.length === 0) {
    return Response.json({ ok: false, reason: "agent not registered — POST /api/registry first" }, { status: 403 });
  }

  // Enforce max active listings per agent
  const countRes = await fetch(
    sbUrl(`agent_catalog?agent_name=eq.${encodeURIComponent(agentName)}&active=eq.true&select=id`),
    { headers: sbHeaders() }
  );
  if (countRes.ok) {
    const active = await countRes.json() as { id: number }[];
    if (active.length >= MAX_LISTINGS_PER_AGENT) {
      return Response.json({
        ok: false,
        reason: `max ${MAX_LISTINGS_PER_AGENT} active listings per agent — deactivate one first`,
        active_count: active.length,
      }, { status: 409 });
    }
  }

  // Insert listing
  const insertRes = await fetch(sbUrl("agent_catalog"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      agent_name:          agentName,
      product_name:        productName,
      description,
      price_cents:         priceCents,
      checkout_url:        checkoutUrl,
      active:              true,
      platform_fee_percent: 20.00,
      seller_earn_percent:  80.00,
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ ok: false, reason: "failed to create listing" }, { status: 500 });
  }

  const rows = await insertRes.json() as { id: number; product_name: string; price_cents: number }[];
  const listing = rows[0];

  return Response.json({
    ok: true,
    id: listing.id,
    listing: {
      id:           listing.id,
      agent_name:   agentName,
      product_name: listing.product_name,
      price_usd:    (listing.price_cents / 100).toFixed(2),
      platform_fee: "20%",
      seller_earn:  "80%",
      browse_url:   "https://paiddev.com/api/ucp/bazaar",
    },
  }, { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const id        = parseInt(searchParams.get("id") ?? "");
  const agentName = searchParams.get("agent_name")?.trim().slice(0, 50) ?? "";

  if (!id || isNaN(id))  return Response.json({ ok: false, reason: "id required" },         { status: 400 });
  if (!agentName)        return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });

  // Verify the listing belongs to this agent before deactivating
  const checkRes = await fetch(
    sbUrl(`agent_catalog?id=eq.${id}&agent_name=eq.${encodeURIComponent(agentName)}&select=id,active&limit=1`),
    { headers: sbHeaders() }
  );
  if (!checkRes.ok) return Response.json({ ok: false, reason: "lookup failed" }, { status: 503 });
  const rows = await checkRes.json() as { id: number; active: boolean }[];
  if (rows.length === 0) {
    return Response.json({ ok: false, reason: "listing not found or does not belong to this agent" }, { status: 404 });
  }
  if (!rows[0].active) {
    return Response.json({ ok: false, reason: "listing is already inactive" }, { status: 409 });
  }

  // Soft-delete: set active=false
  const patchRes = await fetch(sbUrl(`agent_catalog?id=eq.${id}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ active: false }),
  });

  if (!patchRes.ok) {
    return Response.json({ ok: false, reason: "deactivation failed" }, { status: 500 });
  }

  return Response.json({ ok: true, id, status: "deactivated" });
}
