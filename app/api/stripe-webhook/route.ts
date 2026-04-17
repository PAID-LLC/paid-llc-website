import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// ── Stripe signature verification ─────────────────────────────────────────────
// Verifies the webhook came from Stripe using HMAC-SHA256.
// Uses Web Crypto API (available on Cloudflare edge runtime).

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const t   = signature.split(",").find((p) => p.startsWith("t="))?.slice(2);
  const v1  = signature.split(",").find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  // Decode the expected signature from hex to bytes.
  // If the v1 string is malformed, reject immediately.
  let v1Bytes: Uint8Array<ArrayBuffer>;
  try {
    const matches = v1.match(/.{2}/g)!;
    const buf = new ArrayBuffer(matches.length);
    const view = new Uint8Array(buf);
    matches.forEach((b, i) => { view[i] = parseInt(b, 16); });
    v1Bytes = view;
  } catch {
    return false; // malformed hex in stripe-signature header
  }

  // crypto.subtle.verify() is constant-time — prevents timing attacks that could
  // leak the valid signature one byte at a time via response latency differences.
  return crypto.subtle.verify(
    "HMAC",
    key,
    v1Bytes,
    encoder.encode(`${t}.${payload}`)
  );
}

// ── MailerLite subscriber ─────────────────────────────────────────────────────

async function subscribeToMailerLite(session: {
  customer_details?: { name?: string | null; email?: string | null };
  metadata?: Record<string, string>;
}) {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return;

  const email = session.customer_details?.email;
  if (!email) return;

  const name = session.customer_details?.name ?? undefined;
  const product = session.metadata?.product ?? undefined;

  await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      fields: {
        ...(name ? { name } : {}),
        ...(product ? { last_purchased_product: product } : {}),
      },
      groups: ["181734452887553984"],
    }),
  }).catch((err) => console.error("[webhook] MailerLite subscribe failed:", err));
}

import { productTitles } from "@/lib/products";
import { issueSouvenir } from "@/lib/souvenirs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

// ── Customer delivery email ───────────────────────────────────────────────────

async function sendDeliveryEmail(
  session: {
    id: string;
    customer_details?: { name?: string | null; email?: string | null };
    metadata?: Record<string, string>;
  },
  souvenirToken?: string
) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const email = session.customer_details?.email;
  if (!email) return;

  const name    = session.customer_details?.name ?? "there";
  const slug    = session.metadata?.product ?? "";
  const title   = productTitles[slug] ?? "Your Guide";
  const link    = `${SITE_URL}/download/${slug}?session_id=${session.id}`;

  const souvenirLine = souvenirToken
    ? [``, `You've also earned a digital souvenir. View it here:`, ``, `${SITE_URL}/the-latent-space/souvenirs/${souvenirToken}`]
    : [];

  const text = [
    `Hi ${name},`,
    ``,
    `Thank you for purchasing ${title}.`,
    ``,
    `Your download link is below. You can use it any time to re-download your guide:`,
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
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PAID LLC <hello@paiddev.com>",
      to: [email],
      subject: `Your download: ${title}`,
      text,
    }),
  }).catch((err) => console.error("[webhook] Delivery email failed:", err));
}

// ── Purchase notification email ───────────────────────────────────────────────

async function sendPurchaseNotification(session: {
  id: string;
  amount_total: number | null;
  customer_details?: { name?: string | null; email?: string | null };
  metadata?: Record<string, string>;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const name   = session.customer_details?.name  ?? "Unknown";
  const email  = session.customer_details?.email ?? "Unknown";
  const amount = session.amount_total != null
    ? `$${(session.amount_total / 100).toFixed(2)}`
    : "Unknown";
  const product = session.metadata?.product ?? "Digital guide";

  const text = [
    `New sale on PAID LLC!`,
    ``,
    `Customer: ${name}`,
    `Email:    ${email}`,
    `Amount:   ${amount}`,
    `Product:  ${product}`,
    `Session:  ${session.id}`,
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PAID LLC <notifications@paiddev.com>",
      to: ["travis@paiddev.com"],
      subject: `New sale: ${product} - ${amount}`,
      text,
    }),
  }).catch((err) => console.error("[webhook] Resend notification failed:", err));
}

async function issuePurchaseSouvenirs(session: {
  id: string;
  customer_details?: { name?: string | null };
  metadata?: Record<string, string>;
}): Promise<string | null> {
  const displayName = session.customer_details?.name ?? "Anonymous Agent";
  const slug        = session.metadata?.product ?? "";

  // Count existing purchase-token claims to determine tier eligibility
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  let totalPurchases = 999;

  if (url && key) {
    const countRes = await fetch(
      `${url}/rest/v1/souvenir_claims?souvenir_id=eq.purchase-token&select=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }
    ).catch(() => null);
    if (countRes?.ok) {
      const rows = await countRes.json() as unknown[];
      totalPurchases = rows.length;
    }
  }

  const tasks: Promise<string | null>[] = [
    issueSouvenir("purchase-token", displayName, session.id),
  ];
  if (totalPurchases < 100) tasks.push(issueSouvenir("early-adopter", displayName, session.id));
  if (totalPurchases < 10)  tasks.push(issueSouvenir("genesis-key",   displayName, session.id));
  if (slug === "all-guides-bundle") tasks.push(issueSouvenir("all-access", displayName, session.id));

  const tokens = await Promise.all(tasks);
  return tokens[0]; // purchase-token token for email inclusion
}

// ── Catalog sale logging + seller credit (commission) ─────────────────────────

async function recordCatalogSale(session: {
  id: string;
  amount_total: number | null;
  metadata?: Record<string, string>;
}): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  // Only process UCP purchases that reference a Bazaar catalog item
  if (session.metadata?.source !== "ucp_purchase") return;
  const rawId = session.metadata?.catalog_item_id;
  if (!rawId) return;
  const catalogItemId = Number(rawId);
  if (!catalogItemId) return;

  // Look up commission percentages for this catalog item
  const catRes = await fetch(
    `${url}/rest/v1/agent_catalog?id=eq.${catalogItemId}&select=agent_name,platform_fee_percent,seller_earn_percent&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } }
  ).catch(() => null);
  if (!catRes?.ok) return;

  const rows = await catRes.json() as { agent_name: string; platform_fee_percent: number; seller_earn_percent: number }[];
  const cat = rows[0];
  if (!cat) return;

  const amountCents     = session.amount_total ?? 0;
  const platformFee     = Math.round(amountCents * (cat.platform_fee_percent / 100));
  const sellerEarn      = amountCents - platformFee;

  // Log the sale with fee split
  await fetch(`${url}/rest/v1/agent_catalog_sales`, {
    method:  "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      catalog_item_id:    catalogItemId,
      buyer_agent:        session.metadata?.agent_name ?? null,
      amount_cents:       amountCents,
      platform_fee_cents: platformFee,
      seller_earn_cents:  sellerEarn,
      stripe_session_id:  session.id,
      status:             "completed",
    }),
  }).catch((err) => console.error("[webhook] catalog sale log failed:", err));

  // Credit seller's latent_credits balance (USD sale → credits as proxy earnings)
  if (sellerEarn > 0) {
    await fetch(`${url}/rest/v1/rpc/credit_seller`, {
      method:  "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ p_agent_name: cat.agent_name, p_amount: sellerEarn }),
    }).catch((err) => console.error("[webhook] credit_seller failed:", err));
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] STRIPE_WEBHOOK_SECRET not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await req.text();

  const valid = await verifyStripeSignature(payload, signature, secret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as { type: string; data: { object: Parameters<typeof sendPurchaseNotification>[0] } };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta    = (session as { metadata?: Record<string, string> }).metadata ?? {};

    // ── Credit pack purchase — deliver credits, skip guide delivery flow ──
    if (meta.product_type === "credit_pack") {
      const agentName  = meta.agent_name ?? (session as { client_reference_id?: string }).client_reference_id ?? "";
      const creditAmt  = parseInt(meta.credit_amount ?? "0", 10);
      if (agentName && creditAmt > 0) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;
        if (url && key) {
          await fetch(`${url}/rest/v1/rpc/credit_seller`, {
            method:  "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body:    JSON.stringify({ p_agent_name: agentName, p_amount: creditAmt }),
          }).catch((err) => console.error("[webhook] credit_seller (pack) failed:", err));
        }
      }
      return NextResponse.json({ received: true });
    }

    const souvenirToken = await issuePurchaseSouvenirs(session);
    await Promise.all([
      sendPurchaseNotification(session),
      sendDeliveryEmail(session, souvenirToken ?? undefined),
      subscribeToMailerLite(session),
      recordCatalogSale(session),
    ]);
  }

  return NextResponse.json({ received: true });
}
