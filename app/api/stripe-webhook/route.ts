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
        ...(product === "founding-member" ? { is_founding_member: "true" } : {}),
      },
      groups: ["181734452887553984"],
    }),
  }).catch((err) => console.error("[webhook] MailerLite subscribe failed:", err));
}

import { productTitles } from "@/lib/products";
import { issueSouvenir } from "@/lib/souvenirs";
import { bumpCounter }   from "@/lib/usage-guard";
import { recordSale, markProvisioned } from "@/lib/ledger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

// ── Customer delivery email ───────────────────────────────────────────────────

async function sendDeliveryEmail(
  session: {
    id: string;
    customer_details?: { name?: string | null; email?: string | null };
    metadata?: Record<string, string>;
  },
  souvenirToken?: string
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const email = session.customer_details?.email;
  if (!email) return false;

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

  const res = await fetch("https://api.resend.com/emails", {
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
  }).catch((err) => {
    console.error("[webhook] Delivery email failed:", err);
    return null;
  });
  return !!res?.ok;
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

// ── Transaction verification — flip has_transaction on first real purchase ────

async function markAgentVerified(agentName: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !agentName) return;
  await fetch(
    `${url}/rest/v1/latent_registry?agent_name=eq.${encodeURIComponent(agentName)}`,
    {
      method:  "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body:    JSON.stringify({ has_transaction: true }),
    }
  ).catch(() => { /* non-blocking */ });
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

  // Mark the buyer agent as transaction-verified (Sybil defense).
  // Awaited — Cloudflare edge kills fire-and-forget promises.
  const buyerAgent = session.metadata?.agent_name;
  if (buyerAgent) await markAgentVerified(buyerAgent);
}

// ── Webhook idempotency ───────────────────────────────────────────────────────
// Attempts to INSERT the event_id into processed_webhooks.
// Returns true if the event is new (we should process it).
// Returns false if the event was already processed (skip it).
// Requires: CREATE TABLE processed_webhooks (event_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return true; // fail open — better to double-send than miss

  const res = await fetch(`${url}/rest/v1/processed_webhooks`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ event_id: eventId }),
  }).catch(() => null);

  if (!res) return true;        // network error — fail open
  if (res.status === 201) return true;   // inserted — we own this event
  if (res.status === 409) return false;  // duplicate — already processed
  return true;                           // unexpected status — fail open
}

// ── Webhook failure logging ───────────────────────────────────────────────────

async function logWebhookFailure(req: NextRequest, reason: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  await fetch(`${url}/rest/v1/webhook_failures`, {
    method:  "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body:    JSON.stringify({ reason, ip: ip.slice(0, 45), ua: (req.headers.get("user-agent") ?? "").slice(0, 200) }),
  }).catch(() => { /* non-blocking — never let logging break the response path */ });
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
    void logWebhookFailure(req, "missing_signature");
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await req.text();

  const valid = await verifyStripeSignature(payload, signature, secret);
  if (!valid) {
    void logWebhookFailure(req, "invalid_signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Parameters<typeof sendPurchaseNotification>[0] } };

  // ── Refunds → ledger refund row (subtracted from revenue in reporting) ──
  // NOTE: the Stripe webhook endpoint must subscribe to charge.refunded in
  // the Stripe dashboard (Developers > Webhooks > add event) or this never fires.
  if (event.type === "charge.refunded") {
    if (!(await claimWebhookEvent(event.id))) return NextResponse.json({ received: true });
    const charge = event.data.object as unknown as {
      id: string; amount_refunded?: number;
      billing_details?: { email?: string | null };
      metadata?: Record<string, string>;
    };
    await recordSale({
      source:              "stripe",
      event_type:          "refund",
      // One row per charge; a later full refund after a partial one is a known
      // limitation (external_id dedupe) — metadata keeps the cumulative amount.
      external_id:         `refund:${charge.id}`,
      gross_cents:         charge.amount_refunded ?? 0,
      fee_cents:           0,
      product_slug:        charge.metadata?.product,
      customer_email:      charge.billing_details?.email ?? undefined,
      provisioning_status: "n/a",
      provisioning_detail: "refund issued via Stripe",
      metadata:            { amount_refunded: charge.amount_refunded ?? 0 },
    });
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    if (!(await claimWebhookEvent(event.id))) {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object;
    const meta    = (session as { metadata?: Record<string, string> }).metadata ?? {};

    // ── Credit pack purchase — deliver credits, skip guide delivery flow ──
    if (meta.product_type === "credit_pack") {
      const agentName  = meta.agent_name ?? (session as { client_reference_id?: string }).client_reference_id ?? "";
      const creditAmt  = parseInt(meta.credit_amount ?? "0", 10);
      const amountCents = (session as { amount_total?: number }).amount_total ?? 0;
      if (agentName && creditAmt > 0) {
        let credited = false;
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY;
        if (url && key) {
          const rpcRes = await fetch(`${url}/rest/v1/rpc/credit_seller`, {
            method:  "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body:    JSON.stringify({ p_agent_name: agentName, p_amount: creditAmt }),
          }).catch((err) => {
            console.error("[webhook] credit_seller (pack) failed:", err);
            return null;
          });
          credited = !!rpcRes?.ok;
        }
        // Revenue accounting for /api/econ/status — revenue vs token expense.
        await Promise.all([
          amountCents > 0 ? bumpCounter("credit_revenue_cents", amountCents) : Promise.resolve(),
          bumpCounter("credits_sold", creditAmt),
          markAgentVerified(agentName),
          recordSale({
            source:              "stripe",
            event_type:          "credit_pack",
            external_id:         session.id,
            gross_cents:         amountCents,
            agent_name:          agentName,
            product_name:        `${creditAmt} Latent Credits`,
            provisioning_status: credited ? "delivered" : "failed",
            provisioning_detail: credited ? "credits granted" : "credit_seller RPC failed",
          }),
        ]);
      }
      return NextResponse.json({ received: true });
    }

    // ── Guide / bazaar sale — ledger row first, provisioning result after ──
    const isBazaar = meta.source === "ucp_purchase";
    const slug     = meta.product ?? "";
    await recordSale({
      source:         "stripe",
      event_type:     isBazaar ? "bazaar_sale" : "guide_sale",
      external_id:    session.id,
      gross_cents:    (session as { amount_total?: number }).amount_total ?? 0,
      product_slug:   slug || (meta.catalog_item_id ? `catalog:${meta.catalog_item_id}` : undefined),
      product_name:   productTitles[slug] ?? meta.product_name,
      customer_email: session.customer_details?.email ?? undefined,
      agent_name:     meta.agent_name,
    });

    const souvenirToken = await issuePurchaseSouvenirs(session);
    const [, delivered] = await Promise.all([
      sendPurchaseNotification(session),
      sendDeliveryEmail(session, souvenirToken ?? undefined),
      subscribeToMailerLite(session),
      recordCatalogSale(session),
    ]);
    await markProvisioned(
      session.id,
      delivered ? "delivered" : "failed",
      delivered ? "delivery email sent" : "delivery email failed — redeliver from admin"
    );
  }

  return NextResponse.json({ received: true });
}
