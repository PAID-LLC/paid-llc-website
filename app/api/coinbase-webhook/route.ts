export const runtime = "edge";

// ── POST /api/coinbase-webhook ─────────────────────────────────────────────────
// Handles Coinbase CDP Business checkout.payment.success events.
// Signature verified via X-CC-Webhook-Signature (HMAC-SHA256 of raw body).
//
// Handles:
//   product_type = "credit_pack"   → credits agent via credit_seller RPC
//   product_type = "digital_guide" → sends download email + issues souvenirs
//
// Requires env vars:
//   COINBASE_WEBHOOK_SECRET — from Coinbase CDP webhook settings
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY (existing)

import { productTitles } from "@/lib/products";
import { issueSouvenir } from "@/lib/souvenirs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const mac      = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const computed = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (computed.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

async function creditAgent(agentName: string, creditAmount: number): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !agentName || creditAmount <= 0) return;

  await fetch(`${url}/rest/v1/rpc/credit_seller`, {
    method:  "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ p_agent_name: agentName, p_amount: creditAmount }),
  }).catch(() => {});
}

async function sendGuideEmail(email: string, slug: string, checkoutId: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const title = productTitles[slug];
  if (!title) return;

  const link = `${SITE_URL}/download/${slug}?session_id=${checkoutId}`;

  // Count purchases for souvenir tier eligibility
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  let totalPurchases = 999;
  if (sbUrl && sbKey) {
    const countRes = await fetch(
      `${sbUrl}/rest/v1/souvenir_claims?souvenir_id=eq.purchase-token&select=id`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" } }
    ).catch(() => null);
    if (countRes?.ok) {
      const rows = await countRes.json() as unknown[];
      totalPurchases = rows.length;
    }
  }

  const tasks: Promise<string | null>[] = [issueSouvenir("purchase-token", email, checkoutId)];
  if (totalPurchases < 100) tasks.push(issueSouvenir("early-adopter", email, checkoutId));
  if (totalPurchases < 10)  tasks.push(issueSouvenir("genesis-key",   email, checkoutId));

  const tokens        = await Promise.all(tasks);
  const souvenirToken = tokens[0];

  const souvenirLine = souvenirToken
    ? [``, `You've also earned a digital souvenir:`, ``, `${SITE_URL}/the-latent-space/souvenirs/${souvenirToken}`]
    : [];

  const text = [
    `Hi there,`,
    ``,
    `Thank you for purchasing ${title}.`,
    ``,
    `Your download link:`,
    ``,
    link,
    ...souvenirLine,
    ``,
    `Questions? Reply to this email or reach us at hello@paiddev.com.`,
    ``,
    `-- Travis`,
    `PAID LLC`,
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      from:    "PAID LLC <hello@paiddev.com>",
      to:      [email],
      subject: `Your download: ${title}`,
      text,
    }),
  }).catch(() => {});
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const secret = process.env.COINBASE_WEBHOOK_SECRET;
  if (!secret) {
    // Return 200 silently until env var is provisioned (prevents noisy 503s during setup)
    return Response.json({ received: true });
  }

  const signature = req.headers.get("x-cc-webhook-signature") ?? "";
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await req.text();
  const valid   = await verifySignature(payload, signature, secret);
  if (!valid) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  type CdpEvent = {
    id?:        string;
    eventType?: string;
    metadata?:  Record<string, string>;
  };

  let body: CdpEvent;
  try { body = JSON.parse(payload) as CdpEvent; }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  if (body.eventType === "checkout.payment.success") {
    const meta = body.metadata ?? {};
    const id   = body.id ?? "";

    if (meta.product_type === "credit_pack") {
      const agentName    = meta.agent_name    ?? "";
      const creditAmount = parseInt(meta.credit_amount ?? "0", 10);
      await creditAgent(agentName, creditAmount);
    }

    if (meta.product_type === "digital_guide") {
      const email = meta.customer_email ?? "";
      const slug  = meta.product_slug   ?? "";
      if (email && slug) await sendGuideEmail(email, slug, id);
    }
  }

  return Response.json({ received: true });
}
