export const runtime = "edge";

// POST /api/acp/checkout_sessions/{id}/complete — NOT real delegated-payment
// processing (no PSP partnership for that). Returns a spec-shaped rejection
// pointing back at the session's hosted checkout link, so a real ACP client
// gets a coherent answer using the RFC's own messages/resolution vocabulary
// instead of a bare 404 or a silent fake success. See the spec for why.

import { fetchAcpSession } from "@/lib/acp-checkout";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const row = await fetchAcpSession(id);
  if (!row) return Response.json({ error: "not_found", error_description: "Unknown checkout session." }, { status: 404 });

  const checkoutUrl = row.metadata?.checkout_url;

  return Response.json(
    {
      id,
      status: row.status === "completed" ? "completed" : "ready_for_payment",
      messages: [
        {
          type:         "error",
          code:         "delegate_payment_unsupported",
          content_type: "plain",
          content:
            "This seller does not support delegated payment. Complete payment at the checkout URL " +
            "in this session's links array" + (checkoutUrl ? `: ${checkoutUrl}` : "."),
          resolution: "requires_buyer_input",
        },
      ],
    },
    { status: 400 },
  );
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
