// ── Coinbase CDP helpers ───────────────────────────────────────────────────────
// Generates CDP JWT auth tokens and creates Coinbase Commerce charges.
// Uses COINBASE_CDP_KEY_ID + COINBASE_CDP_PRIVATE_KEY (PKCS8 or SEC1 EC P-256).
// No external libraries — pure Web Crypto API (edge-compatible).
//
// JWT format required by Commerce API (api.coinbase.com):
//   header:  { alg: "ES256", kid: keyId, nonce: hex }
//   payload: { sub: keyId, iss: "cdp", nbf, exp, uri: "METHOD api.coinbase.com/path" }

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlStr(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── SEC1 → PKCS8 conversion ───────────────────────────────────────────────────
// Web Crypto only accepts PKCS8 for importKey. CDP portal may issue SEC1 keys.

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
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

function sec1ToPkcs8(der: Uint8Array): Uint8Array {
  // AlgorithmIdentifier: { id-ecPublicKey, prime256v1 }
  const algo    = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const privKey = concatBytes(new Uint8Array([0x04]), encodeLen(der.length), der);
  const body    = concatBytes(version, algo, privKey);
  return concatBytes(new Uint8Array([0x30]), encodeLen(body.length), body);
}

// Parse PEM and import as a Web Crypto ECDSA P-256 key.
// Handles both PKCS8 ("-----BEGIN PRIVATE KEY-----") and
// SEC1 EC ("-----BEGIN EC PRIVATE KEY-----") headers.
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, "\n");
  const isPkcs8    = normalized.includes("BEGIN PRIVATE KEY");

  const body = normalized
    .replace(/-----BEGIN (?:EC )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:EC )?PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const raw  = new Uint8Array(Array.from(atob(body), c => c.charCodeAt(0)));
  const pkcs8 = isPkcs8 ? raw : sec1ToPkcs8(raw);

  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// Build a short-lived (120s) CDP JWT for Commerce API authentication.
// method: uppercase HTTP verb ("GET", "POST")
// path:   request path starting with "/" (e.g. "/api/v3/coinbase/commerce/charges")
export async function buildCdpJwt(method: string, path: string): Promise<string> {
  const keyId  = process.env.COINBASE_CDP_KEY_ID;
  const pemKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyId || !pemKey) throw new Error("COINBASE_CDP_KEY_ID / COINBASE_CDP_PRIVATE_KEY not configured");

  const cryptoKey = await importPrivateKey(pemKey);

  const now   = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const header  = b64urlStr(JSON.stringify({ alg: "ES256", kid: keyId, nonce }));
  const payload = b64urlStr(JSON.stringify({
    sub: keyId,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri: `${method} api.coinbase.com${path}`,
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

const COMMERCE_CHARGES_PATH = "/api/v3/coinbase/commerce/charges";

// Last failure detail from createCommerceCharge, for caller diagnostics.
// Edge isolates are per-request, so this cannot leak across users. Contains
// only the failure stage, upstream HTTP status, and a truncated upstream
// error body — never our credentials.
export interface CommerceError {
  stage:   "config" | "jwt" | "api";
  status?: number;
  detail?: string;
}
let lastError: CommerceError | null = null;
export function getLastCommerceError(): CommerceError | null {
  return lastError;
}

// Create a Coinbase Commerce charge via CDP API.
// Returns the hosted checkout URL and expiry, or null on failure
// (see getLastCommerceError() for why).
export async function createCommerceCharge(
  input: CommerceChargeInput
): Promise<CommerceCharge | null> {
  lastError = null;

  if (!process.env.COINBASE_CDP_KEY_ID || !process.env.COINBASE_CDP_PRIVATE_KEY) {
    lastError = { stage: "config", detail: "COINBASE_CDP_KEY_ID / COINBASE_CDP_PRIVATE_KEY not set" };
    return null;
  }

  let jwt: string;
  try {
    jwt = await buildCdpJwt("POST", COMMERCE_CHARGES_PATH);
  } catch (e) {
    lastError = { stage: "jwt", detail: e instanceof Error ? e.message.slice(0, 200) : "key import or signing failed" };
    console.error("[coinbase] JWT build failed:", e);
    return null;
  }

  try {
    const body = {
      name:         input.name,
      description:  input.description,
      pricing_type: "fixed_price",
      local_price:  { amount: input.amount_usd, currency: "USD" },
      redirect_url: input.redirect_url,
      cancel_url:   input.cancel_url,
      metadata:     input.metadata,
    };

    const res = await fetch(`https://api.coinbase.com${COMMERCE_CHARGES_PATH}`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type":  "application/json",
        "CB-VERSION":    "2018-03-22",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = { stage: "api", status: res.status, detail: text.slice(0, 200) };
      console.error("[coinbase] charge creation failed:", res.status, text);
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
  } catch (e) {
    lastError = { stage: "api", detail: e instanceof Error ? e.message.slice(0, 200) : "network failure" };
    console.error("[coinbase] createCommerceCharge failed:", e);
    return null;
  }
}
