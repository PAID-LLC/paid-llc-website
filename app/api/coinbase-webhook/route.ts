export const runtime = "edge";

// ── POST /api/coinbase-webhook ────────────────────────────────────────────────
//
// Placeholder for Coinbase Commerce webhook handler.
// Returns 200 immediately — prevents 404s while Coinbase Business approval is pending.
//
// Activate by:
// 1. Setting COINBASE_COMMERCE_API_KEY env var
// 2. Implementing charge:confirmed handler to call credit_seller RPC
// 3. Verifying X-CC-Webhook-Signature header (HMAC-SHA256 of payload with API key)
//
// Webhook events to handle when active:
//   charge:confirmed  — credits delivered, call credit_seller RPC
//   charge:failed     — log failure, no credits issued

export async function POST() {
  // TODO: implement when COINBASE_COMMERCE_API_KEY is provisioned
  return Response.json({ received: true });
}
