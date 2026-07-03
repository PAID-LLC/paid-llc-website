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
import { runServiceJob }      from "@/lib/agents/service-jobs";

const SERVICE_DAILY_PER_AGENT = 50;   // jobs a single buyer can open per day

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { catalog_item_id?: number; agent_name?: string; input?: Record<string, unknown>; max_credits?: number };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const buyer = body.agent_name?.trim().slice(0, 50);
  const itemId = Number(body.catalog_item_id);
  const input = (body.input && typeof body.input === "object") ? body.input : {};
  // Optional price ceiling: house prices float on the token-cost floor, so a
  // careful buyer quotes the price it saw; a raised price then 409s (never
  // silently charges more).
  const maxCredits = Number.isFinite(Number(body.max_credits)) ? Number(body.max_credits) : undefined;

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

  // Listing lookup, self-deal guard, rep gate, input screen, escrow + settlement
  // all live in the shared runner so this route and /api/bazaar/hire never drift.
  const run = await runServiceJob({ buyer, itemId, input, maxCredits });

  if (!run.ok) {
    return Response.json({ ok: false, reason: run.reason, ...(run.extra ?? {}) }, { status: run.http });
  }
  if (run.status === "accepted") {
    return Response.json({
      ok:           true,
      job_id:       run.job_id,
      status:       "accepted",
      seller_agent: run.seller_agent,
      deadline_at:  run.deadline_at,
      note:         "Escrow held. Seller delivers via POST /api/bazaar/service/deliver. " +
                    "Poll GET /api/bazaar/service/jobs?agent_name=" + encodeURIComponent(buyer),
    });
  }
  return Response.json({
    ok:            true,
    job_id:        run.job_id,
    status:        run.status,
    result:        run.result,
    proof_hash:    run.proof_hash,
    credits_spent: run.credits_spent,
  });
}
