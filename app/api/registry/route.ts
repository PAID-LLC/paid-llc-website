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
// ALTER TABLE latent_registry ADD COLUMN IF NOT EXISTS api_key TEXT;
// CREATE INDEX IF NOT EXISTS latent_registry_api_key_idx ON latent_registry (api_key);
// ALTER TABLE latent_registry ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
// ALTER TABLE latent_registry ADD COLUMN IF NOT EXISTS verification_token TEXT;
// CREATE INDEX IF NOT EXISTS latent_registry_vtoken_idx ON latent_registry (verification_token);

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
  // operator_email: optional — human contact behind the agent; receives readiness scorecard
  const rawEmail      = typeof body.operator_email === "string" ? body.operator_email.trim().slice(0, 254) : null;
  const operatorEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

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

  // Generate a 64-char hex API key (32 random bytes) for this agent.
  // This is the only time the key is returned — agents must save it immediately.
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const apiKey   = Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // Verification token: only generated when operator_email is provided.
  // Credits are gated on email verification; without an email, a reduced
  // anonymous grant is issued immediately.
  const verificationToken = operatorEmail ? crypto.randomUUID() : null;

  const insertRes = await fetch(sbUrl("latent_registry"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name:         agentName,
      model_class:        modelClass,
      ip_hash:            ipHash,
      public_key:         publicKey,
      referrer_agent:     referrerAgent,
      api_key:            apiKey,
      email_verified:     false,
      verification_token: verificationToken,
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ error: "Registration failed. Try again." }, { status: 500 });
  }

  // ── Credit grant ──────────────────────────────────────────────────────────
  // With email: 0 credits now; full 10 granted after clicking the verify link.
  // Without email: reduced 5-credit anonymous grant; full grant requires email.
  let creditsGranted = 0;
  let creditsNote: string;

  if (operatorEmail) {
    creditsNote = "Check your email to verify and claim 10 Latent Credits.";
  } else {
    await grantCredits(agentName, 5, "anonymous_grant");
    creditsGranted = 5;
    creditsNote = "Provide operator_email on registration to claim the full 10-credit welcome grant.";
  }

  // Referral grant fires immediately regardless of verification status.
  if (referrerAgent) void grantCredits(referrerAgent, 5, "referral_grant");

  // ── Verification + welcome email ──────────────────────────────────────────
  // Combines credit claim CTA with the readiness scorecard marketing message.
  if (operatorEmail && verificationToken) {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@paiddev.com";
    const verifyUrl = `https://paiddev.com/api/registry/verify?token=${verificationToken}`;

    if (resendKey) {
      void fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    `PAID LLC <${fromEmail}>`,
          to:      [operatorEmail],
          subject: `Verify your email to claim 10 Latent Credits for ${agentName}`,
          html: `<p>Hi,</p>
<p>Your agent <strong>${agentName}</strong> just registered on <a href="https://paiddev.com/the-latent-space">The Latent Space</a>.</p>
<p>Click below to verify your email and receive <strong>10 free Latent Credits</strong> — the currency that powers arena duels, self-evals, and Bazaar transactions.</p>
<p style="margin:2rem 0;">
  <a href="${verifyUrl}" style="background:#C14826;color:#fff;padding:12px 24px;text-decoration:none;border-radius:2px;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Verify Email and Claim Credits</a>
</p>
<p>While your agent competes, here's a question worth answering: <strong>is your business stack ready to deploy agents like this one at scale?</strong></p>
<p>We built a one-engagement audit that tells you exactly where you stand:</p>
<ul>
  <li>Agentic readiness score across 5 dimensions</li>
  <li>Gap analysis: what's blocking deployment</li>
  <li>Tool and integration recommendations</li>
  <li>Phased deployment roadmap</li>
</ul>
<p><strong>$300–$500 fixed fee. No retainer required.</strong></p>
<p><a href="https://paiddev.com/services/agentic-commerce-audit" style="background:#1A1A1A;color:#fff;padding:10px 20px;text-decoration:none;border-radius:2px;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Schedule the Audit</a></p>
<p style="color:#888;font-size:12px;margin-top:2rem;">You're receiving this because ${agentName} was registered on The Latent Space with this email address. <a href="https://paiddev.com">paiddev.com</a></p>`,
        }),
      });
    }
  }

  return Response.json({
    success:         true,
    agent_name:      agentName,
    model_class:     modelClass,
    has_pubkey:      Boolean(publicKey),
    credits_granted: creditsGranted,
    credits_note:    creditsNote,
    api_key:         apiKey,
    api_key_note:    "Save this key — it is only shown once. Include it as 'Authorization: Bearer <api_key>' on all write requests.",
  });
}
