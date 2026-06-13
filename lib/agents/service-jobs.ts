// ── Agent service jobs — escrow lifecycle helpers ────────────────────────────
// Shared by the /api/bazaar/service/* routes so the escrow rules cannot drift
// between request, deliver, verify, and the sweep cron.
//
// Money model (all in Latent Credits, 1 credit == 1 cent of list price):
//   - REQUEST  deduct_latent_credits(buyer, price)         → held by the job row
//   - SETTLE   credit_seller(seller, price - platform_fee) → platform keeps the fee
//   - REFUND   credit_seller(buyer, price)                 → full unwind
// credit_seller is an upsert on latent_credits, so it works for any agent_name —
// crediting the buyer back is just a credit_seller(buyer, ...) call.
//
// State transitions are claimed with an atomic PATCH guarded by the current
// status (advance()), so two racing callers — e.g. a buyer verifying at the same
// instant the sweep auto-accepts — can never double-pay.

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { addRep }           from "@/lib/agents/reputation";
import { recordSale }       from "@/lib/ledger";

export type JobStatus =
  | "requested" | "accepted" | "delivered" | "verified"
  | "settled" | "disputed" | "refunded" | "expired";

export interface ServiceListing {
  id:                   number;
  agent_name:           string;   // the seller
  product_name:         string;
  description:          string;
  price_cents:          number;
  platform_fee_percent: number;   // stored as a percent, e.g. 20.00
  listing_type:         string;
  service_input_schema: { executor?: string; fields?: Record<string, string> } | null;
  sla_minutes:          number | null;
  auto_verify:          "none" | "schema" | "assert";
  min_rep:              number;
}

export interface ServiceJob {
  id:                   number;
  catalog_item_id:      number;
  buyer_agent:          string;
  seller_agent:         string;
  price_credits:        number;
  platform_fee_credits: number;
  status:               JobStatus;
  input:                Record<string, unknown> | null;
  result:               Record<string, unknown> | null;
  proof_hash:           string | null;
  verify_deadline_at:   string | null;
  deadline_at:          string | null;
}

const DEFAULT_SLA_MINUTES    = 60;
export const VERIFY_WINDOW_MINUTES = 30;   // buyer-verify window before auto-accept

// ── Lookups ──────────────────────────────────────────────────────────────────

export async function fetchServiceListing(catalogItemId: number): Promise<ServiceListing | null> {
  const res = await fetch(
    sbUrl(
      `agent_catalog?id=eq.${catalogItemId}&active=eq.true&listing_type=eq.service` +
      `&select=id,agent_name,product_name,description,price_cents,platform_fee_percent,listing_type,service_input_schema,sla_minutes,auto_verify,min_rep&limit=1`
    ),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as ServiceListing[];
  return rows[0] ?? null;
}

export async function getJob(jobId: number): Promise<ServiceJob | null> {
  const res = await fetch(
    sbUrl(`agent_service_jobs?id=eq.${jobId}&select=*&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as ServiceJob[];
  return rows[0] ?? null;
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Confirms every field the listing requires is present as a non-empty string. */
export function validateInput(
  schema: ServiceListing["service_input_schema"],
  input: Record<string, unknown>
): { ok: boolean; reason?: string } {
  const fields = schema?.fields ?? {};
  for (const key of Object.keys(fields)) {
    const v = input[key];
    if (typeof v !== "string" || v.trim() === "") {
      return { ok: false, reason: `input.${key} (string) is required` };
    }
  }
  return { ok: true };
}

export function creditMath(listing: ServiceListing): { price: number; fee: number; sellerEarn: number } {
  const price = Math.max(0, Math.round(listing.price_cents));
  const fee   = Math.floor(price * (listing.platform_fee_percent / 100));
  return { price, fee, sellerEarn: price - fee };
}

export function slaDeadline(listing: ServiceListing): string {
  const mins = listing.sla_minutes && listing.sla_minutes > 0 ? listing.sla_minutes : DEFAULT_SLA_MINUTES;
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

// ── Proof hash ───────────────────────────────────────────────────────────────

/** Deterministic sha256 of the result (sorted keys) — tamper-evident record of
 *  what was delivered. Real seller-key signatures are phase 2 (no public_key
 *  column exists in latent_registry yet). */
export async function proofHash(result: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify(result, Object.keys(result).sort());
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Credit movement (RPCs) ─────────────────────────────────────────────────────

/** Atomic, no-negative deduction. false = insufficient balance or RPC failure. */
export async function escrowDeduct(agentName: string, credits: number): Promise<boolean> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/deduct_latent_credits`, {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({ p_agent_name: agentName, p_amount: credits }),
  }).catch(() => null);
  if (!res?.ok) return false;
  return ((await res.json()) as boolean) === true;
}

/** Upsert-increment. Used to pay the seller AND to refund the buyer. */
export async function creditAgent(agentName: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/credit_seller`, {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({ p_agent_name: agentName, p_amount: credits }),
  }).catch(() => { /* reconcile/sweep retries */ });
}

// ── State machine ─────────────────────────────────────────────────────────────

/** Atomically move a job from `from` to the patched state. Returns the updated
 *  row, or null if the job was not in `from` (another caller already moved it). */
export async function advance(
  jobId: number,
  from: JobStatus,
  patch: Record<string, unknown>
): Promise<ServiceJob | null> {
  const res = await fetch(
    sbUrl(`agent_service_jobs?id=eq.${jobId}&status=eq.${from}`),
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(patch),
    }
  ).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as ServiceJob[];
  return rows[0] ?? null;
}

export async function createJob(args: {
  listing: ServiceListing;
  buyer: string;
  price: number;
  fee: number;
  input: Record<string, unknown>;
}): Promise<ServiceJob | null> {
  const now = new Date().toISOString();
  const res = await fetch(sbUrl("agent_service_jobs"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      catalog_item_id:      args.listing.id,
      buyer_agent:          args.buyer,
      seller_agent:         args.listing.agent_name,
      price_credits:        args.price,
      platform_fee_credits: args.fee,
      status:               "accepted",          // MVP auto-accepts on request
      input:                args.input,
      requested_at:         now,
      accepted_at:          now,
      deadline_at:          slaDeadline(args.listing),
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as ServiceJob[];
  return rows[0] ?? null;
}

/** Record a delivered result on an accepted job (accepted → delivered). For
 *  buyer-verified listings, opens the 30-minute auto-accept window. */
export async function deliverResult(
  job: ServiceJob,
  result: Record<string, unknown>,
  autoVerify: ServiceListing["auto_verify"],
  resultSig?: string
): Promise<ServiceJob | null> {
  const hash = await proofHash(result);
  const patch: Record<string, unknown> = {
    status:       "delivered",
    result,
    proof_hash:   hash,
    delivered_at: new Date().toISOString(),
  };
  if (resultSig) patch.result_sig = resultSig.slice(0, 512);
  if (autoVerify === "none") {
    patch.verify_deadline_at = new Date(Date.now() + VERIFY_WINDOW_MINUTES * 60 * 1000).toISOString();
  }
  return advance(job.id, "accepted", patch);
}

/** Settle a delivered job: pay the seller, retain the platform fee, record the
 *  sale, bump reputation. Race-safe — the delivered → settled PATCH is the
 *  exclusive claim, so only one caller (buyer-accept OR sweep auto-accept) wins. */
export async function settle(job: ServiceJob): Promise<boolean> {
  const claimed = await advance(job.id, "delivered", {
    status: "settled", settled_at: new Date().toISOString(),
  });
  if (!claimed) return false;   // already settled/disputed/expired by another path

  const sellerEarn = job.price_credits - job.platform_fee_credits;
  await creditAgent(job.seller_agent, sellerEarn);

  // Ledger view: gross = what the buyer paid; fee = seller payout; net = our cut.
  void recordSale({
    source:       "manual",
    event_type:   "bazaar_sale",
    external_id:  `svcjob_${job.id}`,
    gross_cents:  job.price_credits,
    fee_cents:    sellerEarn,
    product_name: `Agent service #${job.catalog_item_id}`,
    agent_name:   job.seller_agent,
    provisioning_status: "delivered",
    metadata: {
      kind:                 "agent_service",
      buyer_agent:          job.buyer_agent,
      seller_agent:         job.seller_agent,
      catalog_item_id:      job.catalog_item_id,
      price_credits:        job.price_credits,
      platform_fee_credits: job.platform_fee_credits,
      proof_hash:           job.proof_hash,
    },
  });

  // Reputation: completing a paid job is a high-signal event for the seller.
  // (The rep system is award-only by design — scores never decrease — so a
  //  non-delivery "penalty" is the absence of this award, not a deduction.)
  void addRep(job.seller_agent, "reaction");
  void addRep(job.buyer_agent, "message");
  return true;
}

/** Refund the buyer and move the job to a terminal refund state. */
export async function refund(job: ServiceJob, to: "refunded" | "expired", from: JobStatus, reason?: string): Promise<boolean> {
  const patch: Record<string, unknown> = { status: to };
  if (reason) patch.dispute_reason = reason.slice(0, 300);
  const claimed = await advance(job.id, from, patch);
  if (!claimed) return false;
  await creditAgent(job.buyer_agent, job.price_credits);
  return true;
}
