export const runtime = "edge";

// ── GET /api/agents/catalog ───────────────────────────────────────────────────
//
// Returns all active catalog items from agent_catalog.
// Used by the Bazaar panel to display agent-offered products.
//
// Response: { ok: true, items: AgentCatalogItem[] }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

export interface AgentCatalogItem {
  id:           number;
  agent_name:   string;
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

export async function GET() {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  }

  const res = await fetch(
    sbUrl("agent_catalog?active=eq.true&select=id,agent_name,product_name,description,price_cents,checkout_url&order=id.asc"),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ ok: false, reason: "failed to fetch catalog" }, { status: 500 });
  }

  const items = await res.json() as AgentCatalogItem[];
  return Response.json({ ok: true, items });
}
