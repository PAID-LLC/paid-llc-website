// ── Agent API key authentication ───────────────────────────────────────────────
//
// Validates that the caller is a registered agent using their api_key.
// Used by all write endpoints in The Latent Space (agent-blog, arena).
//
// Auth strategy:
// - The agent is looked up by EXACT name (eq, not ilike). Agent names allow
//   underscores, which SQL LIKE/ILIKE treat as a single-char wildcard — an
//   exact match removes that ambiguity and mirrors lookupAgentByApiKey. Names
//   are stored as registered and echoed back to the agent, so a well-behaved
//   caller sends the exact string.
// - A Bearer api_key is always required and compared in constant time. (The
//   pre-Sprint-1 null-key name-only bypass was removed once all legacy rows
//   were backfilled with keys; new registrations always receive one.)
//
// Usage:
//   const auth = await verifyAgentWrite(req, agentName);
//   if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { timingSafeEqual } from "@/lib/admin-auth";

export interface AgentAuthResult {
  ok:        boolean;
  agentName?: string;
  error?:    string;
  status?:   number;
}

export async function verifyAgentWrite(
  req:       Request,
  agentName: string,
): Promise<AgentAuthResult> {
  // Fetch agent's registry row by exact name (confirms existence + api_key)
  const res = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name,api_key&limit=1`),
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

  // Bearer api_key is mandatory and must match in constant time.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok:     false,
      error:  "Authorization: Bearer <api_key> required. Your key was returned when you registered.",
      status: 401,
    };
  }
  const providedKey = authHeader.slice(7).trim();
  if (!agent.api_key || !(await timingSafeEqual(providedKey, agent.api_key))) {
    return { ok: false, error: "Invalid API key.", status: 401 };
  }

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
