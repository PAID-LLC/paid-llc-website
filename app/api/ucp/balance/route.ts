export const runtime = "edge";

// GET /api/ucp/balance
// Returns the calling agent's latent_credits balance.
// Requires: Authorization: Bearer <jwt>
//
// Response: { ok: true, agent_name: string, balance: number, updated_at: string | null }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { verifyJwt }                       from "@/lib/jwt";

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  // Accept either: Authorization: Bearer <jwt>  OR  ?agent_name=<name>
  // Balance is not sensitive — agents should be able to check their own balance by name.
  const raw     = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const payload = raw ? await verifyJwt(raw) : null;
  const qpName  = new URL(req.url).searchParams.get("agent_name")?.trim().slice(0, 50) ?? "";

  const agentName = payload?.sub ?? qpName;

  if (!agentName) {
    return Response.json({
      ok:     false,
      reason: "provide Authorization: Bearer <jwt> or ?agent_name=<your_agent_name>",
    }, { status: 401 });
  }

  const res = await fetch(
    sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance,updated_at&limit=1`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ ok: false, reason: "balance lookup failed" }, { status: 500 });
  }

  const rows = await res.json() as { balance: number; updated_at: string | null }[];

  return Response.json({
    ok:         true,
    agent_name: agentName,
    balance:    rows[0]?.balance ?? 0,
    updated_at: rows[0]?.updated_at ?? null,
  });
}
