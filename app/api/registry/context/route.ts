export const runtime = "edge";

// ── Agent procurement context ──────────────────────────────────────────────
//
// Stateful per-agent preferences: spend authority, budget ceiling, vendor
// rules, interests. Returning agents (or their operators) store context once;
// commerce flows can then honor it without re-negotiating every session.
//
// Supabase table required (run once in SQL editor):
//
// CREATE TABLE latent_context (
//   agent_name TEXT PRIMARY KEY,
//   spend_authority TEXT,            -- e.g. "autonomous_under_ceiling" | "ask_first"
//   budget_ceiling NUMERIC,          -- max credits/USD per transaction
//   vendor_rules TEXT,               -- free-text constraints, max 1000 chars
//   interests TEXT[],                -- topic tags for recommendations
//   updated_at TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE latent_context ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON latent_context USING (true) WITH CHECK (true);
//
// Until the table exists this route returns 503; nothing else depends on it.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { verifyAgentWrite } from "@/lib/agent-auth";
import { sanitize } from "@/lib/api-utils";

const SPEND_AUTHORITIES = ["autonomous_under_ceiling", "ask_first", "read_only"];

// ── GET ?agent_name=X — read your own context (Bearer key required) ───────

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const agentName = sanitize(searchParams.get("agent_name") ?? "", 64);
  if (!agentName) {
    return Response.json({ error: "agent_name required" }, { status: 400 });
  }

  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const res = await fetch(
    sbUrl(`latent_context?agent_name=ilike.${encodeURIComponent(agentName)}&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    return Response.json({ error: "Context store unavailable" }, { status: 503 });
  }

  const rows = await res.json() as Record<string, unknown>[];
  return Response.json(
    { context: rows[0] ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// ── POST — create or update context (Bearer key required) ─────────────────

export async function POST(req: Request) {
  if (!supabaseReady()) return Response.json({ error: "Service unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentName = sanitize(String(body.agent_name ?? ""), 64);
  if (!agentName) {
    return Response.json({ error: "agent_name required" }, { status: 400 });
  }

  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const row: Record<string, unknown> = {
    agent_name: agentName,
    updated_at: new Date().toISOString(),
  };

  if (body.spend_authority !== undefined) {
    const sa = String(body.spend_authority);
    if (!SPEND_AUTHORITIES.includes(sa)) {
      return Response.json(
        { error: `spend_authority must be one of: ${SPEND_AUTHORITIES.join(", ")}` },
        { status: 400 }
      );
    }
    row.spend_authority = sa;
  }

  if (body.budget_ceiling !== undefined) {
    const ceiling = Number(body.budget_ceiling);
    if (isNaN(ceiling) || ceiling < 0 || ceiling > 1_000_000) {
      return Response.json({ error: "budget_ceiling must be 0-1000000" }, { status: 400 });
    }
    row.budget_ceiling = ceiling;
  }

  if (body.vendor_rules !== undefined) {
    row.vendor_rules = sanitize(String(body.vendor_rules), 1000);
  }

  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests) || body.interests.length > 10) {
      return Response.json({ error: "interests must be an array of up to 10 tags" }, { status: 400 });
    }
    row.interests = body.interests.map((t) => sanitize(String(t), 40)).filter(Boolean);
  }

  // Upsert keyed on agent_name.
  const res = await fetch(sbUrl("latent_context?on_conflict=agent_name"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    return Response.json({ error: "Context store unavailable" }, { status: 503 });
  }

  const saved = await res.json() as Record<string, unknown>[];
  return Response.json({ ok: true, context: saved[0] ?? row });
}
