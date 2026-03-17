export const runtime = "edge";

// Supabase table required — run in Supabase SQL editor:
//
// CREATE TABLE souvenir_claims (
//   id           BIGSERIAL PRIMARY KEY,
//   souvenir_id  TEXT        NOT NULL,
//   token        TEXT        NOT NULL UNIQUE,
//   display_name TEXT,
//   ip_hash      TEXT        NOT NULL,
//   proof_type   TEXT        NOT NULL,  -- 'visit' | 'registry' | 'purchase' | 'bundle' | 'server'
//   proof_ref    TEXT,                  -- Stripe session_id, registry entry id, etc.
//   created_at   TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX souvenir_claims_token_idx   ON souvenir_claims (token);
// CREATE INDEX souvenir_claims_ip_idx      ON souvenir_claims (souvenir_id, ip_hash);
// CREATE INDEX souvenir_claims_souvenir_idx ON souvenir_claims (souvenir_id);
// ALTER TABLE souvenir_claims ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON souvenir_claims USING (true) WITH CHECK (true);

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, extractIp } from "@/lib/api-utils";
import { getSouvenir } from "@/lib/souvenirs";

const SOUVENIR_IP_SALT = "souvenir_salt_2026";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Service unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const souvenirId  = sanitize(body.souvenir_id, 50);
  const displayName = sanitize(body.display_name, 60) ?? "Anonymous Agent";
  const proofType   = sanitize(body.proof_type, 20);
  const proofRef    = sanitize(body.proof_ref, 200) ?? null;

  if (!souvenirId)  return Response.json({ error: "souvenir_id required." }, { status: 400 });
  if (!proofType)   return Response.json({ error: "proof_type required." }, { status: 400 });

  const souvenir = getSouvenir(souvenirId);
  if (!souvenir) return Response.json({ error: "Unknown souvenir." }, { status: 404 });

  // Verify proof for purchase/bundle triggers
  if (proofType === "purchase" || proofType === "bundle") {
    if (!proofRef) return Response.json({ error: "proof_ref (session_id) required." }, { status: 400 });
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const sRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(proofRef)}`,
        { headers: { Authorization: `Bearer ${stripeKey}` } }
      );
      if (!sRes.ok) return Response.json({ error: "Could not verify purchase." }, { status: 400 });
      const session = await sRes.json() as { payment_status: string };
      if (session.payment_status !== "paid")
        return Response.json({ error: "Purchase not completed." }, { status: 400 });
    }
  }

  const ip     = extractIp(req);
  const ipHash = await hashIp(ip, SOUVENIR_IP_SALT);

  // Check if this IP already claimed this souvenir (skip for server-issued)
  if (proofType !== "server") {
    const existCheck = await fetch(
      sbUrl(`souvenir_claims?souvenir_id=eq.${encodeURIComponent(souvenirId)}&ip_hash=eq.${ipHash}&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    if (existCheck.ok) {
      const existing = await existCheck.json() as unknown[];
      if (existing.length > 0)
        return Response.json({ error: "Already claimed." }, { status: 409 });
    }
  }

  // Check quantity limit
  if (souvenir.maxQuantity !== null) {
    const countRes = await fetch(
      sbUrl(`souvenir_claims?souvenir_id=eq.${encodeURIComponent(souvenirId)}&select=id`),
      { headers: sbHeaders() }
    );
    if (countRes.ok) {
      const rows = await countRes.json() as unknown[];
      if (rows.length >= souvenir.maxQuantity)
        return Response.json({ error: "Sold out. No more of this souvenir remain." }, { status: 410 });
    }
  }

  // Generate token and insert
  const token = crypto.randomUUID();
  const insertRes = await fetch(sbUrl("souvenir_claims"), {
    method:  "POST",
    headers: sbHeaders(),
    body:    JSON.stringify({ souvenir_id: souvenirId, token, display_name: displayName, ip_hash: ipHash, proof_type: proofType, proof_ref: proofRef }),
  });

  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => "unknown");
    return Response.json({ error: "Claim failed.", detail }, { status: 500 });
  }

  return Response.json({
    success:     true,
    token,
    souvenir_id: souvenirId,
    display_url: `${SITE_URL}/the-latent-space/souvenirs/${token}`,
  });
}
