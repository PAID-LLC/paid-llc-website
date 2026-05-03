export const runtime = "edge";

// ONE-TIME SETUP ENDPOINT — DELETE AFTER USE
// Registers the Coinbase Commerce webhook and returns the signing secret.
// Protected by COINBASE_SETUP_TOKEN env var (temporary, delete after use).
//
// Usage: GET /api/admin/register-coinbase-webhook?token=YOUR_COINBASE_SETUP_TOKEN

import { buildCdpJwt } from "@/lib/coinbase";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const token      = searchParams.get("token") ?? "";
  const adminToken = process.env.COINBASE_SETUP_TOKEN ?? "";

  if (!adminToken || token !== adminToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const jwt = await buildCdpJwt();

    const res     = await fetch("https://api.coinbase.com/api/v3/coinbase/commerce/webhooks", {
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

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      return Response.json({ error: "CDP API failed", status: res.status, detail: data }, { status: 200 });
    }

    const d = data as Record<string, unknown>;
    return Response.json({
      ok:            true,
      webhook_id:    d.id,
      shared_secret: d.shared_secret,
      full_response: d,
      instruction:   "Copy shared_secret → add as COINBASE_COMMERCE_WEBHOOK_SECRET in Cloudflare, then delete this endpoint",
    });
  } catch (e) {
    return Response.json({ error: "exception", detail: String(e) }, { status: 200 });
  }
}
