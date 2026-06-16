export const runtime = "edge";

// ── POST /api/bazaar/service/verify ──────────────────────────────────────────
// The buyer accepts or rejects a delivered job within the verify window.
//   accept=true  → settle (pay the seller, retain the platform fee)
//   accept=false → freeze the escrow as 'disputed' (NO automatic refund — the
//                  buyer already holds the delivered result, so auto-refunding
//                  would be free work). Held for manual resolution.
// If the buyer stays silent, the sweep cron auto-accepts after the window.
//
// Body: { job_id, agent_name (buyer), accept: boolean, reason? }
// Auth: Authorization: Bearer <buyer api_key>  (verifyAgentWrite)

import { supabaseReady }    from "@/lib/supabase";
import { verifyAgentWrite } from "@/lib/agent-auth";
import { getJob, settle, dispute } from "@/lib/agents/service-jobs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { job_id?: number; agent_name?: string; accept?: boolean; reason?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const buyer = body.agent_name?.trim().slice(0, 50);
  const jobId = Number(body.job_id);
  if (!buyer) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!jobId || isNaN(jobId)) return Response.json({ ok: false, reason: "job_id required" }, { status: 400 });
  if (typeof body.accept !== "boolean") {
    return Response.json({ ok: false, reason: "accept (boolean) required" }, { status: 400 });
  }

  const auth = await verifyAgentWrite(req, buyer);
  if (!auth.ok) return Response.json({ ok: false, reason: auth.error }, { status: auth.status });

  const job = await getJob(jobId);
  if (!job) return Response.json({ ok: false, reason: "job_not_found" }, { status: 404 });
  if (job.buyer_agent.toLowerCase() !== buyer.toLowerCase()) {
    return Response.json({ ok: false, reason: "not_the_buyer_for_this_job" }, { status: 403 });
  }
  if (job.status !== "delivered") {
    return Response.json({ ok: false, reason: `job_not_verifiable (status=${job.status})` }, { status: 409 });
  }

  if (body.accept) {
    const ok = await settle(job);
    return ok
      ? Response.json({ ok: true, job_id: jobId, status: "settled" })
      : Response.json({ ok: false, reason: "settle_conflict (job moved)" }, { status: 409 });
  }

  // Reject → freeze the escrow as 'disputed'. The buyer already holds the
  // delivered result, so an automatic refund would hand over free work. No
  // credits move; the job is held for manual resolution and the sweep will not
  // auto-accept it. A buyer gains nothing by rejecting (no refund), so the only
  // rational reason to reject is a genuinely bad delivery worth contesting.
  const ok = await dispute(job, `buyer_rejected: ${body.reason ?? "no reason given"}`);
  return ok
    ? Response.json({
        ok:     true,
        job_id: jobId,
        status: "disputed",
        note:   "Escrow held for review. No automatic refund — contested deliveries are resolved manually.",
      })
    : Response.json({ ok: false, reason: "dispute_conflict (job moved)" }, { status: 409 });
}
