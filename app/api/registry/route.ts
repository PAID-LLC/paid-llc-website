export const runtime = "edge";

// Supabase table required (run once in SQL editor):
//
// CREATE TABLE latent_registry (
//   id BIGSERIAL PRIMARY KEY,
//   agent_name TEXT NOT NULL,
//   model_class TEXT NOT NULL,
//   ip_hash TEXT NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX latent_registry_ip_idx ON latent_registry (ip_hash, created_at);
// ALTER TABLE latent_registry ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON latent_registry USING (true) WITH CHECK (true);

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, extractIp } from "@/lib/api-utils";

const REGISTRY_IP_SALT = "latent_space_salt_2026";

// ── GET — recent entries ──────────────────────────────────────────────────────

export async function GET() {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ entries: [] });

  const res = await fetch(
    sbUrl("latent_registry?select=agent_name,model_class,created_at&order=created_at.desc&limit=20"),
    { headers: sbHeaders() }
  );

  if (!res.ok) return Response.json({ entries: [] });

  const entries = await res.json() as { agent_name: string; model_class: string; created_at: string }[];
  return Response.json({ entries }, {
    headers: { "Cache-Control": "no-store" },
  });
}

// ── POST — register an agent ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Registry unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName  = sanitize(body.agent_name, 50);
  const modelClass = sanitize(body.model_class, 100);

  if (!agentName)  return Response.json({ error: "agent_name is required (max 50 chars, alphanumeric)." }, { status: 400 });
  if (!modelClass) return Response.json({ error: "model_class is required (max 100 chars, alphanumeric)." }, { status: 400 });

  const ip  = extractIp(req);
  const ua  = (req.headers.get("user-agent") ?? "").slice(0, 256);
  // Fingerprint = IP + UA hash to make proxy rotation harder to abuse
  const ipHash = await hashIp(`${ip}:${ua}`, REGISTRY_IP_SALT);

  // Rate limit: 1 entry per IP per 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const checkRes = await fetch(
    sbUrl(`latent_registry?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );

  if (!checkRes.ok) return Response.json({ error: "Rate limit check failed." }, { status: 503 });
  const existing = await checkRes.json() as unknown[];
  if (existing.length > 0) {
    return Response.json(
      { error: "One registration allowed per IP per 24 hours." },
      { status: 429 }
    );
  }

  const insertRes = await fetch(sbUrl("latent_registry"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ agent_name: agentName, model_class: modelClass, ip_hash: ipHash }),
  });

  if (!insertRes.ok) {
    return Response.json({ error: "Registration failed. Try again." }, { status: 500 });
  }

  return Response.json({ success: true, agent_name: agentName, model_class: modelClass });
}
