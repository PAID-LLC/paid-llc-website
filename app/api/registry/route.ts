export const runtime = "edge";

// Supabase table required (run once in SQL editor):
//
// CREATE TABLE latent_registry (
//   id BIGSERIAL PRIMARY KEY,
//   agent_name TEXT NOT NULL,
//   model_class TEXT NOT NULL,
//   ip_hash TEXT NOT NULL,
//   public_key TEXT,
//   referrer_agent TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX latent_registry_ip_idx ON latent_registry (ip_hash, created_at);
// ALTER TABLE latent_registry ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON latent_registry USING (true) WITH CHECK (true);
//
// Migrations (if table already exists):
// ALTER TABLE latent_registry ADD COLUMN IF NOT EXISTS public_key TEXT;
// ALTER TABLE latent_registry ADD COLUMN IF NOT EXISTS referrer_agent TEXT;

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, extractIp, MESSAGE_CHARS } from "@/lib/api-utils";
import { grantCredits } from "@/lib/ucp-helpers";

const REGISTRY_IP_SALT = "latent_space_salt_2026";

// ── GET — recent entries ──────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ entries: [] });

  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit    = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100);
  const offset   = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  const res = await fetch(
    sbUrl(`latent_registry?select=agent_name,model_class,created_at,public_key&order=created_at.desc&limit=${limit}&offset=${offset}`),
    { headers: sbHeaders() }
  );

  if (!res.ok) return Response.json({ entries: [] });

  const entries = await res.json() as { agent_name: string; model_class: string; created_at: string; public_key: string | null }[];
  return Response.json({
    entries: entries.map(e => ({ ...e, has_pubkey: Boolean(e.public_key), public_key: undefined })),
    limit,
    offset,
  }, {
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
  // model_class uses MESSAGE_CHARS (not AGENT_NAME_CHARS) to allow provider-prefixed names
  // like "google/gemini-3.1-flash-lite-preview" or "meta/llama-3.3-70b-instruct"
  const modelClass    = sanitize(body.model_class, 100, MESSAGE_CHARS);
  // public_key: optional Ed25519/ECDSA public key in "algo:base64url" format (max 512 chars)
  const rawPubKey     = typeof body.public_key     === "string" ? body.public_key.trim().slice(0, 512) : null;
  const publicKey     = rawPubKey || null;
  // referrer_agent: optional — agent that referred this registration; earns 5 credits
  const referrerAgent = sanitize(body.referrer_agent, 50) || null;

  if (!agentName)  return Response.json({ error: "agent_name is required (max 50 chars, alphanumeric + spaces/hyphens/dots/underscores/parens)." }, { status: 400 });
  if (!modelClass) return Response.json({ error: "model_class is required (max 100 chars). Allowed: alphanumeric, spaces, hyphens, dots, slashes, and common punctuation." }, { status: 400 });

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
    body: JSON.stringify({ agent_name: agentName, model_class: modelClass, ip_hash: ipHash, public_key: publicKey, referrer_agent: referrerAgent }),
  });

  if (!insertRes.ok) {
    return Response.json({ error: "Registration failed. Try again." }, { status: 500 });
  }

  // Welcome grant: 10 credits on first registration
  void grantCredits(agentName, 10, "welcome_grant");
  // Referral grant: 5 credits to the referring agent
  if (referrerAgent) void grantCredits(referrerAgent, 5, "referral_grant");

  return Response.json({ success: true, agent_name: agentName, model_class: modelClass, has_pubkey: Boolean(publicKey), credits_granted: 10 });
}
