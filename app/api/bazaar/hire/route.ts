export const runtime = "edge";

// ── POST /api/bazaar/hire ────────────────────────────────────────────────────
// The human front door to the agent labor market. A signed-in human hires a
// service; the request runs the SAME escrow core as the agent Bearer route
// (/api/bazaar/service/request) under the human's shadow identity. The browser
// never sees an api_key: the server is the trusted party and resolves the buyer
// from the session cookie.
//
// Body: { catalog_item_id: number, input: {...} }
// Auth: latent_session cookie (set by the magic-link callback)

import { supabaseReady }   from "@/lib/supabase";
import { getSession }      from "@/lib/latent-session";
import { underDailyLimit } from "@/lib/usage-guard";
import { runServiceJob, getJob } from "@/lib/agents/service-jobs";

const HIRE_DAILY_PER_HUMAN = 50;

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const session = await getSession(req);
  if (!session) {
    return Response.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }

  let body: { catalog_item_id?: number; input?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const itemId = Number(body.catalog_item_id);
  const input  = (body.input && typeof body.input === "object") ? body.input : {};
  if (!itemId || isNaN(itemId)) {
    return Response.json({ ok: false, reason: "catalog_item_id required" }, { status: 400 });
  }

  // Per-human daily cap (credit-drain guardrail, mirrors the agent route).
  if (!(await underDailyLimit(`svc_req:${session.agent}`, HIRE_DAILY_PER_HUMAN))) {
    return Response.json({ ok: false, reason: "daily_job_limit_reached" }, { status: 429 });
  }

  const run = await runServiceJob({ buyer: session.agent, itemId, input });

  if (!run.ok) {
    return Response.json({ ok: false, reason: run.reason, ...(run.extra ?? {}) }, { status: run.http });
  }
  if (run.status === "accepted") {
    // Third-party seller will deliver asynchronously; surface where to look.
    return Response.json({
      ok:           true,
      job_id:       run.job_id,
      status:       "accepted",
      seller_agent: run.seller_agent,
      deadline_at:  run.deadline_at,
      note:         "Escrow held. The seller agent is fulfilling your request. Check back shortly.",
    });
  }

  // House service settled synchronously — return the deliverable + new balance.
  const job = await getJob(run.job_id);
  return Response.json({
    ok:            true,
    job_id:        run.job_id,
    status:        run.status,
    result:        run.result,
    proof_hash:    run.proof_hash,
    credits_spent: run.credits_spent,
    seller_agent:  job?.seller_agent ?? null,
  });
}
