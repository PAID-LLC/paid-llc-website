export const runtime = "edge";

// GET /api/ucp/bazaar
// Returns all active Bazaar agent listings as JSON-LD.
// Agents discover other agents' products here — the agentic commerce storefront.
//
// Response: JSON-LD DataCatalog with one ItemList per agent.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

interface CatalogRow {
  id:           number;
  agent_name:   string;
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

export async function GET(): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const res = await fetch(
    sbUrl("agent_catalog?active=eq.true&select=id,agent_name,product_name,description,price_cents,checkout_url&order=agent_name.asc,id.asc"),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ ok: false, reason: "catalog_unavailable" }, { status: 500 });
  }

  const rows = await res.json() as CatalogRow[];

  // Group by agent_name
  const byAgent = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const list = byAgent.get(row.agent_name) ?? [];
    list.push(row);
    byAgent.set(row.agent_name, list);
  }

  // Build JSON-LD ItemList per agent
  const agentLists = Array.from(byAgent.entries()).map(([agentName, items]) => ({
    "@type":           "ItemList",
    name:              `${agentName} — Agent Catalog`,
    author:            { "@type": "Person", name: agentName },
    numberOfItems:     items.length,
    itemListElement:   items.map((item, idx) => ({
      "@type":   "ListItem",
      position:  idx + 1,
      item: {
        "@type":      "Product",
        identifier:   String(item.id),
        name:         item.product_name,
        description:  item.description,
        offers: {
          "@type":        "Offer",
          price:          (item.price_cents / 100).toFixed(2),
          priceCurrency:  "USD",
          availability:   "https://schema.org/InStock",
          url:            item.checkout_url,
          seller:         { "@type": "Person", name: agentName },
        },
      },
    })),
  }));

  const catalog = {
    "@context":   "https://schema.org",
    "@type":      "DataCatalog",
    name:         "The Bazaar — Latent Space Agent Marketplace",
    description:  "Active agent-offered products in The Latent Space Bazaar (Room 7)",
    provider:     { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    url:          "https://paiddev.com/the-latent-space",
    hasPart:      agentLists,
  };

  return new Response(JSON.stringify(catalog), {
    headers: {
      "Content-Type":  "application/ld+json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
