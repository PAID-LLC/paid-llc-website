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
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${t}.${payload}`)
  );
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === v1;
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

// ── Product title map (mirrors download page) ────────────────────────────────

const productTitles: Record<string, string> = {
  "ai-readiness-assessment":         "AI Readiness Assessment",
  "microsoft-365-copilot-playbook":  "Microsoft 365 Copilot Playbook",
  "excel-ai-data-analysis":          "Excel + AI: Analyze Data Without a Data Analyst",
  "ai-powered-outlook":              "AI-Powered Outlook: Smart Email System",
  "google-workspace-ai-guide":       "Google Workspace AI Guide",
  "gmail-ai-inbox-zero":             "Gmail + AI: Inbox Zero for Business",
  "solopreneur-content-engine":      "The Solopreneur Content Engine",
  "small-business-ai-operations":    "Small Business AI Operations Playbook",
  "chatgpt-business-prompt-library": "ChatGPT Business Prompt Library",
  "all-guides-bundle":               "All Guides Bundle",
};

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
  const link    = `https://paiddev.com/download/${slug}?session_id=${session.id}`;

  const souvenirLine = souvenirToken
    ? [``, `You've also earned a digital souvenir. View it here:`, ``, `https://paiddev.com/the-latent-space/souvenirs/${souvenirToken}`]
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

// ── Souvenir issuance ─────────────────────────────────────────────────────────

async function issueSouvenir(souvenirId: string, displayName: string, proofRef: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const token  = crypto.randomUUID();
  const ipHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`server_${proofRef}_2026`)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const res = await fetch(`${url}/rest/v1/souvenir_claims`, {
    method:  "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body:    JSON.stringify({ souvenir_id: souvenirId, token, display_name: displayName, ip_hash: ipHash, proof_type: "server", proof_ref: proofRef }),
  }).catch(() => null);

  return res?.ok ? token : null;
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
    const souvenirToken = await issuePurchaseSouvenirs(event.data.object);
    await Promise.all([
      sendPurchaseNotification(event.data.object),
      sendDeliveryEmail(event.data.object, souvenirToken ?? undefined),
      subscribeToMailerLite(event.data.object),
    ]);
  }

  return NextResponse.json({ received: true });
}
