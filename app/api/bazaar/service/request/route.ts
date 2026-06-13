export const runtime = "edge";

// ── POST /api/bazaar/service/request ─────────────────────────────────────────
// A buyer agent requests a service listing. Credits are deducted into escrow
// immediately (held by the job row, NOT yet the seller's). The job auto-accepts.
//
// House services (seller in HOUSE_SELLERS with a known executor) are fulfilled
// synchronously: the work runs server-side and the result + settlement come back
// in this response. Third-party services return an 'accepted' job the seller
// then fulfils via /api/bazaar/service/deliver.
//
// Body: { catalog_item_id, agent_name (buyer), input: {...} }
// Auth: Authorization: Bearer <buyer api_key>  (verifyAgentWrite)

import { supabaseReady }      from "@/lib/supabase";
import { verifyAgentWrite }   from "@/lib/agent-auth";
import { underDailyLimit }    from "@/lib/usage-guard";
import { getRep }             from "@/lib/agents/reputation";
import { sentinelCheck }      from "@/lib/sentinel";
import {
  fetchServiceListing, validateInput, creditMath,
  escrowDeduct, createJob, deliverResult, settle, refund, creditAgent,
} from "@/lib/agents/service-jobs";
import { HOUSE_SELLERS, getExecutor } from "@/lib/agents/service-executors";

const SERVICE_DAILY_PER_AGENT = 50;   // jobs a single buyer can open per day

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { catalog_item_id?: number; agent_name?: string; input?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const buyer = body.agent_name?.trim().slice(0, 50);
  const itemId = Number(body.catalog_item_id);
  const input = (body.input && typeof body.input === "object") ? body.input : {};

  if (!buyer)  return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!itemId || isNaN(itemId)) {
    return Response.json({ ok: false, reason: "catalog_item_id required" }, { status: 400 });
  }

  // Auth: caller must prove ownership of the buyer agent (api_key).
  const auth = await verifyAgentWrite(req, buyer);
  if (!auth.ok) return Response.json({ ok: false, reason: auth.error }, { status: auth.status });

  // Per-agent daily cap (credit-drain guardrail).
  if (!(await underDailyLimit(`svc_req:${buyer}`, SERVICE_DAILY_PER_AGENT))) {
    return Response.json({ ok: false, reason: "daily_job_limit_reached" }, { status: 429 });
  }

  const listing = await fetchServiceListing(itemId);
  if (!listing) return Response.json({ ok: false, reason: "service_listing_not_found" }, { status: 404 });

  // Self-dealing guard.
  if (listing.agent_name.toLowerCase() === buyer.toLowerCase()) {
    return Response.json({ ok: false, reason: "cannot_buy_your_own_service" }, { status: 400 });
  }

  const { price, fee } = creditMath(listing);
  if (price <= 0) return Response.json({ ok: false, reason: "listing_misconfigured_price" }, { status: 400 });

  // Reputation gate (buy-side).
  if (listing.min_rep > 0) {
    const rep = await getRep(buyer);
    if (rep < listing.min_rep) {
      return Response.json(
        { ok: false, reason: "insufficient_reputation", required_rep: listing.min_rep, your_rep: rep },
        { status: 403 }
      );
    }
  }

  // Input schema + injection screen (input flows into an LLM prompt downstream).
  const valid = validateInput(listing.service_input_schema, input);
  if (!valid.ok) return Response.json({ ok: false, reason: valid.reason }, { status: 400 });
  const joined = Object.values(input).filter((v) => typeof v === "string").join("\n");
  if (joined) {
    const screen = sentinelCheck(joined);
    if (!screen.allowed) return Response.json({ ok: false, reason: screen.reason }, { status: 400 });
  }

  // ── Escrow: deduct the buyer NOW ────────────────────────────────────────────
  const deducted = await escrowDeduct(buyer, price);
  if (!deducted) {
    return Response.json(
      { ok: false, reason: "insufficient_credits", required_credits: price },
      { status: 402 }
    );
  }

  const job = await createJob({ listing, buyer, price, fee, input });
  if (!job) {
    // Job row failed after deduct — unwind so the buyer is never out funds.
    await creditAgent(buyer, price);
    return Response.json({ ok: false, reason: "job_create_failed_refunded" }, { status: 500 });
  }

  // ── House fulfilment (synchronous) ──────────────────────────────────────────
  const executorKey = listing.service_input_schema?.executor;
  const executor = HOUSE_SELLERS.has(listing.agent_name) ? getExecutor(executorKey) : null;

  if (executor) {
    const exec = await executor(input);
    if (!exec) {
      // Executor unavailable (no Gemini key / budget spent / fetch failed):
      // refund and close honestly rather than settle for empty output.
      await refund(job, "refunded", "accepted", "executor_unavailable");
      return Response.json(
        { ok: false, reason: "executor_unavailable", refunded: true, job_id: job.id },
        { status: 503 }
      );
    }

    const delivered = await deliverResult(job, exec.result, listing.auto_verify);
    if (!delivered) {
      await refund(job, "refunded", "accepted", "deliver_failed");
      return Response.json({ ok: false, reason: "deliver_failed_refunded", job_id: job.id }, { status: 500 });
    }

    const settled = await settle(delivered);
    return Response.json({
      ok:           true,
      job_id:       job.id,
      status:       settled ? "settled" : delivered.status,
      result:       exec.result,
      proof_hash:   delivered.proof_hash,
      credits_spent: price,
    });
  }

  // ── Third-party service (asynchronous) ──────────────────────────────────────
  return Response.json({
    ok:          true,
    job_id:      job.id,
    status:      "accepted",
    seller_agent: listing.agent_name,
    deadline_at: job.deadline_at,
    note:        "Escrow held. Seller delivers via POST /api/bazaar/service/deliver. " +
                 "Poll GET /api/bazaar/service/jobs?agent_name=" + encodeURIComponent(buyer),
  });
}
