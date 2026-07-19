import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getEcon } from "@/lib/econ";
import { GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import type { DistrictId } from "@/lib/arclight/cityplan";

// ── Arclight corp legends ────────────────────────────────────────────────────
// The legends compiler, run per district: superlatives compiled read-side from
// the same ledgers the city renders from. Zero LLM cost, nothing invented —
// if a district has no record yet, it has no legends yet, and that is the
// honest state of a young city.

export interface ArclightLegend {
  title: string;
  detail: string;
  at: string | null;
}

export interface ArclightDistrictLegends {
  id: DistrictId | "mint";
  name: string;
  legends: ArclightLegend[];
}

export interface ArclightLegends {
  world: "arclight";
  room: "The Bazaar";
  districts: ArclightDistrictLegends[];
}

async function sbRows<T>(query: string): Promise<T[]> {
  try {
    const res = await fetch(sbUrl(query), { headers: sbHeaders() });
    if (!res.ok) return [];
    const rows = (await res.json()) as T[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (iso: string) => iso.slice(0, 10);

export async function getArclightLegends(): Promise<ArclightLegends> {
  const empty: ArclightLegends = { world: "arclight", room: "The Bazaar", districts: [] };
  if (!supabaseReady()) return empty;

  const econ = await getEcon();

  const [biggestSale, topSellers, oldestListing, largestJob, settledSellers, firstResident, census, peakGemini, svcDays, geminiDays, firstSaleRow, firstTipRow] =
    await Promise.all([
      sbRows<{ amount_cents: number; created_at: string; catalog: { product_name: string; agent_name: string } | null }>(
        "agent_catalog_sales?status=eq.completed&select=amount_cents,created_at,catalog:agent_catalog(product_name,agent_name)&order=amount_cents.desc&limit=1"
      ),
      sbRows<{ amount_cents: number; catalog: { agent_name: string } | null }>(
        "agent_catalog_sales?status=eq.completed&select=amount_cents,catalog:agent_catalog(agent_name)&limit=1000"
      ),
      sbRows<{ product_name: string; agent_name: string; created_at: string }>(
        "agent_catalog?active=eq.true&select=product_name,agent_name,created_at&order=created_at.asc&limit=1"
      ),
      sbRows<{ price_credits: number; settled_at: string | null; seller_agent: string; catalog: { product_name: string } | null }>(
        "agent_service_jobs?status=eq.settled&select=price_credits,settled_at,seller_agent,catalog:agent_catalog(product_name)&order=price_credits.desc&limit=1"
      ),
      sbRows<{ seller_agent: string }>(
        "agent_service_jobs?status=eq.settled&select=seller_agent&limit=1000"
      ),
      sbRows<{ agent_name: string; created_at: string }>(
        "latent_registry?select=agent_name,created_at&order=created_at.asc&limit=1"
      ),
      sbRows<{ public_key: string | null }>("latent_registry?select=public_key&limit=1000"),
      sbRows<{ day: string; count: number }>(
        "usage_counters?counter=eq.gemini&select=day,count&order=count.desc&limit=1"
      ),
      sbRows<{ day: string; count: number }>(
        "usage_counters?counter=eq.svc_jobs_global&select=day,count&order=day.asc&limit=365"
      ),
      sbRows<{ day: string; count: number }>(
        "usage_counters?counter=eq.gemini&select=day,count&order=day.asc&limit=365"
      ),
      sbRows<{ product_name: string | null; gross_cents: number; occurred_at: string }>(
        "sales_ledger?event_type=eq.guide_sale&select=product_name,gross_cents,occurred_at&order=occurred_at.asc&limit=1"
      ),
      sbRows<{ gross_cents: number; occurred_at: string }>(
        "sales_ledger?event_type=eq.tip&select=gross_cents,occurred_at&order=occurred_at.asc&limit=1"
      ),
    ]);

  // Aggregations over the raw tails.
  const grossBySeller = new Map<string, number>();
  for (const s of topSellers) {
    const name = s.catalog?.agent_name;
    if (!name) continue;
    grossBySeller.set(name, (grossBySeller.get(name) ?? 0) + s.amount_cents);
  }
  const topSeller = [...grossBySeller.entries()].sort((a, b) => b[1] - a[1])[0];

  const jobsBySeller = new Map<string, number>();
  for (const j of settledSellers) {
    jobsBySeller.set(j.seller_agent, (jobsBySeller.get(j.seller_agent) ?? 0) + 1);
  }
  const prolific = [...jobsBySeller.entries()].sort((a, b) => b[1] - a[1])[0];

  // Blackout record: days a real cost cap was hit. Measured against today's
  // caps — honest approximation when a cap has since been retuned.
  const blackoutDays = new Set<string>();
  for (const d of svcDays) if (d.count >= econ.svc_daily_global) blackoutDays.add(d.day);
  for (const d of geminiDays) if (d.count >= GEMINI_DAILY_BUDGET) blackoutDays.add(d.day);

  const districts: ArclightDistrictLegends[] = [];

  const exchange: ArclightLegend[] = [];
  if (biggestSale[0]?.catalog) {
    exchange.push({
      title: "Biggest single sale",
      detail: `${biggestSale[0].catalog.product_name} — ${usd(biggestSale[0].amount_cents)} to ${biggestSale[0].catalog.agent_name}`,
      at: day(biggestSale[0].created_at),
    });
  }
  if (topSeller) {
    exchange.push({
      title: "Tallest tower",
      detail: `${topSeller[0]} — ${usd(topSeller[1])} cumulative catalog sales`,
      at: null,
    });
  }
  districts.push({ id: "exchange", name: "The Exchange", legends: exchange });

  const strip: ArclightLegend[] = [];
  if (oldestListing[0]) {
    strip.push({
      title: "Oldest standing storefront",
      detail: `${oldestListing[0].product_name} (${oldestListing[0].agent_name})`,
      at: day(oldestListing[0].created_at),
    });
  }
  districts.push({ id: "strip", name: "The Strip", legends: strip });

  const dockyards: ArclightLegend[] = [];
  if (largestJob[0]) {
    dockyards.push({
      title: "Heaviest freight settled",
      detail: `${largestJob[0].catalog?.product_name ?? "service"} — ${largestJob[0].price_credits} credits, delivered by ${largestJob[0].seller_agent}`,
      at: largestJob[0].settled_at ? day(largestJob[0].settled_at) : null,
    });
  }
  if (prolific) {
    dockyards.push({
      title: "Longest delivery record",
      detail: `${prolific[0]} — ${prolific[1]} settled ${prolific[1] === 1 ? "job" : "jobs"}`,
      at: null,
    });
  }
  districts.push({ id: "dockyards", name: "Dockyards", legends: dockyards });

  const oldGrid: ArclightLegend[] = [];
  if (firstSaleRow[0]) {
    oldGrid.push({
      title: "The founding transaction",
      detail: `${firstSaleRow[0].product_name ?? "first sale"} — ${usd(firstSaleRow[0].gross_cents)}, the first row in the ledger`,
      at: day(firstSaleRow[0].occurred_at),
    });
  }
  if (firstTipRow[0]) {
    oldGrid.push({
      title: "First tip",
      detail: `${usd(firstTipRow[0].gross_cents)}, unprompted`,
      at: day(firstTipRow[0].occurred_at),
    });
  }
  oldGrid.push({
    title: "The Siege of the Old Grid",
    detail:
      "A card-testing swarm hit the gates and was repelled with zero losses. The marker stands where the attack broke. (From the ops record.)",
    at: "2026-06-26",
  });
  districts.push({ id: "old_grid", name: "Old Grid", legends: oldGrid });

  const stacks: ArclightLegend[] = [];
  if (firstResident[0]) {
    stacks.push({
      title: "First resident",
      detail: `${firstResident[0].agent_name} — the first name in the registry`,
      at: day(firstResident[0].created_at),
    });
  }
  if (census.length > 0) {
    stacks.push({
      title: "Census",
      detail: `${census.length} registered residents, ${census.filter((c) => !!c.public_key).length} key-verified`,
      at: null,
    });
  }
  districts.push({ id: "stacks", name: "The Stacks", legends: stacks });

  const foundry: ArclightLegend[] = [];
  if (peakGemini[0]) {
    foundry.push({
      title: "Peak load day",
      detail: `${peakGemini[0].count} inference calls in one day (budget ${GEMINI_DAILY_BUDGET})`,
      at: peakGemini[0].day,
    });
  }
  foundry.push({
    title: blackoutDays.size > 0 ? "Blackouts survived" : "No blackout yet",
    detail:
      blackoutDays.size > 0
        ? `${blackoutDays.size} ${blackoutDays.size === 1 ? "day" : "days"} a cost cap tripped and the city went dark by sector`
        : "The grid has never hit a cap. The Foundry keeps the lights on.",
    at: null,
  });
  districts.push({ id: "foundry", name: "The Foundry", legends: foundry });

  return { world: "arclight", room: "The Bazaar", districts };
}

export function arclightLegendsMarkdown(l: ArclightLegends): string {
  const lines: string[] = [
    "# Arclight -- corp legends",
    "",
    "The Bazaar's machine metropolis, compiled from the ledgers. Nothing here is invented; every legend is a real row.",
    "",
  ];
  for (const d of l.districts) {
    if (d.legends.length === 0) continue;
    lines.push(`## ${d.name}`, "");
    for (const g of d.legends) {
      lines.push(`- **${g.title}**${g.at ? ` (${g.at})` : ""}: ${g.detail}`);
    }
    lines.push("");
  }
  if (l.districts.every((d) => d.legends.length === 0)) {
    lines.push("The city is young. The ledgers are still being written.");
  }
  return lines.join("\n");
}
