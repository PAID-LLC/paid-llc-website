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
import { addRep, getRep }   from "@/lib/agents/reputation";
import { recordSale }       from "@/lib/ledger";
import { sentinelCheck }    from "@/lib/sentinel";
import { HOUSE_SELLERS, getExecutor, getExecutorCost } from "@/lib/agents/service-executors";
import { wardenReview }     from "@/lib/agents/warden";
import { logModeration }    from "@/lib/agents/moderation-log";
import { getEcon, serviceFloorCredits } from "@/lib/econ";
import { underDailyLimit, readCounter, bumpCounter } from "@/lib/usage-guard";
import { getBalance }       from "@/lib/human-identity";
import { qualityGate, garbageCheck, QUALITY_BAR, QUALITY_REFUNDS_PER_DAY } from "@/lib/agents/quality-gate";

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

/** Effective price and fee split. `floorCredits` is the dynamic token-cost
 *  floor for house-executed services (0 for third-party listings): the charge
 *  is max(listed price, floor), so a static listing can never sell below token
 *  cost x target margin as model prices move. The platform fee never rounds to
 *  zero on a paid job — a settle where we earn nothing while having paid for
 *  the Warden screen would be a quiet loss. */
export function creditMath(
  listing: ServiceListing,
  floorCredits = 0
): { price: number; fee: number; sellerEarn: number } {
  const listed = Math.max(0, Math.round(listing.price_cents));
  const price  = Math.max(listed, Math.max(0, Math.round(floorCredits)));
  const fee    = price > 0
    ? Math.min(price, Math.max(1, Math.floor(price * (listing.platform_fee_percent / 100))))
    : 0;
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
  // Awaited — Cloudflare edge kills detached promises, so `void` here meant
  // the award sometimes never landed. addRep never throws.
  await addRep(job.seller_agent, "reaction");
  await addRep(job.buyer_agent, "message");
  return true;
}

/** Buyer rejects a delivered job → freeze the escrow as 'disputed'. Unlike a
 *  refund, NO credits move: the buyer already holds the delivered result, so an
 *  automatic full refund on reject would hand over free work (the third-party
 *  seller's labor, or a house executor's spent compute). Credits stay held by
 *  the job row pending manual resolution (admin reconcile); the sweep's
 *  auto-accept skips disputed jobs, so escrow is frozen, not paid to either side.
 *  Returns false if the job already moved (e.g. sweep auto-accepted first). */
export async function dispute(job: ServiceJob, reason: string): Promise<boolean> {
  const claimed = await advance(job.id, "delivered", {
    status:         "disputed",
    dispute_reason: reason.slice(0, 300),
  });
  if (!claimed) return false;
  // Award-only rep: log the buyer's engagement. No seller penalty — rep never
  // decreases by design, so the withheld settle is the seller's only downside.
  // Awaited — same edge detached-promise rule as settle above.
  await addRep(job.buyer_agent, "message");
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

// ── Shared request runner ──────────────────────────────────────────────────────
// The escrow core behind a service hire, shared by the Bearer agent route
// (/api/bazaar/service/request) and the human session route (/api/bazaar/hire) so
// the money rules live in exactly one place. Callers are responsible ONLY for
// authenticating the buyer and any per-caller rate limiting BEFORE calling this;
// everything from listing lookup through escrow + settlement happens here.

export type RunResult =
  | { ok: true;  http: 200; status: "settled" | "delivered"; job_id: number; result: Record<string, unknown>; proof_hash: string | null; credits_spent: number }
  | { ok: true;  http: 200; status: "accepted"; job_id: number; seller_agent: string; deadline_at: string | null }
  | { ok: false; http: number; reason: string; extra?: Record<string, unknown> };

export async function runServiceJob(args: {
  buyer: string;
  itemId: number;
  input: Record<string, unknown>;
  actor?: "human" | "agent";   // humans get the stricter, doubt-refuses Warden posture
  /** Buyer's price ceiling. The floor can push the charge above the listed
   *  price when model costs rise; a buyer that quotes max_credits is never
   *  charged past it — the request 409s with the current price instead. */
  maxCredits?: number;
}): Promise<RunResult> {
  const { buyer, itemId, input } = args;
  const actor = args.actor ?? "agent";

  const listing = await fetchServiceListing(itemId);
  if (!listing) return { ok: false, http: 404, reason: "service_listing_not_found" };

  // Self-dealing guard.
  if (listing.agent_name.toLowerCase() === buyer.toLowerCase()) {
    return { ok: false, http: 400, reason: "cannot_buy_your_own_service" };
  }

  // House services are fulfilled with our tokens, so their price wears the
  // dynamic token-cost floor from the econ engine. Third-party sellers spend
  // their own compute — their listed price is their business (floor 0).
  const executorKey = listing.service_input_schema?.executor;
  const isHouse = HOUSE_SELLERS.has(listing.agent_name) && getExecutor(executorKey) !== null;
  const econ = await getEcon();
  const floor = isHouse ? serviceFloorCredits(econ, getExecutorCost(executorKey)) : 0;

  const { price, fee } = creditMath(listing, floor);
  if (price <= 0) return { ok: false, http: 400, reason: "listing_misconfigured_price" };
  if (typeof args.maxCredits === "number" && price > args.maxCredits) {
    return {
      ok: false, http: 409, reason: "price_above_max",
      extra: { current_price_credits: price, listed_price_credits: listing.price_cents },
    };
  }

  // Reputation gate (buy-side).
  if (listing.min_rep > 0) {
    const rep = await getRep(buyer);
    if (rep < listing.min_rep) {
      return { ok: false, http: 403, reason: "insufficient_reputation", extra: { required_rep: listing.min_rep, your_rep: rep } };
    }
  }

  // Input schema + injection screen (input flows into an LLM prompt downstream).
  const valid = validateInput(listing.service_input_schema, input);
  if (!valid.ok) return { ok: false, http: 400, reason: valid.reason ?? "invalid_input" };

  // Garbage never generates (quality-gate spec I1): input that cannot plausibly
  // produce paid-quality work is rejected here, deterministically, before the
  // Warden call, escrow, or any executor tokens. House services only — a
  // third-party seller's compute is its own business.
  if (isHouse) {
    const g = garbageCheck(executorKey, input);
    if (!g.ok) return { ok: false, http: 400, reason: g.reason };
  }

  const joined = Object.values(input).filter((v) => typeof v === "string").join("\n");

  // Layer 1: sentinel regex screen (hate/threats/spam + prompt injection).
  if (joined) {
    const screen = sentinelCheck(joined);
    if (!screen.allowed) {
      await logModeration({
        buyer_agent: buyer, catalog_item_id: itemId, service_name: listing.product_name,
        decision: "refuse", layer: "sentinel", category: "pattern", reason: screen.reason,
      });
      return { ok: false, http: 400, reason: screen.reason ?? "input_rejected" };
    }
  }

  // Refund-farming wall (quality-gate spec I3): a buyer at their daily
  // quality-refund allowance is refused BEFORE any model call. readCounter is
  // non-consuming — honest buyers who never hit refunds never notice this.
  if (isHouse && (await readCounter(`qrefund:${buyer}`)) >= QUALITY_REFUNDS_PER_DAY) {
    return {
      ok: false, http: 429, reason: "quality_refund_limit_reached",
      extra: { note: "Daily quality-refund allowance used up. Try again tomorrow." },
    };
  }

  // Balance pre-check BEFORE the Warden (quality-gate spec I6, dogfood B1 fix):
  // a buyer who cannot afford the job should cost us one Supabase read, not a
  // Warden model call. escrowDeduct below remains the atomic authority.
  if ((await getBalance(buyer)) < price) {
    return { ok: false, http: 402, reason: "insufficient_credits", extra: { required_credits: price } };
  }

  // Global daily capacity for house-executed jobs, checked BEFORE the Warden so
  // an over-capacity request costs zero tokens. Per-buyer caps live in the
  // routes; this bounds the sum across all buyers so N distinct agents cannot
  // drain the shared Gemini budget through the executors. Over-capacity is a
  // clean 429 before any escrow — nothing to refund.
  if (isHouse && !(await underDailyLimit("svc_jobs_global", econ.svc_daily_global))) {
    return { ok: false, http: 429, reason: "service_capacity_reached_try_tomorrow" };
  }

  // Layer 2: The Warden judges intent. Runs before any escrow so a refused request
  // is never charged. Human submissions use the strict posture (doubt refuses, and
  // a can't-evaluate outage fails closed); agent traffic stays fail-open.
  const verdict = await wardenReview({ service: listing.product_name, input }, { strict: actor === "human" });
  if (!verdict.allowed) {
    await logModeration({
      buyer_agent: buyer, catalog_item_id: itemId, service_name: listing.product_name,
      decision: "refuse", layer: "warden", category: verdict.category, reason: verdict.reason,
    });
    // category "unavailable" means we could not evaluate (strict fail-closed), which
    // is a transient 503, not a policy refusal.
    if (verdict.category === "unavailable") {
      return { ok: false, http: 503, reason: "review_unavailable" };
    }
    return { ok: false, http: 403, reason: "refused_by_warden", extra: { category: verdict.category } };
  }
  await logModeration({
    buyer_agent: buyer, catalog_item_id: itemId, service_name: listing.product_name,
    decision: "allow", layer: "warden", category: verdict.category, reason: verdict.reason,
  });

  // ── Escrow: deduct the buyer NOW ────────────────────────────────────────────
  const deducted = await escrowDeduct(buyer, price);
  if (!deducted) return { ok: false, http: 402, reason: "insufficient_credits", extra: { required_credits: price } };

  const job = await createJob({ listing, buyer, price, fee, input });
  if (!job) {
    await creditAgent(buyer, price);   // unwind so the buyer is never out funds
    return { ok: false, http: 500, reason: "job_create_failed_refunded" };
  }

  // ── House fulfilment (synchronous) ──────────────────────────────────────────
  const executor = isHouse ? getExecutor(executorKey) : null;

  if (executor) {
    const exec = await executor(input);
    if (!exec) {
      // Infra fault (key unset / budget spent / fetch failed) — full refund,
      // and deliberately NOT counted against the buyer's quality-refund
      // allowance: this failure is ours, not theirs.
      await refund(job, "refunded", "accepted", "executor_unavailable");
      return { ok: false, http: 503, reason: "executor_unavailable", extra: { refunded: true, job_id: job.id } };
    }

    // Judge-or-refund quality gate: lint + rubric judge, one revision for
    // near-misses, refund below the bar. The buyer can never pay for output
    // the judge scored under QUALITY_BAR. Fail-open on judge unavailability
    // (delivers unscored) — see quality-gate.ts for the invariants.
    const gate = await qualityGate({
      serviceName: listing.product_name, executorKey, input, result: exec.result,
    });
    if (!gate.deliver) {
      await refund(job, "refunded", "accepted", `quality_below_bar (score ${gate.score}/${QUALITY_BAR})`);
      await bumpCounter(`qrefund:${buyer}`, 1);
      await logModeration({
        buyer_agent: buyer, catalog_item_id: itemId, service_name: listing.product_name,
        decision: "refuse", layer: "quality", category: executorKey ?? "unknown",
        reason: `score ${gate.score} below bar ${QUALITY_BAR}${gate.revised ? " after one revision" : ""}`,
      });
      return {
        ok: false, http: 422, reason: "quality_below_bar_refunded",
        extra: {
          refunded: true, job_id: job.id, score: gate.score, bar: QUALITY_BAR,
          message:
            "Our quality judge scored this output below our delivery bar, so the job was refunded in full. " +
            "You were not charged.",
        },
      };
    }

    const delivered = await deliverResult(job, gate.result, listing.auto_verify);
    if (!delivered) {
      await refund(job, "refunded", "accepted", "deliver_failed");
      return { ok: false, http: 500, reason: "deliver_failed_refunded", extra: { job_id: job.id } };
    }
    const settled = await settle(delivered);
    return {
      ok: true, http: 200,
      status: settled ? "settled" : "delivered",   // delivered+settled is the house happy path
      job_id: job.id,
      result: gate.result,
      proof_hash: delivered.proof_hash,
      credits_spent: price,
    };
  }

  // ── Third-party service (asynchronous) ──────────────────────────────────────
  return {
    ok: true, http: 200,
    status: "accepted",
    job_id: job.id,
    seller_agent: listing.agent_name,
    deadline_at: job.deadline_at,
  };
}
