export const runtime = "edge";

// ── GET /api — x402 discovery index ─────────────────────────────────────────
//
// x402 clients and agent-readiness scanners probe /api expecting HTTP 402
// with a spec-shape `accepts` challenge; without it the payment rail is
// invisible even though every credit-gated endpoint on the platform already
// answers 402 with these headers. Nothing free is served at this path (real
// endpoints live deeper, robots.txt disallows /api/), so a permanent 402
// here is honest: it advertises HOW to pay, and the body points agents at
// the docs and OpenAPI spec for WHERE to spend.

import { creditPaymentPayload, x402Headers } from "@/lib/x402";

const INDEX_CREDITS = 100; // $1 entry — the smallest useful top-up

export async function GET() {
  const payload = creditPaymentPayload(INDEX_CREDITS);
  const body = {
    error:
      "Payment required. This is the x402 discovery index for paiddev.com — " +
      "no free resource is served at /api. Paid endpoints and pricing are in " +
      "the OpenAPI spec (operations carry x-payment-info).",
    ...payload,
    docs:    "https://paiddev.com/the-latent-space/docs",
    openapi: "https://paiddev.com/openapi.json",
    auth:    "https://paiddev.com/auth.md",
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 402,
    headers: {
      "Content-Type":                "application/json",
      "Cache-Control":               "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options":      "nosniff",
      ...x402Headers(JSON.stringify(payload)),
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Max-Age":       "86400",
    },
  });
}
