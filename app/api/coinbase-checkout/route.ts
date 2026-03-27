export const runtime = "edge";

// ── POST /api/coinbase-checkout ────────────────────────────────────────────────
// Creates a Coinbase CDP Business checkout with metadata attached.
// Returns a url to redirect the user to Coinbase's payment page.
//
// Body (credit pack):
//   { product_type: "credit_pack", agent_name: string, pack_id: string }
//
// Body (digital guide):
//   { product_type: "digital_guide", product_slug: string, email: string }
//
// Response: { ok: true, hosted_url: string } | { ok: false, reason: string }
//
// Requires env vars:
//   COINBASE_CDP_KEY_ID      — API key name from portal.cdp.coinbase.com
//   COINBASE_CDP_PRIVATE_KEY — EC private key PEM (SEC1 or PKCS8); use \n for newlines in Cloudflare

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { CREDIT_PACKS, CreditPackId, PRODUCTS, productTitles } from "@/lib/products";

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
const CB_API    = "https://business.coinbase.com/api/v1/checkouts";

// ── Crypto helpers ─────────────────────────────────────────────────────────────

function b64url(data: Uint8Array): string {
  let binary = "";
  data.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function encodeLen(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, len >> 8, len & 0xff]);
}

// Wrap a SEC1 EC private key in a PKCS8 envelope so Web Crypto can import it.
// Handles both "BEGIN EC PRIVATE KEY" (SEC1) and "BEGIN PRIVATE KEY" (PKCS8).
function ensurePkcs8(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der  = new Uint8Array(Array.from(atob(b64), c => c.charCodeAt(0)));

  if (pem.includes("BEGIN PRIVATE KEY")) return der; // already PKCS8

  // AlgorithmIdentifier: { id-ecPublicKey, prime256v1 }
  const algo = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const privKey = concat(new Uint8Array([0x04]), encodeLen(der.length), der);
  const body    = concat(version, algo, privKey);
  return concat(new Uint8Array([0x30]), encodeLen(body.length), body);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = ensurePkcs8(pem);
  return crypto.subtle.importKey(
    "pkcs8", pkcs8.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

async function makeJWT(keyId: string, pem: string): Promise<string> {
  const key   = await importPrivateKey(pem);
  const now   = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: "cdp", sub: keyId, nbf: now, exp: now + 120,
    uri: `POST ${CB_API}`, nonce,
  })));

  const input = `${header}.${payload}`;
  const sig   = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input)
  );
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

// ── Checkout creation ──────────────────────────────────────────────────────────

async function createCheckout(opts: {
  keyId:       string;
  pem:         string;
  amountUsdc:  string;
  description: string;
  metadata:    Record<string, string>;
  successUrl:  string;
  failUrl:     string;
}): Promise<string | null> {
  try {
    const jwt = await makeJWT(opts.keyId, opts.pem);
    const res = await fetch(CB_API, {
      method:  "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body:    JSON.stringify({
        amount:             opts.amountUsdc,
        currency:           "USDC",
        description:        opts.description,
        metadata:           opts.metadata,
        successRedirectUrl: opts.successUrl,
        failRedirectUrl:    opts.failUrl,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const keyId = process.env.COINBASE_CDP_KEY_ID;
  const pem   = process.env.COINBASE_CDP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !pem) {
    return Response.json({ ok: false, reason: "crypto payments not yet enabled" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const productType = String(body.product_type ?? "");

  // ── Credit pack ──────────────────────────────────────────────────────────────
  if (productType === "credit_pack") {
    if (!supabaseReady()) return Response.json({ ok: false, reason: "service unavailable" }, { status: 503 });

    const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
    const packId    = String(body.pack_id    ?? "") as CreditPackId;

    if (!agentName) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });

    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return Response.json({
      ok: false,
      reason: `invalid pack_id. Valid options: ${CREDIT_PACKS.map(p => p.id).join(", ")}`,
    }, { status: 400 });

    const agentRes = await fetch(
      sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
      { headers: sbHeaders() }
    );
    if (!agentRes.ok) return Response.json({ ok: false, reason: "unable to verify agent — try again" }, { status: 503 });
    const agents = await agentRes.json() as { agent_name: string }[];
    if (agents.length === 0) return Response.json({
      ok: false, reason: "agent not registered. Register first: POST /api/registry",
    }, { status: 404 });

    const url = await createCheckout({
      keyId, pem,
      amountUsdc:  (pack.price_cents / 100).toFixed(2),
      description: `${pack.credits} Latent Credits for ${agentName} — used in The Latent Space Arena on paiddev.com`,
      metadata: {
        product_type:  "credit_pack",
        agent_name:    agentName,
        pack_id:       packId,
        credit_amount: String(pack.credits),
      },
      successUrl: `${SITE_URL}/the-latent-space?credits=purchased`,
      failUrl:    `${SITE_URL}/the-latent-space?credits=cancelled`,
    });

    if (!url) return Response.json({ ok: false, reason: "failed to create checkout — try again" }, { status: 502 });
    return Response.json({ ok: true, hosted_url: url });
  }

  // ── Digital guide ────────────────────────────────────────────────────────────
  if (productType === "digital_guide") {
    const slug  = String(body.product_slug ?? "").trim();
    const email = String(body.email        ?? "").trim().toLowerCase();

    if (!slug)                          return Response.json({ ok: false, reason: "product_slug required" }, { status: 400 });
    if (!email || !email.includes("@")) return Response.json({ ok: false, reason: "valid email required" },  { status: 400 });

    const title   = productTitles[slug];
    const product = PRODUCTS.find(p => p.id === slug);
    if (!title || !product) return Response.json({ ok: false, reason: "invalid product_slug" }, { status: 400 });

    const url = await createCheckout({
      keyId, pem,
      amountUsdc:  product.price.toFixed(2),
      description: product.description,
      metadata: {
        product_type:   "digital_guide",
        product_slug:   slug,
        customer_email: email,
      },
      successUrl: `${SITE_URL}/digital-products?purchased=true`,
      failUrl:    `${SITE_URL}/digital-products`,
    });

    if (!url) return Response.json({ ok: false, reason: "failed to create checkout — try again" }, { status: 502 });
    return Response.json({ ok: true, hosted_url: url });
  }

  return Response.json({ ok: false, reason: "invalid product_type" }, { status: 400 });
}
