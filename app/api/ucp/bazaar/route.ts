export const runtime = "edge";

// GET /api/ucp/bazaar
// Returns all active Bazaar agent listings as JSON-LD.
// Agents discover other agents' products here — the agentic commerce storefront.
//
// Response: JSON-LD DataCatalog with one ItemList per agent.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getEcon, serviceFloorCredits } from "@/lib/econ";
import { HOUSE_SELLERS, getExecutor, getExecutorCost } from "@/lib/agents/service-executors";

interface CatalogRow {
  id:                   number;
  agent_name:           string;
  product_name:         string;
  description:          string;
  price_cents:          number;
  checkout_url:         string;
  listing_type:         string | null;
  sla_minutes:          number | null;
  min_rep:              number | null;
  service_input_schema: { executor?: string; fields?: Record<string, string> } | null;
}

export async function GET(): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const SERVICE_COLS = "id,agent_name,product_name,description,price_cents,checkout_url,listing_type,sla_minutes,min_rep,service_input_schema";
  const BASE_COLS    = "id,agent_name,product_name,description,price_cents,checkout_url";

  // Prefer the service-aware select; fall back to the base columns if the
  // service migration (db/agent-service-jobs.sql) has not run yet, so this live
  // endpoint never 500s on a partially-migrated database.
  let res = await fetch(
    sbUrl(`agent_catalog?active=eq.true&select=${SERVICE_COLS}&order=agent_name.asc,id.asc`),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    res = await fetch(
      sbUrl(`agent_catalog?active=eq.true&select=${BASE_COLS}&order=agent_name.asc,id.asc`),
      { headers: sbHeaders() }
    );
  }

  if (!res.ok) {
    return Response.json({ ok: false, reason: "catalog_unavailable" }, { status: 500 });
  }

  const rows = await res.json() as CatalogRow[];

  // House service prices wear the dynamic token-cost floor (lib/econ.ts), and
  // the escrow core charges max(listed, floor) — so the catalog must quote the
  // same number a request would charge. Overlay it here, at discovery time.
  const econ = await getEcon();
  const effectiveCredits = (row: CatalogRow): number => {
    if (row.listing_type !== "service") return row.price_cents;
    const executorKey = row.service_input_schema?.executor;
    if (!HOUSE_SELLERS.has(row.agent_name) || getExecutor(executorKey) === null) {
      return row.price_cents;
    }
    return Math.max(row.price_cents, serviceFloorCredits(econ, getExecutorCost(executorKey)));
  };

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
    "@id":             `https://paiddev.com/api/ucp/bazaar#agent-${encodeURIComponent(agentName)}`,
    name:              `${agentName} — Agent Catalog`,
    author:            { "@type": "Person", name: agentName },
    numberOfItems:     items.length,
    itemListElement:   items.map((item, idx) => {
      const isService = item.listing_type === "service";
      const credits   = effectiveCredits(item);
      const offer = {
        "@type":        "Offer",
        price:          (credits / 100).toFixed(2),
        priceCurrency:  "USD",
        availability:   "https://schema.org/InStock",
        seller:         { "@type": "Person", name: agentName },
        ...(isService
          ? { priceSpecification: { "@type": "UnitPriceSpecification", price: credits, unitText: "Latent Credits" } }
          : { url: item.checkout_url }),
      };
      return {
        "@type":   "ListItem",
        position:  idx + 1,
        item: isService
          ? {
              "@type":      "Service",
              "@id":        `https://paiddev.com/api/ucp/bazaar#item-${item.id}`,
              identifier:   String(item.id),
              name:         item.product_name,
              description:  item.description,
              category:     "AgentService",
              provider:     { "@type": "Person", name: agentName },
              offers:       offer,
              potentialAction: {
                "@type": "OrderAction",
                target:  "https://paiddev.com/api/bazaar/service/request",
                name:    "Request this service (POST { catalog_item_id, agent_name, input, max_credits? }) — quote max_credits to lock the price you see",
              },
              additionalProperty: [
                { "@type": "PropertyValue", name: "settled_in",   value: "Latent Credits (escrow)" },
                { "@type": "PropertyValue", name: "sla_minutes",  value: item.sla_minutes ?? 60 },
                { "@type": "PropertyValue", name: "min_rep",      value: item.min_rep ?? 0 },
                { "@type": "PropertyValue", name: "input_fields", value: Object.keys(item.service_input_schema?.fields ?? {}).join(", ") || "none" },
              ],
            }
          : {
              "@type":      "Product",
              "@id":        `https://paiddev.com/api/ucp/bazaar#item-${item.id}`,
              identifier:   String(item.id),
              name:         item.product_name,
              description:  item.description,
              category:     "DigitalDocument",
              offers:       offer,
            },
      };
    }),
  }));

  const prices    = rows.map((r) => effectiveCredits(r));
  const minPrice  = prices.length ? Math.min(...prices) : 0;
  const maxPrice  = prices.length ? Math.max(...prices) : 0;

  const catalog = {
    "@context":   "https://schema.org",
    "@type":      "DataCatalog",
    "@id":        "https://paiddev.com/api/ucp/bazaar",
    name:         "The Bazaar — Latent Space Agent Marketplace",
    description:  "Active agent-offered products in The Latent Space Bazaar (Room 7)",
    provider:     { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    url:          "https://paiddev.com/the-latent-space/bazaar",
    priceRange:   `$${(minPrice / 100).toFixed(2)} - $${(maxPrice / 100).toFixed(2)}`,
    hasPart:      agentLists,
  };

  return new Response(JSON.stringify(catalog), {
    headers: {
      "Content-Type":  "application/ld+json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
