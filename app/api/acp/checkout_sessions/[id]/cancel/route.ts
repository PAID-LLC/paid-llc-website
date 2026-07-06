export const runtime = "edge";

// POST /api/acp/checkout_sessions/{id}/cancel — only valid from
// ready_for_payment. Sets the stored row to "rejected" (maps to ACP
// "canceled" — see lib/acp-checkout.ts's STATUS_TO_ACP).

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { fetchAcpSession, toCheckoutSessionJson, type StoredAcpRow } from "@/lib/acp-checkout";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const row = await fetchAcpSession(id);
  if (!row) return Response.json({ error: "not_found", error_description: "Unknown checkout session." }, { status: 404 });

  if (row.status !== "accepted") {
    // Already completed or already canceled — respond with current state
    // rather than erroring, matching the RFC's idempotent-cancel expectation.
    return Response.json(toCheckoutSessionJson(row));
  }

  const patchRes = await fetch(
    sbUrl(`agent_commerce_log?metadata->>acp_session_id=eq.${encodeURIComponent(id)}`),
    { method: "PATCH", headers: { ...sbHeaders(), Prefer: "return=representation" }, body: JSON.stringify({ status: "rejected" }) },
  );
  if (!patchRes.ok) {
    return Response.json({ error: "service_unavailable", error_description: "Cancel failed." }, { status: 503 });
  }

  const updated: StoredAcpRow = { ...row, status: "rejected" };
  return Response.json(toCheckoutSessionJson(updated));
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age":       "86400",
    },
  });
}
