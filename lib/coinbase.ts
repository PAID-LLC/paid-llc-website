// ── Coinbase CDP helpers ───────────────────────────────────────────────────────
// Generates CDP JWT auth tokens and creates Coinbase Commerce charges.
// Uses COINBASE_CDP_KEY_ID + COINBASE_CDP_PRIVATE_KEY (PKCS8 EC P-256).
// No external libraries — pure Web Crypto API (edge-compatible).

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlStr(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Parse PEM and import as a Web Crypto ECDSA P-256 key.
// Handles both PKCS8 ("-----BEGIN PRIVATE KEY-----") and
// SEC1 EC ("-----BEGIN EC PRIVATE KEY-----") headers.
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, "\n"); // Cloudflare stores \n as literal
  const body = normalized
    .replace(/-----BEGIN (?:EC )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:EC )?PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// Build a short-lived (120s) CDP JWT for API authentication.
// Web Crypto ECDSA sign() returns IEEE P1363 (raw R||S) — the format JWT expects.
export async function buildCdpJwt(): Promise<string> {
  const keyId  = process.env.COINBASE_CDP_KEY_ID;
  const pemKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyId || !pemKey) throw new Error("COINBASE_CDP_KEY_ID / COINBASE_CDP_PRIVATE_KEY not configured");

  const cryptoKey = await importPrivateKey(pemKey);

  const now     = Math.floor(Date.now() / 1000);
  const header  = b64urlStr(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64urlStr(JSON.stringify({
    sub: keyId,
    iss: "coinbase-cloud",
    nbf: now,
    exp: now + 120,
    aud: ["retail_rest_api_proxy"],
  }));

  const message = `${header}.${payload}`;
  const sig     = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    enc.encode(message)
  );

  return `${message}.${b64url(sig)}`;
}

export interface CommerceChargeInput {
  name:         string;
  description:  string;
  amount_usd:   string;  // e.g. "14.99"
  redirect_url: string;
  cancel_url:   string;
  metadata:     Record<string, string>;
}

export interface CommerceCharge {
  hosted_url:  string;
  expires_at:  string;
  charge_code: string;
}

// Create a Coinbase Commerce charge via CDP API.
// Returns the hosted checkout URL and expiry, or null on failure.
export async function createCommerceCharge(
  input: CommerceChargeInput
): Promise<CommerceCharge | null> {
  let jwt: string;
  try {
    jwt = await buildCdpJwt();
  } catch (e) {
    console.error("[coinbase] JWT generation failed:", e);
    return null;
  }

  const body = {
    name:         input.name,
    description:  input.description,
    pricing_type: "fixed_price",
    local_price:  { amount: input.amount_usd, currency: "USD" },
    redirect_url: input.redirect_url,
    cancel_url:   input.cancel_url,
    metadata:     input.metadata,
  };

  const res = await fetch("https://api.coinbase.com/api/v3/coinbase/commerce/charges", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type":  "application/json",
      "CB-VERSION":    "2018-03-22",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[coinbase] charge creation failed:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json() as {
    data: { hosted_url: string; expires_at: string; code: string }
  };

  return {
    hosted_url:  data.data.hosted_url,
    expires_at:  data.data.expires_at,
    charge_code: data.data.code,
  };
}
