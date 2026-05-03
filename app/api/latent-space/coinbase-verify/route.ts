export const runtime = "edge";

// GET /api/latent-space/coinbase-verify
// Called by Coinbase redirect after payment. Verifies the charge via CDP API,
// sends the delivery email, then redirects buyer to the success page.
//
// Query params (set by our checkout route + appended by Coinbase):
//   product     — product slug (set by checkout route)
//   email       — buyer email (set by checkout route)
//   charge_code — appended by Coinbase after payment

import { buildCdpJwt } from "@/lib/coinbase";
import { productTitles, slugToFile } from "@/lib/products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

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
  const product    = searchParams.get("product")     ?? "";
  const email      = searchParams.get("email")       ?? "";
  const chargeCode = searchParams.get("charge_code") ?? "";

  const successUrl = `${SITE_URL}/the-latent-space?purchased=${encodeURIComponent(product)}`;

  if (!product || !email || !chargeCode) {
    return Response.redirect(successUrl, 302);
  }

  try {
    const jwt = await buildCdpJwt();
    const res = await fetch(
      `https://api.coinbase.com/api/v3/coinbase/commerce/charges/${encodeURIComponent(chargeCode)}`,
      { headers: { Authorization: `Bearer ${jwt}`, "CB-VERSION": "2018-03-22" } }
    );

    if (res.ok) {
      const data = await res.json() as { metadata?: Record<string, string> };
      const meta = data.metadata ?? {};
      // Verify charge metadata matches — prevents email spoofing via crafted redirect URLs
      if (meta.product === product && meta.buyer_email === email) {
        await sendDeliveryEmail(email, product);
      }
    }
  } catch (e) {
    console.error("[coinbase-verify] error:", e);
  }

  return Response.redirect(successUrl, 302);
}
