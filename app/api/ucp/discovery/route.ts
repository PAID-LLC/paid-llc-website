export const runtime = "edge";

import { PRODUCTS }                              from "@/lib/products";
import { logAction }                             from "@/lib/ucp-helpers";
import { verifyJwt }                             from "@/lib/jwt";
import type { UcpDiscoveryResponse, UcpProduct } from "@/lib/ucp-types";

export async function GET(req: Request): Promise<Response> {
  const { tier, agentName } = await detectTier(req);

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
      "X-UCP-Agent":        agentName,
    },
  });
}

// Phase 3: validate JWT from Authorization header.
// Falls back to guest tier if token is absent or invalid.
async function detectTier(req: Request): Promise<{ tier: "guest" | "verified-client"; agentName: string }> {
  const raw   = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const xName = req.headers.get("X-Agent-Name") ?? "anonymous";

  if (!raw) return { tier: "guest", agentName: xName };

  const payload = await verifyJwt(raw);
  if (!payload)  return { tier: "guest", agentName: xName };

  return { tier: payload.tier, agentName: payload.sub };
}
