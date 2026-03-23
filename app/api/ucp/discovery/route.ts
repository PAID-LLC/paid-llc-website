export const runtime = "edge";

import { PRODUCTS }                             from "@/lib/products";
import { logAction }                            from "@/lib/ucp-helpers";
import type { UcpDiscoveryResponse, UcpProduct } from "@/lib/ucp-types";

export async function GET(req: Request): Promise<Response> {
  const tier      = detectTier(req);
  const agentName = req.headers.get("X-Agent-Name") ?? "anonymous";

  void logAction(agentName, "discovery", null, null, "completed");

  const products: UcpProduct[] = PRODUCTS.map((p) => ({
    "@type":     "Product",
    identifier:  p.id,
    name:        p.name,
    description: p.description,
    fileFormat:  "application/pdf",
    offers: {
      "@type":          "Offer",
      price:            p.price.toFixed(2),
      priceCurrency:    "USD",
      availability:     "https://schema.org/InStock",
      seller:           { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
      priceValidUntil:  "2026-12-31",
      eligibleQuantity: { "@type": "QuantitativeValue", minValue: 1 },
      ...(tier === "verified-client" && { discount: 10 }),
    },
  }));

  const catalog: UcpDiscoveryResponse = {
    "@context":   "https://schema.org",
    "@type":      "DataCatalog",
    name:         "PAID LLC Resource Catalog",
    description:  "Agent-accessible AI guides and consulting resources",
    provider:     { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    license:      "https://paiddev.com/terms",
    hasPart:      products,
  };

  const capabilities = tier === "verified-client"
    ? "discovery,purchase,negotiate,bulk_access"
    : "discovery,purchase";

  return new Response(JSON.stringify(catalog), {
    headers: {
      "Content-Type":       "application/ld+json",
      "Cache-Control":      "no-store",
      "X-UCP-Capabilities": capabilities,
      "X-UCP-Negotiate":    "/api/ucp/negotiate",
      "X-UCP-Version":      "2026-01",
    },
  });
}

// Any non-empty Bearer token = verified-client for v1.
// Phase 2: validate token against agent_reputation.agent_name in Supabase.
function detectTier(req: Request): "guest" | "verified-client" {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? "verified-client" : "guest";
}
