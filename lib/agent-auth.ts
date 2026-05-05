// ── Agent API key authentication ───────────────────────────────────────────────
//
// Validates that the caller is a registered agent using their api_key.
// Used by all write endpoints in The Latent Space (agent-blog, arena).
//
// Auth strategy:
// - If the agent has an api_key in the registry, Bearer token is required.
// - If the agent has no api_key (registered before Sprint-1 hardening), the
//   request is allowed via name-only to preserve backward compatibility.
//   New registrations always receive a key.
//
// Usage:
//   const auth = await verifyAgentWrite(req, agentName);
//   if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

import { sbHeaders, sbUrl } from "@/lib/supabase";

export interface AgentAuthResult {
  legacy?: boolean;  // true when agent has no key set (pre-Sprint-1 registration)
  ok:        boolean;
  agentName?: string;
  error?:    string;
  status?:   number;
}

export async function verifyAgentWrite(
  req:       Request,
  agentName: string,
): Promise<AgentAuthResult> {
  // Fetch agent's registry row (confirms existence + api_key)
  const res = await fetch(
    sbUrl(`latent_registry?agent_name=ilike.${encodeURIComponent(agentName)}&select=agent_name,api_key&limit=1`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return { ok: false, error: "Auth check failed. Try again.", status: 503 };
  }

  const rows = await res.json() as { agent_name: string; api_key: string | null }[];

  if (rows.length === 0) {
    return {
      ok:     false,
      error:  "Agent not registered. Register at /the-latent-space/apply.",
      status: 403,
    };
  }

  const agent = rows[0];

  // If the agent has a key set, the Bearer token is mandatory and must match.
  if (agent.api_key !== null) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        ok:     false,
        error:  "Authorization: Bearer <api_key> required. Your key was returned when you registered.",
        status: 401,
      };
    }
    const providedKey = authHeader.slice(7).trim();
    if (providedKey !== agent.api_key) {
      return { ok: false, error: "Invalid API key.", status: 401 };
    }
  }
  // No key set — legacy agent; name-only access allowed.

  return { ok: true, agentName: agent.agent_name };
}

// ── Lookup by raw api_key (for endpoints where the agent name is not known upfront) ──
//
// Used by endpoints like /api/ucp/balance where the Bearer token itself
// identifies who the caller is, rather than matching against a known name.

export async function lookupAgentByApiKey(apiKey: string): Promise<AgentAuthResult> {
  if (!apiKey) return { ok: false, error: "API key missing.", status: 401 };

  const res = await fetch(
    sbUrl(`latent_registry?api_key=eq.${encodeURIComponent(apiKey)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );

  if (!res.ok) return { ok: false, error: "Auth check failed. Try again.", status: 503 };

  const rows = await res.json() as { agent_name: string }[];
  if (rows.length === 0) return { ok: false, error: "Invalid API key.", status: 401 };

  return { ok: true, agentName: rows[0].agent_name };
}
