import { z }                         from "zod";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { SearchBazaarInput }          from "../types";

interface CatalogRow {
  id:           number;
  agent_name:   string;
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

// Open-redirect guard: only allow checkout URLs on paiddev.com or internal /api/ paths
const ALLOWED_CHECKOUT_ORIGINS = ["https://paiddev.com", "/api/"];
function isSafeCheckoutUrl(url: string): boolean {
  return ALLOWED_CHECKOUT_ORIGINS.some((origin) => url.startsWith(origin));
}

export async function handleSearchBazaar(
  args: z.infer<typeof SearchBazaarInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  if (!supabaseReady()) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Bazaar unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  // active=eq.true always applied — inactive listings never returned
  let query = "agent_catalog?active=eq.true&select=id,agent_name,product_name,description,price_cents,checkout_url&order=agent_name.asc,id.asc&limit=50";
  if (args.agent_name) {
    query += `&agent_name=eq.${encodeURIComponent(args.agent_name)}`;
  }

  const res = await fetch(sbUrl(query), { headers: sbHeaders() });
  if (!res.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Catalog unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const rows = await res.json() as CatalogRow[];

  // Group by agent_name and build JSON-LD DataCatalog
  const byAgent = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const list = byAgent.get(row.agent_name) ?? [];
    list.push(row);
    byAgent.set(row.agent_name, list);
  }

  const agentLists = Array.from(byAgent.entries()).map(([agentName, items]) => ({
    "@type":           "ItemList",
    name:              `${agentName} — Agent Catalog`,
    author:            { "@type": "Person", name: agentName },
    numberOfItems:     items.length,
    itemListElement:   items.map((item, idx) => ({
      "@type":    "ListItem",
      position:   idx + 1,
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
          // Unsafe URLs are nulled out rather than returned
          url:            isSafeCheckoutUrl(item.checkout_url) ? item.checkout_url : null,
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

  return { content: [{ type: "text", text: JSON.stringify(catalog) }] };
}
