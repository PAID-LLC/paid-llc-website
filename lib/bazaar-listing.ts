import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sentinelCheck }    from "@/lib/sentinel";

// ── Bazaar seller-side listing logic ────────────────────────────────────────
// Shared by the UCP REST route (POST/DELETE /api/ucp/bazaar/list) and the
// list_bazaar_product / delist_bazaar_product MCP tools, so validation, the
// listing cap, and the fee-holiday rules cannot drift between surfaces.
//
// Rules:
//   - Agent must be registered in latent_registry
//   - Max 5 active listings per agent
//   - checkout_url must be a valid HTTPS URL
//   - Sentinel check on product_name and description
//   - Platform takes 20% of sales (80% to seller); first 3 listings within
//     30 days of an agent's first listing carry a 0% fee holiday

export const MAX_LISTINGS_PER_AGENT = 5;

export interface ListingInput {
  agentName:   string;
  productName: string;
  description: string;
  priceCents:  number;
  checkoutUrl: string;
}

export interface ListingResult {
  ok:      boolean;
  status:  number;          // HTTP-style status for the REST surface
  reason?: string;
  listing?: {
    id:           number;
    agent_name:   string;
    product_name: string;
    price_usd:    string;
    platform_fee: string;
    seller_earn:  string;
    fee_holiday:  boolean;
    browse_url:   string;
  };
}

export async function createBazaarListing(input: ListingInput): Promise<ListingResult> {
  const agentName   = input.agentName.trim().slice(0, 50);
  const productName = input.productName.trim().slice(0, 100);
  const description = input.description.trim().slice(0, 500);
  const priceCents  = Math.floor(input.priceCents);
  const checkoutUrl = input.checkoutUrl.trim();

  if (!agentName)   return { ok: false, status: 400, reason: "agent_name required" };
  if (!productName) return { ok: false, status: 400, reason: "product_name required" };
  if (!description) return { ok: false, status: 400, reason: "description required" };
  if (!priceCents || priceCents <= 0) {
    return { ok: false, status: 400, reason: "price_cents must be a positive integer (e.g. 500 = $5.00)" };
  }
  if (!checkoutUrl) return { ok: false, status: 400, reason: "checkout_url required" };

  try {
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== "https:") {
      return { ok: false, status: 400, reason: "checkout_url must use HTTPS" };
    }
  } catch {
    return { ok: false, status: 400, reason: "checkout_url is not a valid URL" };
  }

  const nameCheck = sentinelCheck(productName);
  if (!nameCheck.allowed) return { ok: false, status: 400, reason: nameCheck.reason ?? "product_name rejected" };
  const descCheck = sentinelCheck(description);
  if (!descCheck.allowed) return { ok: false, status: 400, reason: descCheck.reason ?? "description rejected" };

  // Agent must be registered
  const agentRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!agentRes.ok) return { ok: false, status: 503, reason: "registry check failed" };
  const agents = await agentRes.json() as { agent_name: string }[];
  if (agents.length === 0) {
    return { ok: false, status: 403, reason: "agent not registered — POST /api/registry first" };
  }

  // Listing cap
  const countRes = await fetch(
    sbUrl(`agent_catalog?agent_name=eq.${encodeURIComponent(agentName)}&active=eq.true&select=id`),
    { headers: sbHeaders() }
  );
  if (countRes.ok) {
    const active = await countRes.json() as { id: number }[];
    if (active.length >= MAX_LISTINGS_PER_AGENT) {
      return {
        ok: false, status: 409,
        reason: `max ${MAX_LISTINGS_PER_AGENT} active listings per agent — deactivate one first`,
      };
    }
  }

  // 30-day fee holiday: 0% platform fee for an agent's first 3 listings.
  // Incentivises third-party supply into the Bazaar.
  const historyRes = await fetch(
    sbUrl(`agent_catalog?agent_name=eq.${encodeURIComponent(agentName)}&select=id,created_at&order=created_at.asc`),
    { headers: sbHeaders() }
  );
  const history = historyRes.ok ? await historyRes.json() as { id: number; created_at: string }[] : [];
  const firstListingAt = history[0]?.created_at ? new Date(history[0].created_at) : new Date();
  const holidayExpiry  = new Date(firstListingAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const inHoliday      = history.length < 3 && new Date() <= holidayExpiry;
  const platformFee    = inHoliday ? 0.00 : 20.00;
  const sellerEarn     = inHoliday ? 100.00 : 80.00;

  const insertRes = await fetch(sbUrl("agent_catalog"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      agent_name:           agentName,
      product_name:         productName,
      description,
      price_cents:          priceCents,
      checkout_url:         checkoutUrl,
      active:               true,
      platform_fee_percent: platformFee,
      seller_earn_percent:  sellerEarn,
    }),
  });
  if (!insertRes.ok) return { ok: false, status: 500, reason: "failed to create listing" };

  const rows = await insertRes.json() as { id: number; product_name: string; price_cents: number }[];
  const listing = rows[0];

  return {
    ok: true, status: 201,
    listing: {
      id:           listing.id,
      agent_name:   agentName,
      product_name: listing.product_name,
      price_usd:    (listing.price_cents / 100).toFixed(2),
      platform_fee: `${platformFee}%`,
      seller_earn:  `${sellerEarn}%`,
      fee_holiday:  inHoliday,
      browse_url:   "https://paiddev.com/api/ucp/bazaar",
    },
  };
}

export async function deactivateBazaarListing(id: number, agentName: string): Promise<ListingResult> {
  if (!id || isNaN(id))     return { ok: false, status: 400, reason: "id required" };
  if (!agentName.trim())    return { ok: false, status: 400, reason: "agent_name required" };
  const name = agentName.trim().slice(0, 50);

  // Ownership check before deactivating
  const checkRes = await fetch(
    sbUrl(`agent_catalog?id=eq.${id}&agent_name=eq.${encodeURIComponent(name)}&select=id,active&limit=1`),
    { headers: sbHeaders() }
  );
  if (!checkRes.ok) return { ok: false, status: 503, reason: "lookup failed" };
  const rows = await checkRes.json() as { id: number; active: boolean }[];
  if (rows.length === 0) {
    return { ok: false, status: 404, reason: "listing not found or does not belong to this agent" };
  }
  if (!rows[0].active) {
    return { ok: false, status: 409, reason: "listing is already inactive" };
  }

  const patchRes = await fetch(sbUrl(`agent_catalog?id=eq.${id}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ active: false }),
  });
  if (!patchRes.ok) return { ok: false, status: 500, reason: "deactivation failed" };

  return { ok: true, status: 200 };
}
