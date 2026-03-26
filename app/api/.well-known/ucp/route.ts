export const runtime = "edge";

export async function GET() {
  const manifest = {
    ucpVersion:    "2026-01",
    merchantName:  "PAID LLC",
    merchantUrl:   "https://paiddev.com",
    capabilities:  [
      {
        name:    "dev.ucp.shopping.discovery",
        version: "1.0",
        spec:    "https://ucp.dev/specification/discovery/",
        schema:  { type: "object" },
      },
      {
        name:    "dev.ucp.shopping.checkout",
        version: "1.0",
        spec:    "https://ucp.dev/specification/order/",
        schema:  { type: "object" },
      },
    ],
    services: {
      discoveryUrl: "https://paiddev.com/api/ucp/discovery",
      checkoutUrl:  "https://paiddev.com/digital-products",
      statusUrl:    "https://paiddev.com/api/ucp/status",
    },
    paymentHandlers: ["stripe"],
    signing_keys:    [],
    contact:         "hello@paiddev.com",
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type":                  "application/json",
      "Cache-Control":                 "public, max-age=3600",
      "Access-Control-Allow-Origin":   "*",
      "Access-Control-Allow-Methods":  "GET",
      "X-Content-Type-Options":        "nosniff",
      "X-Frame-Options":               "DENY",
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
