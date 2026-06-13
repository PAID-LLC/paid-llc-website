export const runtime = "edge";

// ── POST /api/bazaar/service/deliver ─────────────────────────────────────────
// A seller agent delivers the result for an accepted (escrowed) job. If the
// listing auto-verifies, the job settles immediately; otherwise it enters the
// buyer-verify window (auto-accepts after 30 min via the sweep cron).
//
// Body: { job_id, agent_name (seller), result: {...}, result_sig? }
// Auth: Authorization: Bearer <seller api_key>  (verifyAgentWrite)

import { supabaseReady }    from "@/lib/supabase";
import { verifyAgentWrite } from "@/lib/agent-auth";
import { sentinelCheck }    from "@/lib/sentinel";
import {
  getJob, fetchServiceListing, deliverResult, settle, VERIFY_WINDOW_MINUTES,
} from "@/lib/agents/service-jobs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { job_id?: number; agent_name?: string; result?: Record<string, unknown>; result_sig?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const seller = body.agent_name?.trim().slice(0, 50);
  const jobId  = Number(body.job_id);
  const result = body.result;

  if (!seller) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!jobId || isNaN(jobId)) return Response.json({ ok: false, reason: "job_id required" }, { status: 400 });
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).length === 0) {
    return Response.json({ ok: false, reason: "result (non-empty object) required" }, { status: 400 });
  }

  const auth = await verifyAgentWrite(req, seller);
  if (!auth.ok) return Response.json({ ok: false, reason: auth.error }, { status: auth.status });

  const job = await getJob(jobId);
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (job.seller_agent.toLowerCase() !== seller.toLowerCase()) {
    return Response.json({ ok: false, reason: "not_the_seller_for_this_job" }, { status: 403 });
  }
  if (job.status !== "accepted") {
    return Response.json({ ok: false, reason: `job_not_deliverable (status=${job.status})` }, { status: 409 });
  }

  // Screen the delivered text — a seller's result is returned to the buyer agent,
  // so block injection payloads from riding through the marketplace.
  const joined = Object.values(result).filter((v) => typeof v === "string").join("\n");
  if (joined) {
    const screen = sentinelCheck(joined);
    if (!screen.allowed) return Response.json({ ok: false, reason: screen.reason }, { status: 400 });
  }

  const listing = await fetchServiceListing(job.catalog_item_id);
  const autoVerify = listing?.auto_verify ?? "none";

  const delivered = await deliverResult(job, result, autoVerify, body.result_sig);
  if (!delivered) {
    return Response.json({ ok: false, reason: "deliver_conflict (job moved)" }, { status: 409 });
  }

  // auto_verify='schema' settles on delivery (result already passed the non-empty
  // check). 'none' waits for the buyer.
  if (autoVerify === "schema") {
    const settled = await settle(delivered);
    return Response.json({ ok: true, job_id: jobId, status: settled ? "settled" : delivered.status, proof_hash: delivered.proof_hash });
  }

  return Response.json({
    ok:                 true,
    job_id:             jobId,
    status:             "delivered",
    proof_hash:         delivered.proof_hash,
    verify_deadline_at: delivered.verify_deadline_at,
    note:               `Buyer verifies via POST /api/bazaar/service/verify. Auto-accepts in ${VERIFY_WINDOW_MINUTES} min if silent.`,
  });
}
