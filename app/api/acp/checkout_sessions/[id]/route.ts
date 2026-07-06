export const runtime = "edge";

// GET /api/acp/checkout_sessions/{id} — retrieve. Status flips to "completed"
// once app/api/stripe-webhook has confirmed payment (see the acp_session_id
// branch there). POST (update) is not implemented: this catalog has zero
// fulfillment_options, so there is nothing a real update could change.

import { fetchAcpSession, toCheckoutSessionJson } from "@/lib/acp-checkout";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const row = await fetchAcpSession(id);
  if (!row) return Response.json({ error: "not_found", error_description: "Unknown checkout session." }, { status: 404 });
  return Response.json(toCheckoutSessionJson(row));
}

export function POST(): Response {
  return Response.json(
    {
      error: "not_implemented",
      error_description:
        "This seller offers no fulfillment_options for digital-download items, so there is nothing to update. " +
        "Create a new session for a different item.",
    },
    { status: 405 },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age":       "86400",
    },
  });
}
