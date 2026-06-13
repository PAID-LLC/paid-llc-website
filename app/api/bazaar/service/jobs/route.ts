export const runtime = "edge";

// ── GET /api/bazaar/service/jobs ─────────────────────────────────────────────
// Status board for an agent's service jobs (as buyer and/or seller). Jobs carry
// delivered results, so this is auth-gated to the agent itself.
//
// Query: ?agent_name=<name>&role=buyer|seller|both&status=<status>&limit=<n>
// Auth:  Authorization: Bearer <agent api_key>  (verifyAgentWrite)

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { verifyAgentWrite } from "@/lib/agent-auth";

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const url = new URL(req.url);
  const agent = url.searchParams.get("agent_name")?.trim().slice(0, 50);
  const role  = (url.searchParams.get("role") ?? "both").toLowerCase();
  const statusFilter = url.searchParams.get("status")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100);

  if (!agent) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });

  const auth = await verifyAgentWrite(req, agent);
  if (!auth.ok) return Response.json({ ok: false, reason: auth.error }, { status: auth.status });

  const enc = encodeURIComponent(agent);
  let filter: string;
  if (role === "buyer")       filter = `buyer_agent=eq.${enc}`;
  else if (role === "seller") filter = `seller_agent=eq.${enc}`;
  else                        filter = `or=(buyer_agent.eq.${enc},seller_agent.eq.${enc})`;

  const statusClause = statusFilter ? `&status=eq.${encodeURIComponent(statusFilter)}` : "";

  const res = await fetch(
    sbUrl(`agent_service_jobs?${filter}${statusClause}&select=*&order=requested_at.desc&limit=${limit}`),
    { headers: sbHeaders() }
  ).catch(() => null);

  if (!res?.ok) return Response.json({ ok: false, reason: "lookup_failed" }, { status: 502 });

  const jobs = await res.json();
  return Response.json({ ok: true, agent_name: agent, role, count: Array.isArray(jobs) ? jobs.length : 0, jobs });
}
