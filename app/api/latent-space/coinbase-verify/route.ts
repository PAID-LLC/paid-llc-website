export const runtime = "edge";

// GET /api/latent-space/coinbase-verify
// Redirect target for Coinbase payments on Latent Space payment links.
//
// MIGRATION STATE (2026-06-14): the classic Coinbase Commerce charges API this
// route used to query was shut down 2026-03-31. Delivery is no longer driven by
// this redirect — it is handled server-side by the payment_link.payment.success
// webhook (see /api/coinbase-webhook), which is the reliable path and does not
// depend on the buyer returning to this URL.
//
// This handler now only bounces the buyer to a friendly success page. It never
// trusts query params for fulfillment (a redirect is attacker-controllable);
// the webhook is the source of truth for what was actually paid and delivered.
//
// NOTE: Latent Space items (latent-signature, protocol-patch, context-capsule*)
// are still on legacy static Commerce links. To sell them via Coinbase again,
// recreate them as Business payment links with metadata
// { product_type, product_slug | product, customer_email } so the webhook can
// deliver them the same way digital guides and credit packs are delivered.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const productParam = searchParams.get("product") ?? "";
  const successUrl = `${SITE_URL}/the-latent-space?purchased=${encodeURIComponent(productParam)}`;
  return Response.redirect(successUrl, 302);
}
