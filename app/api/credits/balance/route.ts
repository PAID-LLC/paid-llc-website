export const runtime = "edge";

// ── GET /api/credits/balance?agent_name=X ────────────────────────────────────
// Public read-only credit balance lookup for the /v2/credits page. Balance is
// already public via the get_agent_profile MCP tool; this mirrors that surface
// for humans without requiring the agent's api_key. Write operations stay
// behind Bearer auth (/api/ucp/balance, transfers, checkout).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const agentName = (searchParams.get("agent_name") ?? "").trim().slice(0, 50);
  if (!agentName) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // Must be a registered agent — avoids turning this into a name oracle
  // that distinguishes "no balance" from "never existed".
  const regRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!regRes.ok) return Response.json({ ok: false, reason: "lookup failed" }, { status: 503 });
  if (((await regRes.json()) as unknown[]).length === 0) {
    return Response.json({ ok: false, reason: "agent not registered" }, { status: 404 });
  }

  const res = await fetch(
    sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return Response.json({ ok: false, reason: "balance lookup failed" }, { status: 500 });
  const rows = await res.json() as { balance: number }[];

  return Response.json(
    { ok: true, agent_name: agentName, balance: rows[0]?.balance ?? 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
