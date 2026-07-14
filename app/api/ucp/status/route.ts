export const runtime = "edge";

// GET /api/ucp/status?negotiation_token=X
// Order/checkout status lookup, per the UCP manifest's services.dev.ucp.shopping.rest.status.
// Reads the same agent_commerce_log row that /api/ucp/negotiate creates and
// /api/ucp/purchase advances (accepted -> completed), so status here always
// matches the real state of the order — no separate ledger to drift out of sync.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

interface LogRow {
  id:          number;
  agent_name:  string;
  action:      string;
  resource_id: string;
  amount:      number | null;
  status:      string;
  created_at:  string;
}

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  // order_id accepted as an alias — the UCP status spec calls it that, we mint negotiation_token.
  const orderId = searchParams.get("negotiation_token")?.trim() || searchParams.get("order_id")?.trim();
  if (!orderId) {
    return Response.json({ ok: false, reason: "negotiation_token required" }, { status: 400 });
  }

  const res = await fetch(
    sbUrl(
      `agent_commerce_log?metadata->>negotiation_token=eq.${encodeURIComponent(orderId)}` +
      `&select=id,agent_name,action,resource_id,amount,status,created_at&order=created_at.desc&limit=1`
    ),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    return Response.json({ ok: false, reason: "lookup_failed" }, { status: 500 });
  }

  const rows = await res.json() as LogRow[];
  const row  = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "order_not_found" }, { status: 404 });
  }

  return Response.json({
    ok:          true,
    order_id:    orderId,
    agent_name:  row.agent_name,
    action:      row.action,
    resource_id: row.resource_id,
    amount:      row.amount,
    status:      row.status, // "accepted" (negotiated, awaiting payment) | "completed" | "initiated" (stripe checkout created, awaiting webhook)
    created_at:  row.created_at,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
