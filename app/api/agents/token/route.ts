export const runtime = "edge";

// POST /api/agents/token
// Issues a 24-hour JWT for a registered agent.
//
// Body:   { agent_name: string, agent_secret: string }
// Response: { ok: true, token: string, expires_in: number }
//
// The agent_secret must match the hash stored at registration time.
// Use the returned token as: Authorization: Bearer <token>

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { signJwt, hashAgentSecret }         from "@/lib/jwt";

const TOKEN_TTL = 86_400; // 24 hours

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }
  if (!process.env.JWT_SECRET) {
    return Response.json({ ok: false, reason: "auth_not_configured" }, { status: 503 });
  }

  let body: { agent_name?: string; agent_secret?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const { agent_name, agent_secret } = body;
  if (!agent_name)   return Response.json({ ok: false, reason: "agent_name required" },   { status: 400 });
  if (!agent_secret) return Response.json({ ok: false, reason: "agent_secret required" }, { status: 400 });

  const res = await fetch(
    sbUrl(`client_agents?name=eq.${encodeURIComponent(agent_name)}&active=eq.true&select=name,agent_secret_hash&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return Response.json({ ok: false, reason: "lookup_failed" }, { status: 500 });

  const rows  = await res.json() as { name: string; agent_secret_hash: string | null }[];
  const agent = rows[0];

  if (!agent) {
    return Response.json({ ok: false, reason: "agent_not_found" }, { status: 404 });
  }
  if (!agent.agent_secret_hash) {
    return Response.json({ ok: false, reason: "agent_has_no_secret_configured" }, { status: 403 });
  }

  const hash = await hashAgentSecret(agent_name, agent_secret);
  if (hash !== agent.agent_secret_hash) {
    return Response.json({ ok: false, reason: "invalid_credentials" }, { status: 401 });
  }

  const token = await signJwt({ sub: agent_name, tier: "verified-client" }, TOKEN_TTL);
  return Response.json({ ok: true, token, expires_in: TOKEN_TTL });
}
