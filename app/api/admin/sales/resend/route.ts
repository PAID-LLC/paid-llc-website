export const runtime = "edge";

// ── POST /api/admin/sales/resend — re-deliver a purchase ───────────────────
// The admin Sales tab has had a Resend button posting here since launch; this
// route now exists. Two lookup modes:
//
//   { charge_id: "ch_..." }  — Stripe charge → checkout session → product slug
//                              → /download link email (same as the webhook).
//   { ledger_id: 123 }       — sales_ledger row (any rail) → Supabase signed
//                              URL email. Used by provisioning-issue rows.
//
// On success the matching ledger row is marked delivered.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";
import { productTitles, slugToFile }          from "@/lib/products";
import { markProvisioned }                    from "@/lib/ledger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; }
}

async function getSignedDownloadUrl(filename: string): Promise<string | null> {
  if (!supabaseReady()) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(
    `${url}/storage/v1/object/sign/guides/${encodeURIComponent(filename)}`,
    {
      method:  "POST",
      headers: { apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ expiresIn: 3600 }),
    }
  ).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json() as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

async function sendEmail(to: string, title: string, link: string, expires: boolean): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const text = [
    `Hi,`,
    ``,
    `Here is a fresh download link for ${title}:`,
    ``,
    link,
    ``,
    expires ? `This link expires in 1 hour — download your file now.` : `You can use this link any time to re-download your guide.`,
    ``,
    `Questions? Reply to this email or reach us at hello@paiddev.com.`,
    ``,
    `-- Travis`,
    `PAID LLC`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    "PAID LLC <hello@paiddev.com>",
      to:      [to],
      subject: `Your download: ${title}`,
      text,
    }),
  }).catch(() => null);
  return !!res?.ok;
}

// ── Stripe charge → session → redeliver ─────────────────────────────────────

async function resendFromStripeCharge(chargeId: string): Promise<Response> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return Response.json({ ok: false, reason: "Stripe not configured" }, { status: 503 });

  const chargeRes = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  }).catch(() => null);
  if (!chargeRes?.ok) return Response.json({ ok: false, reason: "charge not found" }, { status: 404 });

  const charge = await chargeRes.json() as {
    payment_intent: string | null;
    billing_details: { email: string | null };
  };
  const email = charge.billing_details?.email;
  if (!email) return Response.json({ ok: false, reason: "charge has no customer email" }, { status: 422 });

  // Map charge → checkout session (carries product metadata + session id for /download)
  let slug = "";
  let sessionId = "";
  if (charge.payment_intent) {
    const sessRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(charge.payment_intent)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    ).catch(() => null);
    if (sessRes?.ok) {
      const sessions = await sessRes.json() as { data: { id: string; metadata?: Record<string, string> }[] };
      sessionId = sessions.data[0]?.id ?? "";
      slug      = sessions.data[0]?.metadata?.product ?? "";
    }
  }
  if (!slug || !sessionId) {
    return Response.json({ ok: false, reason: "no checkout session / product metadata for this charge" }, { status: 422 });
  }

  const title = productTitles[slug] ?? "Your Guide";
  const link  = `${SITE_URL}/download/${slug}?session_id=${sessionId}`;
  const sent  = await sendEmail(email, title, link, false);
  if (!sent) return Response.json({ ok: false, reason: "email send failed" }, { status: 502 });

  await markProvisioned(sessionId, "delivered", "redelivered from admin");
  return Response.json({ ok: true, delivered_to_masked: `${email[0]}***`, product: title });
}

// ── Ledger row → redeliver ──────────────────────────────────────────────────

async function resendFromLedger(ledgerId: number): Promise<Response> {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "ledger unavailable" }, { status: 503 });

  const res = await fetch(
    sbUrl(`sales_ledger?id=eq.${ledgerId}&select=external_id,product_slug,product_name,customer_email,event_type&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return Response.json({ ok: false, reason: "ledger lookup failed" }, { status: 503 });

  const rows = await res.json() as {
    external_id: string; product_slug: string | null;
    product_name: string | null; customer_email: string | null; event_type: string;
  }[];
  const row = rows[0];
  if (!row) return Response.json({ ok: false, reason: "ledger row not found" }, { status: 404 });
  if (row.event_type !== "guide_sale") {
    return Response.json({ ok: false, reason: `cannot auto-redeliver event_type=${row.event_type} — handle manually` }, { status: 422 });
  }
  if (!row.customer_email) return Response.json({ ok: false, reason: "no customer email on ledger row" }, { status: 422 });

  const slug     = row.product_slug ?? "";
  const filename = slugToFile[slug];
  if (!filename) return Response.json({ ok: false, reason: "unknown product slug — cannot generate download" }, { status: 422 });

  const link = await getSignedDownloadUrl(filename);
  if (!link) return Response.json({ ok: false, reason: "could not sign download URL" }, { status: 502 });

  const title = row.product_name ?? productTitles[slug] ?? "Your Guide";
  const sent  = await sendEmail(row.customer_email, title, link, true);
  if (!sent) return Response.json({ ok: false, reason: "email send failed" }, { status: 502 });

  await markProvisioned(row.external_id, "delivered", "redelivered from admin");
  return Response.json({ ok: true, delivered_to_masked: `${row.customer_email[0]}***`, product: title });
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!checkOrigin(req))        return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req)))  return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { charge_id?: string; ledger_id?: number };
  try { body = await req.json() as { charge_id?: string; ledger_id?: number }; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  if (body.ledger_id) return resendFromLedger(Number(body.ledger_id));
  if (body.charge_id) return resendFromStripeCharge(String(body.charge_id));
  return Response.json({ ok: false, reason: "charge_id or ledger_id required" }, { status: 400 });
}
