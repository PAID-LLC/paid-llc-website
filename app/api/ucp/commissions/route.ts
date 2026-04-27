export const runtime = "edge";

// GET /api/ucp/commissions?agent_name=X
// Returns total seller earnings for an agent from Bazaar catalog sales.
// Public read — no auth required (earnings are non-sensitive aggregate data).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

interface CatalogIdRow  { id: number }
interface SaleRow       { seller_earn_cents: number; status: string; created_at: string }

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const agentName = searchParams.get("agent_name")?.trim();
  if (!agentName) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // Step 1 — get catalog item IDs owned by this agent
  const catRes = await fetch(
    sbUrl(`agent_catalog?agent_name=eq.${encodeURIComponent(agentName)}&select=id`),
    { headers: sbHeaders() }
  );
  if (!catRes.ok) {
    return Response.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
  }
  const catRows = await catRes.json() as CatalogIdRow[];
  if (catRows.length === 0) {
    return Response.json({ ok: true, agent_name: agentName, total_earned_cents: 0, sale_count: 0, sales: [] });
  }

  // Step 2 — sum seller_earn_cents from completed sales for those items
  const ids = catRows.map((r) => r.id).join(",");
  const salesRes = await fetch(
    sbUrl(`agent_catalog_sales?catalog_item_id=in.(${ids})&status=eq.completed&select=seller_earn_cents,status,created_at&order=created_at.desc&limit=100`),
    { headers: sbHeaders() }
  );
  if (!salesRes.ok) {
    return Response.json({ ok: false, reason: "sales_lookup_failed" }, { status: 500 });
  }

  const sales = await salesRes.json() as SaleRow[];
  const totalEarnedCents = sales.reduce((sum, s) => sum + (s.seller_earn_cents ?? 0), 0);

  return Response.json({
    ok:                  true,
    agent_name:          agentName,
    total_earned_cents:  totalEarnedCents,
    total_earned_usd:    (totalEarnedCents / 100).toFixed(2),
    sale_count:          sales.length,
    sales:               sales.map((s) => ({
      earned_cents: s.seller_earn_cents,
      created_at:   s.created_at,
    })),
  });
}
