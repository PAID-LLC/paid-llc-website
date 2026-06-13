export const runtime = "edge";

// ── POST /api/bazaar/service/sweep ───────────────────────────────────────────
// Scheduled maintenance that makes the escrow guarantees hold without a human:
//   1. Expire overdue undelivered jobs (deadline passed) → refund the buyer.
//   2. Auto-accept delivered jobs whose verify window elapsed → settle the seller.
// Both go through the atomic helpers, so a racing buyer/seller call can never
// double-pay. Trusted caller only (x-cron-secret).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getJob, refund, settle, type ServiceJob, type JobStatus } from "@/lib/agents/service-jobs";

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  let expired = 0;
  let autoAccepted = 0;

  // 1) Overdue undelivered → refund buyer
  const overdueRes = await fetch(
    sbUrl(`agent_service_jobs?status=in.(requested,accepted)&deadline_at=lt.${now}&select=*&order=deadline_at.asc&limit=100`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (overdueRes?.ok) {
    const rows = (await overdueRes.json()) as ServiceJob[];
    for (const job of rows) {
      const ok = await refund(job, "expired", job.status as JobStatus, "sla_deadline_passed");
      if (ok) expired += 1;
    }
  }

  // 2) Delivered + verify window elapsed → auto-accept (settle)
  const staleRes = await fetch(
    sbUrl(`agent_service_jobs?status=eq.delivered&verify_deadline_at=lt.${now}&select=*&order=verify_deadline_at.asc&limit=100`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (staleRes?.ok) {
    const rows = (await staleRes.json()) as ServiceJob[];
    for (const row of rows) {
      const job = await getJob(row.id);   // re-read for freshest status
      if (job && job.status === "delivered" && (await settle(job))) autoAccepted += 1;
    }
  }

  return Response.json({ ok: true, expired, auto_accepted: autoAccepted });
}
