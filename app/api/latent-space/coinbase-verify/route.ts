export const runtime = "edge";

// GET /api/latent-space/coinbase-verify
// Called by Coinbase redirect after payment on any Latent Space payment link.
// Coinbase appends ?charge_code=XXX to whatever redirect_url we configured.
//
// Flow:
//   1. Look up the charge via CDP API using charge_code
//   2. Confirm the charge is paid (timeline includes COMPLETED)
//   3. Extract buyer_email from the charge object (Coinbase-collected)
//   4. If metadata.product is set, use it — otherwise use the product query param
//      (static links have no metadata, so we trust the product param set in link config)
//   5. Verify the charge amount matches the expected product price to prevent
//      someone paying for a cheap item and hitting this URL with an expensive slug
//   6. Send delivery email and redirect to success page

import { buildCdpJwt } from "@/lib/coinbase";
import { productTitles, slugToFile } from "@/lib/products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

// Expected prices for Latent Space products (USD = USDC 1:1)
const PRODUCT_PRICES: Record<string, number> = {
  "latent-signature":         5.00,
  "protocol-patch":           7.00,
  "context-capsule":         49.99,
  "context-capsule-solo":    99.00,
  "context-capsule-team":   249.00,
  "context-capsule-enterprise": 749.00,
};

async function getSignedUrl(filename: string): Promise<string | null> {
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

async function sendDeliveryEmail(email: string, slug: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const title    = productTitles[slug];
  const filename = slugToFile[slug];
  if (!title || !filename) return;

  const downloadUrl = await getSignedUrl(filename);
  if (!downloadUrl) return;

  const text = [
    `Hi,`,
    ``,
    `Thank you for purchasing ${title}.`,
    ``,
    `Your download link is below. It expires in 1 hour — download your file now:`,
    ``,
    downloadUrl,
    ``,
    `Questions? Reply to this email or reach us at hello@paiddev.com.`,
    ``,
    `-- Travis`,
    `PAID LLC`,
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    "PAID LLC <hello@paiddev.com>",
      to:      [email],
      subject: `Your ${title} download link`,
      text,
    }),
  }).catch(err => console.error("[coinbase-verify] resend failed:", err));
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const productParam = searchParams.get("product")     ?? "";
  const chargeCode   = searchParams.get("charge_code") ?? "";

  const successUrl = `${SITE_URL}/the-latent-space?purchased=${encodeURIComponent(productParam)}`;

  if (!productParam || !chargeCode) {
    return Response.redirect(successUrl, 302);
  }

  try {
    const chargePath = `/api/v3/coinbase/commerce/charges/${encodeURIComponent(chargeCode)}`;
    // NOTE: this still targets the legacy charges path (phase-2 migration to
    // business.coinbase.com/api/v1/payment_links/{id} pending). 3-arg signature.
    const jwt = await buildCdpJwt("GET", "api.coinbase.com", chargePath);
    const res = await fetch(
      `https://api.coinbase.com${chargePath}`,
      { headers: { Authorization: `Bearer ${jwt}`, "CB-VERSION": "2018-03-22" } }
    );

    if (!res.ok) return Response.redirect(successUrl, 302);

    const json = await res.json() as {
      data?: {
        buyer_email?: string;
        timeline?:   { status: string; time: string }[];
        pricing?:    { local?: { amount: string; currency: string } };
        metadata?:   Record<string, string>;
      };
    };

    const charge = json.data;
    if (!charge) return Response.redirect(successUrl, 302);

    // Verify the charge is confirmed
    const confirmed = charge.timeline?.some(
      t => t.status === "COMPLETED" || t.status === "CONFIRMED"
    );
    if (!confirmed) return Response.redirect(successUrl, 302);

    // Resolve product: metadata wins (dynamic charges); fall back to URL param (static links)
    const product = charge.metadata?.product ?? productParam;

    // Price guard: for static links (no metadata), verify amount matches expected price
    // This prevents paying $5 for Latent Signature and hitting verify with product=context-capsule-enterprise
    if (!charge.metadata?.product) {
      const expectedPrice = PRODUCT_PRICES[product];
      const actualPrice   = charge.pricing?.local ? parseFloat(charge.pricing.local.amount) : null;
      if (expectedPrice && actualPrice !== null && Math.abs(actualPrice - expectedPrice) > 0.50) {
        console.error(`[coinbase-verify] price mismatch for ${product}: expected ${expectedPrice}, got ${actualPrice}`);
        return Response.redirect(successUrl, 302);
      }
    }

    const email = charge.buyer_email ?? charge.metadata?.buyer_email;
    if (email) {
      await sendDeliveryEmail(email, product);
    }
  } catch (e) {
    console.error("[coinbase-verify] error:", e);
  }

  return Response.redirect(successUrl, 302);
}
