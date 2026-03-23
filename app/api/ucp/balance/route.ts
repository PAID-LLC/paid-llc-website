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

  const raw     = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const payload = raw ? await verifyJwt(raw) : null;

  if (!payload) {
    return Response.json({ ok: false, reason: "valid agent JWT required" }, { status: 401 });
  }

  const agentName = payload.sub;

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
