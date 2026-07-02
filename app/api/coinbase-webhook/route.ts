export const runtime = "edge";

// ── POST /api/coinbase-webhook ─────────────────────────────────────────────────
// Handles Coinbase Business payment-link "payment_link.payment.success" events.
// Signature verified via X-Hook0-Signature (Hook0 HMAC-SHA256 format).
// Payload is flat: eventType, id, status, amount, metadata all at top level.
//
// Handles:
//   product_type = "credit_pack"   → credits agent via credit_seller RPC
//   product_type = "digital_guide" → sends download email + issues souvenirs
//
// Requires env vars:
//   COINBASE_WEBHOOK_SECRET — returned by the webhook subscription creation API
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY (existing)

import { productTitles, slugToFile, CREDIT_PACKS, PRODUCTS } from "@/lib/products";
import { issueSouvenir }    from "@/lib/souvenirs";
import { bumpCounter }      from "@/lib/usage-guard";
import { recordSale }       from "@/lib/ledger";
import { claimCreditGrant } from "@/lib/idempotency";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

// ── Hook0 signature verification ───────────────────────────────────────────────
// Header format: t=1234567890,h=content-type x-other,v1=abc123...
// Signed string: {t}.{h_names}.{h_values}.{body}  (or {t}.{body} if h is empty)

async function verifyHook0Signature(
  payload:  string,
  sigHeader: string,
  headers:  Headers,
  secret:   string
): Promise<boolean> {
  try {
    // Parse header into key=value map
    const parts: Record<string, string> = {};
    for (const part of sigHeader.split(",")) {
      const idx = part.indexOf("=");
      if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }

    const t  = parts["t"];
    const h  = parts["h"] ?? "";
    const v1 = parts["v1"];
    if (!t || !v1) return false;

    // Build the string that was signed
    let signed = t;
    if (h) {
      const names  = h.split(" ").filter(Boolean);
      const values = names.map(n => headers.get(n) ?? "");
      signed += "." + names.join(" ") + "." + values.join(".");
    }
    signed += "." + payload;

    // HMAC-SHA256
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const mac      = await crypto.subtle.sign("HMAC", key, enc.encode(signed));
    const computed = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (computed.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    if (diff !== 0) return false;

    // Replay guard (defense-in-depth on top of processed_webhooks idempotency):
    // reject signed timestamps outside a generous 1h window. ms-normalized so it
    // works whether Hook0 sends seconds or milliseconds.
    let ts = parseInt(t, 10);
    if (!Number.isFinite(ts)) return false;
    if (ts > 1e12) ts = Math.floor(ts / 1000);
    if (Math.abs(Date.now() / 1000 - ts) > 3600) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Webhook idempotency ───────────────────────────────────────────────────────
// Same pattern as stripe-webhook. Requires the processed_webhooks table.

async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return true;

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

  if (!res) return true;
  if (res.status === 201) return true;
  if (res.status === 409) return false;
  return true;
}

// ── Fulfillment helpers ────────────────────────────────────────────────────────

async function creditAgent(agentName: string, creditAmount: number): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !agentName || creditAmount <= 0) return false;

  const res = await fetch(`${url}/rest/v1/rpc/credit_seller`, {
    method:  "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ p_agent_name: agentName, p_amount: creditAmount }),
  }).catch(() => null);
  return !!res?.ok;
}

async function sendGuideEmail(email: string, slug: string, checkoutId: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;

  const title    = productTitles[slug];
  const filename = slugToFile[slug];
  if (!title || !filename) return false;

  // Generate the Supabase signed URL directly — a Coinbase checkout ID is not a
  // Stripe session ID, so the /download page cannot be used here.
  const downloadUrl = await getSignedDownloadUrl(filename);
  if (!downloadUrl) return false;

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
    `Your download link (valid for 1 hour):`,
    ``,
    downloadUrl,
    ...souvenirLine,
    ``,
    `Questions? Reply to this email or reach us at hello@paiddev.com.`,
    ``,
    `-- Travis`,
    `PAID LLC`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      from:    "PAID LLC <hello@paiddev.com>",
      to:      [email],
      subject: `Your download: ${title}`,
      text,
    }),
  }).catch(() => null);
  return !!res?.ok;
}

// ── Supabase signed download URL (shared by the CDP guide-delivery path) ──────

async function getSignedDownloadUrl(filename: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const res = await fetch(
    `${url}/storage/v1/object/sign/guides/${encodeURIComponent(filename)}`,
    {
      method:  "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ expiresIn: 3600 }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const payload = await req.text();

  // Coinbase Commerce was shut down 2026-03-31; its charge:confirmed webhook is
  // no longer a live payment path. Reject any lingering Commerce delivery with
  // 410 Gone rather than processing it. (History: git.)
  if (req.headers.get("x-cc-webhook-signature")) {
    return Response.json({ error: "coinbase commerce retired" }, { status: 410 });
  }

  const secret = process.env.COINBASE_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration — do NOT 200-ack an unverifiable payload (that silently
    // masks the missing secret). 503 signals "not configured", matching the
    // Stripe handler, and lets Coinbase retry once the secret is set.
    return Response.json({ error: "webhook not configured" }, { status: 503 });
  }

  const sigHeader = req.headers.get("x-hook0-signature") ?? "";
  if (!sigHeader) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const valid   = await verifyHook0Signature(payload, sigHeader, req.headers, secret);
  if (!valid) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  type CdpEvent = {
    id?:        string;
    eventType?: string;
    status?:    string;
    amount?:    string;
    metadata?:  Record<string, string>;
  };

  let body: CdpEvent;
  try { body = JSON.parse(payload) as CdpEvent; }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  // Detect a finalized payment robustly. The Business webhook UI subscribes to a
  // "completed" event whose payload carries status "COMPLETED"; the API docs also
  // name a "payment_link.payment.success" eventType. Match either signal, and
  // never match in-flight states (quoted/processing) so we deliver exactly once
  // (idempotency by payment id is the second guard).
  const evt    = (body.eventType ?? "").toLowerCase();
  const status = (body.status ?? "").toUpperCase();
  const isPaid = status === "COMPLETED" || /(^|[._])(completed|success)$/.test(evt);
  if (isPaid) {
    const meta = body.metadata ?? {};
    const id   = body.id ?? "";

    if (id && !(await claimWebhookEvent(`cdp:${id}`))) {
      return Response.json({ received: true });
    }


    // Idempotency keyed on the payment id — even if this event is delivered
    // twice (fail-open window in claimWebhookEvent), credits grant at most once.
    if (meta.product_type === "credit_pack" && (await claimCreditGrant(`cdp:${id}`))) {
      const agentName    = meta.agent_name    ?? "";
      const creditAmount = parseInt(meta.credit_amount ?? "0", 10);
      const credited     = await creditAgent(agentName, creditAmount);
      // Revenue accounting for /api/econ/status (price from pack_id metadata)
      const pack = CREDIT_PACKS.find((p) => p.id === (meta.pack_id ?? ""));
      await Promise.all([
        pack ? bumpCounter("credit_revenue_cents", pack.price_cents) : Promise.resolve(),
        creditAmount > 0 ? bumpCounter("credits_sold", creditAmount) : Promise.resolve(),
        recordSale({
          source:              "coinbase_cdp",
          event_type:          "credit_pack",
          external_id:         `cdp:${id}`,
          gross_cents:         pack?.price_cents ?? 0,
          agent_name:          agentName,
          product_name:        pack?.label ?? `${creditAmount} Latent Credits`,
          provisioning_status: credited ? "delivered" : "failed",
          provisioning_detail: credited ? "credits granted" : "credit_seller RPC failed",
        }),
      ]);
    }

    if (meta.product_type === "digital_guide") {
      const email = meta.customer_email ?? "";
      const slug  = meta.product_slug   ?? "";
      let delivered = false;
      if (email && slug) delivered = await sendGuideEmail(email, slug, id);
      const product = PRODUCTS.find((p) => p.id === slug);
      await recordSale({
        source:              "coinbase_cdp",
        event_type:          "guide_sale",
        external_id:         `cdp:${id}`,
        gross_cents:         Math.round((product?.price ?? 0) * 100),
        product_slug:        slug || undefined,
        product_name:        productTitles[slug],
        customer_email:      email || undefined,
        provisioning_status: delivered ? "delivered" : "failed",
        provisioning_detail: delivered
          ? "delivery email sent"
          : (email && slug ? "delivery failed — redeliver from admin" : "missing slug or customer email"),
      });
    }
  }

  return Response.json({ received: true });
}
