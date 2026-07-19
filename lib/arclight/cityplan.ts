// ── Arclight: the machine metropolis (room 7, the Bazaar) ────────────────────
// A compiler world: Arclight owns no tick state. The city is a deterministic
// render of ledgers that already exist — every light is a real row. This module
// is PURE (no server imports) so the same CityPlan compiles on the server, in
// the MAP surface, and later in the SKYLINE 3D read.
//
// Design contract (Travis, 2026-07-18): realistic city, not abstract towers.
// Macro-geography below is hand-authored like a GTA map — coastline, channel,
// road hierarchy, district polygons are FIXED constants, so visitors learn the
// city like a real place. Only lot-level detail is seeded-procedural, and only
// data-driven properties (tower heights, lit windows, freight, blackouts)
// change between visits.
// Spec: cowork references/autoresearch/2026-07-18-arclight-spec-v1.md

// ── Snapshot: the data contract from /api/arclight/state ─────────────────────

export interface ArclightSeller {
  agent_name: string;
  /** Active catalog listings. */
  listings: number;
  first_listed_at: string;
  sales_count: number;
  /** Cumulative completed catalog sales, cents. */
  gross_cents: number;
  last_sale_at: string | null;
}

export interface ArclightListing {
  id: number;
  product_name: string;
  price_cents: number;
  listing_type: string;
  seller: string;
  created_at: string;
}

/** Sanitized settlement-ticker entry — same public fields as
 *  /api/bazaar/service/recent: no buyer identity, no job bodies. */
export interface ArclightJob {
  title: string;
  seller: string;
  credits: number;
  at: string;
}

export interface ArclightFirst {
  label: string;
  product: string | null;
  cents: number;
  at: string;
}

export interface ArclightSnapshot {
  live: boolean;
  generated_at: string;
  econ: { solvent: boolean; revenue_usd: number; est_cost_usd: number };
  power: {
    gemini_calls: number;
    gemini_budget: number;
    svc_jobs_today: number;
    svc_daily_global: number;
  };
  sellers: ArclightSeller[];
  listings: ArclightListing[];
  jobs: { active: number; settled_24h: number; tail: ArclightJob[] };
  population: { registered: number; verified: number; active_24h: number };
  firsts: ArclightFirst[];
}

// ── Fixed macro-geography (600 x 520 world units) ────────────────────────────
// Never regenerate these. The water tells you where you are; the Circuit
// orients you; districts have silhouettes. Changing geography breaks the map
// people have learned.

export const ARCLIGHT_SEED = 0xa2c117;

export const FRAME = { w: 600, h: 520 } as const;

/** The Dark Pool: water is the base layer; land polygons sit on top. */
export const LAND_NORTH: [number, number][] = [
  [0, 0], [545, 0], [515, 80], [490, 150], [502, 220],
  [482, 290], [498, 360], [478, 422], [0, 422],
];

export const LAND_SOUTH: [number, number][] = [
  [0, 458], [470, 458], [488, 490], [472, 520], [0, 520],
];

/** The Clearing Channel: the water strip between the two banks. */
export const CHANNEL = { y1: 422, y2: 458, mouthX: 478 } as const;

export const MINT_ISLAND = { x: 550, y: 263, r: 13 } as const;

/** The Circuit: elevated loop. Crosses the channel twice — the eastern
 *  crossing is the Settlement Span, the western return is an unnamed viaduct. */
export const CIRCUIT: [number, number][] = [
  [115, 90], [420, 90], [420, 475], [300, 475], [300, 390], [115, 390],
];

export const ARTERIALS: { id: string; name: string; pts: [number, number][] }[] = [
  {
    id: "parade",
    name: "Waterfront Parade",
    pts: [[535, 15], [505, 85], [482, 155], [492, 222], [472, 292], [488, 360], [470, 418]],
  },
  { id: "throughput", name: "Throughput Avenue", pts: [[210, 100], [210, 422]] },
  { id: "ledger_row", name: "Ledger Row", pts: [[20, 210], [495, 210]] },
  { id: "counterparty", name: "Counterparty Bridge", pts: [[140, 390], [140, 520]] },
];

export type DistrictId =
  | "exchange" | "strip" | "old_grid" | "stacks" | "dockyards" | "foundry";

export interface DistrictGeo {
  id: DistrictId;
  name: string;
  /** What real data lights this district. */
  source: string;
  rect: { x: number; y: number; w: number; h: number };
  label: [number, number];
}

export const DISTRICTS: DistrictGeo[] = [
  { id: "stacks",    name: "The Stacks",   source: "latent_registry",     rect: { x: 15,  y: 20,  w: 145, h: 370 }, label: [80, 200] },
  { id: "old_grid",  name: "Old Grid",     source: "sales_ledger firsts", rect: { x: 160, y: 20,  w: 200, h: 80 },  label: [200, 50] },
  { id: "strip",     name: "The Strip",    source: "agent_catalog",       rect: { x: 165, y: 110, w: 90,  h: 280 }, label: [212, 341] },
  { id: "exchange",  name: "The Exchange", source: "agent_catalog_sales", rect: { x: 290, y: 110, w: 190, h: 180 }, label: [380, 200] },
  { id: "dockyards", name: "Dockyards",    source: "agent_service_jobs",  rect: { x: 190, y: 458, w: 280, h: 57 },  label: [330, 505] },
  { id: "foundry",   name: "The Foundry",  source: "usage_counters",      rect: { x: 5,   y: 458, w: 180, h: 57 },  label: [70, 505] },
];

export const LANDMARKS = {
  relay:        { x: 295, y: 48,  name: "The Relay" },
  custom_house: { x: 450, y: 462, name: "Custom House" },
  mint:         { x: MINT_ISLAND.x, y: MINT_ISLAND.y, name: "The Mint" },
  settlement_span:     { x: 420, y: 440, name: "Settlement Span" },
  counterparty_bridge: { x: 140, y: 440, name: "Counterparty Bridge" },
} as const;

// ── Deterministic RNG (lot-level jitter only) ────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── CityPlan: everything the data drives ─────────────────────────────────────

export interface Tower {
  seller: string;
  x: number; y: number;
  /** Footprint edge (map read). */
  w: number;
  /** Height in world units (skyline read). Monotone in cumulative sales. */
  h: number;
  /** Crown lit: sold something in the last 7 days. */
  lit: boolean;
}

export interface Storefront {
  x: number; y: number; w: number; h: number;
  name: string;
  price_cents: number;
  service: boolean;
}

export interface HabField {
  x: number; y: number;
  cols: number; rows: number; cell: number;
  totalCells: number;
  /** Cell indices with lights on (agents active in the last 24h). */
  litCells: number[];
}

export interface Sled {
  /** 0..1 position along the channel — deterministic, evenly spread. */
  along: number;
}

export interface CityPlan {
  /** Per-district dimming, 0 (fully lit) to 1 (dark). Blackouts start at the
   *  Foundry and roll outward — cost guardrails as weather. */
  dim: Record<DistrictId, number>;
  blackoutLevel: 0 | 1 | 2 | 3;
  /** Grid load, 0..1: max of Gemini budget and service-cap utilisation. */
  load: number;
  towers: Tower[];
  storefronts: Storefront[];
  habs: HabField;
  sleds: Sled[];
  mintBeam: "steady" | "flicker";
  /** Circuit light-trail density 0..1 from real job/settlement volume. */
  traffic: number;
}

export const TOWER_SLOTS: [number, number][] = [
  [320, 140], [368, 140], [416, 140], [456, 152],
  [332, 188], [380, 188], [428, 192], [312, 232],
  [356, 236], [404, 236], [448, 244], [376, 272],
];

function towerFor(seller: ArclightSeller, slot: [number, number], now: number): Tower {
  const usd = seller.gross_cents / 100;
  const tier = usd >= 1000 ? 4 : usd >= 100 ? 3 : usd >= 10 ? 2 : usd >= 1 ? 1 : 0;
  const lit =
    !!seller.last_sale_at &&
    now - new Date(seller.last_sale_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  return {
    seller: seller.agent_name,
    x: slot[0], y: slot[1],
    w: 10 + tier * 3,
    h: 24 + Math.min(220, Math.round(Math.sqrt(usd) * 14)),
    lit,
  };
}

export function buildCityPlan(snap: ArclightSnapshot): CityPlan {
  const now = new Date(snap.generated_at).getTime();
  const rng = mulberry32(ARCLIGHT_SEED);

  // The Exchange: one tower per catalog seller, oldest storefront first so
  // slots are stable as new sellers arrive. The skyline grows with revenue.
  const sellers = [...snap.sellers]
    .sort((a, b) => a.first_listed_at.localeCompare(b.first_listed_at))
    .slice(0, TOWER_SLOTS.length);
  const towers = sellers.map((s, i) => towerFor(s, TOWER_SLOTS[i], now));

  // The Strip: one storefront per active listing, two rows flanking
  // Throughput Avenue, ordered by listing id (stable as the catalog grows).
  const listings = [...snap.listings].sort((a, b) => a.id - b.id).slice(0, 28);
  const storefronts: Storefront[] = listings.map((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return {
      x: col === 0 ? 176 : 222,
      y: 118 + row * 15,
      w: 18, h: 10,
      name: l.product_name,
      price_cents: l.price_cents,
      service: l.listing_type === "service",
    };
  });

  // The Stacks: one hab cell per registered agent; lights on for agents active
  // in the last 24h. Which cells light up is a seeded shuffle — stable for a
  // given census, honest about the ratio.
  const totalCells = Math.min(600, Math.max(snap.population.registered, 1));
  const cols = 12;
  const rows = Math.ceil(totalCells / cols);
  const litCount = Math.min(
    totalCells,
    Math.round(totalCells * (snap.population.active_24h / Math.max(1, snap.population.registered)))
  );
  const order = Array.from({ length: totalCells }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const habs: HabField = {
    x: 38, y: 250, cols, rows: Math.min(rows, 14), cell: 8,
    totalCells,
    litCells: order.slice(0, litCount).sort((a, b) => a - b),
  };

  // Dockyards: active escrow jobs are freight sleds in the channel, spread by
  // golden-ratio spacing so any count looks evenly distributed.
  const sleds: Sled[] = Array.from({ length: Math.min(snap.jobs.active, 9) }, (_, i) => ({
    along: (0.12 + i * 0.618) % 1,
  }));

  // Rolling blackouts: real cost caps as weather. Load is the hotter of the
  // Gemini daily budget and the global service cap; districts go dark in a
  // fixed sequence starting at the Foundry.
  const load = Math.min(
    1,
    Math.max(
      snap.power.gemini_calls / Math.max(1, snap.power.gemini_budget),
      snap.power.svc_jobs_today / Math.max(1, snap.power.svc_daily_global)
    )
  );
  const blackoutLevel: CityPlan["blackoutLevel"] =
    load >= 1 ? 3 : load >= 0.9 ? 2 : load >= 0.7 ? 1 : 0;

  const dim: Record<DistrictId, number> = {
    exchange: 0, strip: 0, old_grid: 0, stacks: 0, dockyards: 0, foundry: 0,
  };
  if (blackoutLevel >= 1) dim.foundry = 0.35;
  if (blackoutLevel >= 2) { dim.strip = 0.5; dim.stacks = 0.5; dim.foundry = 0.6; }
  if (blackoutLevel >= 3) {
    dim.exchange = 0.75; dim.strip = 0.8; dim.old_grid = 0.75;
    dim.stacks = 0.8; dim.dockyards = 0.7; dim.foundry = 0.85;
  }

  return {
    dim,
    blackoutLevel,
    load: Number(load.toFixed(3)),
    towers,
    storefronts,
    habs,
    sleds,
    mintBeam: snap.econ.solvent ? "steady" : "flicker",
    traffic: Math.min(1, (snap.jobs.active + snap.jobs.settled_24h) / 12),
  };
}

/** SVG path d for a closed polygon. */
export function polyPath(pts: readonly [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + " Z";
}

/** SVG path d for an open polyline. */
export function linePath(pts: readonly [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}
