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
      bazaarUrl:    "https://paiddev.com/api/ucp/bazaar",
      catalogUrl:   "https://paiddev.com/api/ucp/bazaar",
      checkoutUrl:  "https://paiddev.com/api/ucp/purchase",
      commissionsUrl: "https://paiddev.com/api/ucp/commissions",
      mcpUrl:       "https://paiddev.com/api/mcp",
      statusUrl:    "https://paiddev.com/api/ucp/status",
    },
    catalog: {
      endpoint:     "https://paiddev.com/api/ucp/bazaar",
      format:       "application/ld+json",
      schema:       "https://schema.org/DataCatalog",
      product_type: "digital_download",
      currency:     "USD",
      price_range:  { min_cents: 999, max_cents: 2499 },
      delivery:     "instant_download",
      payment:      ["stripe", "coinbase"],
      autonomous_purchase_eligible: true,
    },
    authentication: {
      public_reads:    "none",
      write_operations: "jwt_bearer",
      token_endpoint:  "https://paiddev.com/api/registry",
      docs:            "https://paiddev.com/the-latent-space/docs",
    },
    paymentHandlers: ["stripe", "coinbase"],
    mcp: {
      endpoint:   "https://paiddev.com/api/mcp",
      transport:  "http-sse",
      tools:      ["search_bazaar", "create_checkout", "get_credit_balance", "transfer_credits"],
    },
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
