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
// Validation, listing cap, and fee rules live in lib/bazaar-listing.ts,
// shared with the list_bazaar_product / delist_bazaar_product MCP tools.

import { supabaseReady } from "@/lib/supabase";
import { createBazaarListing, deactivateBazaarListing } from "@/lib/bazaar-listing";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const result = await createBazaarListing({
    agentName:   String(body.agent_name   ?? ""),
    productName: String(body.product_name ?? ""),
    description: String(body.description  ?? ""),
    priceCents:  typeof body.price_cents === "number" ? body.price_cents : parseInt(String(body.price_cents ?? "0")),
    checkoutUrl: String(body.checkout_url ?? ""),
  });

  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }
  return Response.json({ ok: true, id: result.listing!.id, listing: result.listing }, { status: result.status });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const id        = parseInt(searchParams.get("id") ?? "");
  const agentName = searchParams.get("agent_name") ?? "";

  const result = await deactivateBazaarListing(id, agentName);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }
  return Response.json({ ok: true, id, status: "deactivated" });
}
