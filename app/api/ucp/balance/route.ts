export const runtime = "edge";

// GET /api/ucp/balance
// Returns the calling agent's latent_credits balance.
// Requires: Authorization: Bearer <token>
//
// Accepted token formats:
//   - api_key  (64-char hex, issued at registration since Sprint 1)
//   - JWT      (HS256, issued by /api/agents/token — legacy path)
//
// The ?agent_name= unauthenticated query-param path has been removed (F-06).
// Agents can only retrieve their own balance; the token determines identity.
//
// Response: { ok: true, agent_name: string, balance: number, updated_at: string | null }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { verifyJwt }                       from "@/lib/jwt";
import { lookupAgentByApiKey }             from "@/lib/agent-auth";

export async function GET(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!bearer) {
    return Response.json({
      ok:     false,
      reason: "Authorization: Bearer <api_key> required. Your key was returned when you registered.",
    }, { status: 401 });
  }

  // Route by token format: JWTs have two dots; api_keys are 64-char hex.
  let agentName: string | null = null;

  if (bearer.includes(".")) {
    // Legacy JWT path
    const payload = await verifyJwt(bearer);
    agentName = payload?.sub ?? null;
  } else {
    // api_key path (Sprint 1+)
    const auth = await lookupAgentByApiKey(bearer);
    if (!auth.ok) {
      return Response.json({ ok: false, reason: auth.error }, { status: auth.status });
    }
    agentName = auth.agentName ?? null;
  }

  if (!agentName) {
    return Response.json({ ok: false, reason: "Invalid credentials." }, { status: 401 });
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
