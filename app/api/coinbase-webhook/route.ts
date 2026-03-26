export const runtime = "edge";

// ── POST /api/coinbase-webhook ────────────────────────────────────────────────
//
// Coinbase Commerce webhook handler.
// Verifies X-CC-Webhook-Signature (HMAC-SHA256 of raw body with API key).
//
// To activate: set COINBASE_COMMERCE_API_KEY env var.
// Until set, returns 200 silently (prevents 404s while approval is pending).
//
// Webhook events handled:
//   charge:confirmed  — credits delivered, calls credit_seller RPC
//   charge:failed     — logs failure, no credits issued

import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time string comparison via XOR of char codes
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: Request) {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;

  // Placeholder mode: return 200 until key is provisioned
  if (!apiKey) {
    return Response.json({ received: true });
  }

  // ── Verify signature ───────────────────────────────────────────────────────
  const signature = req.headers.get("x-cc-webhook-signature") ?? "";
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  const valid = await verifySignature(body, signature, apiKey);
  if (!valid) {
    console.warn("[coinbase-webhook] invalid signature");
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  // ── Process event ──────────────────────────────────────────────────────────
  let event: { type?: string; data?: { metadata?: { agent_name?: string; amount?: string } } };
  try { event = JSON.parse(body); }
  catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  if (event.type === "charge:confirmed") {
    const agentName = String(event.data?.metadata?.agent_name ?? "").trim();
    const amount    = Math.max(0, Number(event.data?.metadata?.amount ?? 0));

    if (agentName && amount > 0 && supabaseReady()) {
      const res = await fetch(sbUrl("rpc/credit_seller"), {
        method: "POST",
        headers: { ...sbHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ p_agent_name: agentName, p_amount: amount }),
      });
      if (!res.ok) {
        console.error("[coinbase-webhook] credit_seller failed:", res.status);
      }
    }
  } else if (event.type === "charge:failed") {
    console.warn("[coinbase-webhook] charge:failed event received");
  }

  return Response.json({ received: true });
}
