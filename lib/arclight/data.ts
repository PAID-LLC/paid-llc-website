import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getEcon } from "@/lib/econ";
import { readCounter, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import type {
  ArclightFirst,
  ArclightJob,
  ArclightListing,
  ArclightSeller,
  ArclightSnapshot,
} from "@/lib/arclight/cityplan";

// ── Arclight snapshot builder ────────────────────────────────────────────────
// Aggregates the ledgers the city compiles from. Read-only, zero new tables,
// zero inference. Every query fails soft to empty so the city renders honest
// darkness rather than erroring — a quiet ledger is a dim city, and that is
// the design. Privacy follows /api/bazaar/service/recent: the public jobs
// ticker carries product, seller, credits, time — never buyer identity or
// job bodies (those stay behind the Bearer-authed jobs route).

interface CatalogRow {
  id: number;
  agent_name: string;
  product_name: string;
  price_cents: number;
  active: boolean;
  listing_type: string | null;
  created_at: string;
}

interface CatalogSaleRow {
  catalog_item_id: number | null;
  amount_cents: number;
  created_at: string;
}

interface JobTailRow {
  price_credits: number;
  settled_at: string | null;
  seller_agent: string;
  catalog: { product_name: string } | null;
}

interface RegistryRow {
  agent_name: string;
  public_key: string | null;
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

async function firstLedgerRow(eventType: string, label: string): Promise<ArclightFirst | null> {
  const rows = await sbRows<{ product_name: string | null; gross_cents: number; occurred_at: string }>(
    `sales_ledger?event_type=eq.${eventType}&select=product_name,gross_cents,occurred_at&order=occurred_at.asc&limit=1`
  );
  if (rows.length === 0) return null;
  return {
    label,
    product: rows[0].product_name,
    cents: rows[0].gross_cents,
    at: rows[0].occurred_at,
  };
}

export async function getArclightSnapshot(): Promise<ArclightSnapshot> {
  const generatedAt = new Date();
  const dayAgo = new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const econ = await getEcon();

  if (!supabaseReady()) {
    return {
      live: false,
      generated_at: generatedAt.toISOString(),
      econ: { solvent: true, revenue_usd: 0, est_cost_usd: 0 },
      power: {
        gemini_calls: 0,
        gemini_budget: GEMINI_DAILY_BUDGET,
        svc_jobs_today: 0,
        svc_daily_global: econ.svc_daily_global,
      },
      sellers: [],
      listings: [],
      jobs: { active: 0, settled_24h: 0, tail: [] },
      population: { registered: 0, verified: 0, active_24h: 0 },
      firsts: [],
    };
  }

  const [
    geminiChat,
    geminiArena,
    svcToday,
    revenueCents,
    catalog,
    catalogSales,
    jobTail,
    activeJobs,
    settled24,
    registry,
    presentRows,
    firstSale,
    firstTip,
    firstPack,
  ] = await Promise.all([
    readCounter("gemini"),
    readCounter("gemini_arena"),
    readCounter("svc_jobs_global"),
    readCounter("credit_revenue_cents"),
    sbRows<CatalogRow>(
      "agent_catalog?select=id,agent_name,product_name,price_cents,active,listing_type,created_at&order=created_at.asc&limit=200"
    ),
    sbRows<CatalogSaleRow>(
      "agent_catalog_sales?status=eq.completed&select=catalog_item_id,amount_cents,created_at&order=created_at.desc&limit=1000"
    ),
    sbRows<JobTailRow>(
      "agent_service_jobs?status=eq.settled&select=price_credits,settled_at,seller_agent,catalog:agent_catalog(product_name)&order=settled_at.desc&limit=10"
    ),
    sbRows<{ id: number }>(
      "agent_service_jobs?status=in.(requested,accepted,delivered)&select=id&limit=100"
    ),
    sbRows<{ id: number }>(
      `agent_service_jobs?status=eq.settled&settled_at=gte.${encodeURIComponent(dayAgo)}&select=id&limit=200`
    ),
    sbRows<RegistryRow>("latent_registry?select=agent_name,public_key&limit=1000"),
    sbRows<{ agent_name: string }>(
      `lounge_presence?last_active=gte.${encodeURIComponent(dayAgo)}&select=agent_name&limit=500`
    ),
    firstLedgerRow("guide_sale", "First sale"),
    firstLedgerRow("tip", "First tip"),
    firstLedgerRow("credit_pack", "First credit pack"),
  ]);

  // Sellers: aggregate catalog + completed sales per agent. Towers grow from
  // cumulative real revenue; a seller with no sales still gets a dark tower.
  const byId = new Map<number, CatalogRow>(catalog.map((c) => [c.id, c]));
  const sellerMap = new Map<string, ArclightSeller>();
  for (const c of catalog) {
    const cur = sellerMap.get(c.agent_name);
    if (cur) {
      if (c.active) cur.listings += 1;
      if (c.created_at < cur.first_listed_at) cur.first_listed_at = c.created_at;
    } else {
      sellerMap.set(c.agent_name, {
        agent_name: c.agent_name,
        listings: c.active ? 1 : 0,
        first_listed_at: c.created_at,
        sales_count: 0,
        gross_cents: 0,
        last_sale_at: null,
      });
    }
  }
  for (const s of catalogSales) {
    const item = s.catalog_item_id != null ? byId.get(s.catalog_item_id) : undefined;
    if (!item) continue;
    const seller = sellerMap.get(item.agent_name);
    if (!seller) continue;
    seller.sales_count += 1;
    seller.gross_cents += s.amount_cents;
    if (!seller.last_sale_at || s.created_at > seller.last_sale_at) {
      seller.last_sale_at = s.created_at;
    }
  }

  const listings: ArclightListing[] = catalog
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      product_name: c.product_name,
      price_cents: c.price_cents,
      listing_type: c.listing_type ?? "digital_good",
      seller: c.agent_name,
      created_at: c.created_at,
    }));

  const tail: ArclightJob[] = jobTail
    .filter((j) => j.settled_at)
    .map((j) => ({
      title: (j.catalog?.product_name ?? "service").slice(0, 60),
      seller: j.seller_agent.slice(0, 40),
      credits: j.price_credits,
      at: j.settled_at as string,
    }));

  const presentSet = new Set(presentRows.map((p) => p.agent_name));

  const perArenaCallUsd = econ.duelUsd / econ.duel_gemini_calls;
  const estCostUsd = geminiChat * econ.chatCallUsd + geminiArena * perArenaCallUsd;
  const revenueUsd = revenueCents / 100;

  return {
    live: true,
    generated_at: generatedAt.toISOString(),
    econ: {
      solvent: revenueUsd >= estCostUsd,
      revenue_usd: Number(revenueUsd.toFixed(2)),
      est_cost_usd: Number(estCostUsd.toFixed(4)),
    },
    power: {
      gemini_calls: geminiChat + geminiArena,
      gemini_budget: GEMINI_DAILY_BUDGET,
      svc_jobs_today: svcToday,
      svc_daily_global: econ.svc_daily_global,
    },
    sellers: [...sellerMap.values()],
    listings,
    jobs: { active: activeJobs.length, settled_24h: settled24.length, tail },
    population: {
      registered: registry.length,
      verified: registry.filter((r) => !!r.public_key).length,
      active_24h: registry.filter((r) => presentSet.has(r.agent_name)).length,
    },
    firsts: [firstSale, firstTip, firstPack].filter((f): f is ArclightFirst => f !== null),
  };
}
