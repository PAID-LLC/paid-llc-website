// ── Human shadow identity ────────────────────────────────────────────────────
// A logged-in human IS an agent under the hood. On first sign-in we provision a
// latent_registry row (a "shadow agent") with its own api_key and credit balance,
// so humans ride the exact same escrow rails as autonomous agents. The handle is
// derived deterministically from the email so the same person always maps to the
// same identity, and it leaks no PII (it is a one-way hash, not the address).

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { grantCredits }     from "@/lib/ucp-helpers";

// Welcome grant on first provision: enough for ~1-2 house hires so a new human can
// try the market before buying a pack. Adjust freely; this is the "first hires are
// effectively free" lever. Set to 0 to require a credit purchase up front.
//
// Raised 10 -> 30 (2026-07-25) so the /website-audit storefront converts: the
// Website Audit Brief is the premium anchor at 25cr, and a cold visitor arriving
// from outreach used to sign in and immediately hit a paywall on the exact thing
// the page advertises. 30 covers one audit plus a cheap second hire. The giveaway
// is bounded by the existing daily Gemini budget in lib/usage-guard.ts, so this
// cannot run away on cost.
const HUMAN_WELCOME_CREDITS = 30;

export interface HumanIdentity {
  agentName: string;
  apiKey:    string;
  created:   boolean;
}

/** first 12 hex of sha256(emailLower:JWT_SECRET) — stable, non-reversible handle. */
async function handleFor(emailLower: string): Promise<string> {
  const secret = process.env.JWT_SECRET ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${emailLower}:${secret}`));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `human-${hex.slice(0, 12)}`;
}

/**
 * Find-or-create the shadow identity for an email. Runs with the service key, so
 * it bypasses the public /api/registry per-IP rate limit by design (this is a
 * trusted, post-auth provision, not a self-serve registration).
 */
export async function ensureHumanIdentity(email: string): Promise<HumanIdentity | null> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) return null;
  const agentName = await handleFor(emailLower);

  // Already provisioned?
  const existing = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name,api_key&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (existing?.ok) {
    const rows = (await existing.json()) as { agent_name: string; api_key: string | null }[];
    if (rows[0]?.api_key) {
      return { agentName: rows[0].agent_name, apiKey: rows[0].api_key, created: false };
    }
  }

  // Provision a new shadow row.
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const apiKey   = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const insert = await fetch(sbUrl("latent_registry"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    // Columns kept to the real latent_registry schema. The email is intentionally
    // NOT stored: agentName is a one-way hash of it, so a support lookup recomputes
    // the handle from the email rather than reversing it (no PII at rest).
    body: JSON.stringify({
      agent_name:     agentName,
      model_class:    "human",
      ip_hash:        `human:${agentName}`,   // NOT NULL placeholder; humans are not IP-gated
      api_key:        apiKey,
      email_verified: true,                   // they just proved control of the inbox
    }),
  }).catch(() => null);

  // If the insert raced (unique violation) or failed, re-read once before giving up.
  if (!insert?.ok) {
    const reread = await fetch(
      sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name,api_key&limit=1`),
      { headers: sbHeaders() }
    ).catch(() => null);
    if (reread?.ok) {
      const rows = (await reread.json()) as { agent_name: string; api_key: string | null }[];
      if (rows[0]?.api_key) return { agentName: rows[0].agent_name, apiKey: rows[0].api_key, created: false };
    }
    return null;
  }

  if (HUMAN_WELCOME_CREDITS > 0) {
    await grantCredits(agentName, HUMAN_WELCOME_CREDITS, "human_welcome_grant");
  }
  return { agentName, apiKey, created: true };
}

/** Current credit balance for a shadow (or any) agent_name. */
export async function getBalance(agentName: string): Promise<number> {
  const res = await fetch(
    sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return 0;
  const rows = (await res.json()) as { balance: number }[];
  return rows[0]?.balance ?? 0;
}
