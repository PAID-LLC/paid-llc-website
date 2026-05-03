export const runtime = "edge";

// ONE-TIME SETUP ENDPOINT — DELETE AFTER USE
// Registers the Coinbase Commerce webhook and returns the signing secret.
// Protected by ADMIN_SECRET env var (same as all other admin routes).
//
// Usage: GET /api/admin/register-coinbase-webhook?token=YOUR_ADMIN_SECRET

import { buildCdpJwt } from "@/lib/coinbase";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const token       = searchParams.get("token") ?? "";
  const adminToken  = process.env.ADMIN_SECRET ?? "";

  if (!adminToken || token !== adminToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let jwt: string;
  try {
    jwt = await buildCdpJwt();
  } catch (e) {
    return Response.json({ error: "JWT build failed", detail: String(e) }, { status: 500 });
  }

  const res = await fetch("https://api.coinbase.com/api/v3/coinbase/commerce/webhooks", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type":  "application/json",
      "CB-VERSION":    "2018-03-22",
    },
    body: JSON.stringify({
      notification_uri: "https://paiddev.com/api/coinbase-webhook",
      event_types:      ["charge:confirmed"],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json({ error: "CDP API failed", status: res.status, detail: data }, { status: 502 });
  }

  return Response.json({
    ok:             true,
    webhook_id:     (data as Record<string, unknown>).id,
    shared_secret:  (data as Record<string, unknown>).shared_secret,
    instruction:    "Copy shared_secret → add as COINBASE_COMMERCE_WEBHOOK_SECRET in Cloudflare, then delete this endpoint",
  });
}
