// ── Coinbase helpers ───────────────────────────────────────────────────────────
// ACTIVE: Coinbase Business payment links (createPaymentLink), CDP-JWT auth.
//   The classic Commerce charges API (api.commerce.coinbase.com, X-CC-Api-Key)
//   was shut down 2026-03-31; createCommerceCharge below is dead and kept only
//   for reference until the verify/webhook paths finish migrating.
// CDP JWT builder: now the live auth path. Uses COINBASE_CDP_KEY_ID +
//   COINBASE_CDP_PRIVATE_KEY. Supports Ed25519 (base64, current default) and
//   EC P-256 (PEM, legacy). No external libraries — pure Web Crypto (edge).
//
// CDP JWT format (per CDP docs):
//   header:  { alg: "EdDSA"|"ES256", typ: "JWT", kid: keyId, nonce: hex }
//   payload: { sub: keyId, iss: "cdp", aud: ["cdp_service"], nbf, exp,
//              uri: "METHOD host/path" }  // host must match the request host

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

// ── Ed25519 import ────────────────────────────────────────────────────────────
// CDP's current default key type is Ed25519 (a base64 string of 64 bytes:
// 32-byte seed + 32-byte public key). Web Crypto importKey wants PKCS8, so we
// wrap the 32-byte seed in the fixed Ed25519 PKCS8 DER prefix.
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
  0x04, 0x22, 0x04, 0x20,
]);

function looksLikePem(key: string): boolean {
  return key.includes("BEGIN");
}

async function importEd25519Key(b64: string): Promise<CryptoKey> {
  const normalized = b64.replace(/\\n/g, "").replace(/\s+/g, "");
  const raw  = new Uint8Array(Array.from(atob(normalized), (c) => c.charCodeAt(0)));
  const seed = raw.length >= 32 ? raw.slice(0, 32) : raw;   // first 32 bytes = seed
  const pkcs8 = concatBytes(ED25519_PKCS8_PREFIX, seed);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer as ArrayBuffer,
    { name: "Ed25519" } as unknown as AlgorithmIdentifier,
    false,
    ["sign"]
  );
}

// Build a short-lived (120s) CDP JWT bearer token. Supports both key types the
// CDP portal issues: EdDSA (Ed25519, current default) and ES256 (legacy EC P-256).
// The uri claim host MUST match the request host, so callers pass it explicitly.
// method: uppercase HTTP verb. host: e.g. "business.coinbase.com". path: "/...".
export async function buildCdpJwt(method: string, host: string, path: string): Promise<string> {
  const keyId  = process.env.COINBASE_CDP_KEY_ID;
  const pemKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyId || !pemKey) throw new Error("COINBASE_CDP_KEY_ID / COINBASE_CDP_PRIVATE_KEY not configured");

  const isEd25519 = !looksLikePem(pemKey);
  const alg       = isEd25519 ? "EdDSA" : "ES256";
  const cryptoKey = isEd25519 ? await importEd25519Key(pemKey) : await importPrivateKey(pemKey);

  const now   = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const header  = b64urlStr(JSON.stringify({ alg, typ: "JWT", kid: keyId, nonce }));
  const payload = b64urlStr(JSON.stringify({
    sub: keyId,
    iss: "cdp",
    aud: ["cdp_service"],
    nbf: now,
    exp: now + 120,
    uri: `${method} ${host}${path}`,
  }));

  const message   = `${header}.${payload}`;
  const signParams: AlgorithmIdentifier | EcdsaParams = isEd25519
    ? ({ name: "Ed25519" } as unknown as AlgorithmIdentifier)
    : { name: "ECDSA", hash: { name: "SHA-256" } };
  const sig = await crypto.subtle.sign(signParams, cryptoKey, enc.encode(message));

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

// Coinbase Commerce uses its own API key auth (X-CC-Api-Key header), NOT CDP
// JWTs. Confirmed against current docs 2026-06-12: the CDP-JWT attempt at
// api.coinbase.com/api/v3/... returned 404 in production because that path
// does not exist. buildCdpJwt above is retained for future CDP APIs
// (onchain data, wallets) but is not used for Commerce charges.
const COMMERCE_CHARGES_URL = "https://api.commerce.coinbase.com/charges";

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

  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) {
    lastError = {
      stage: "config",
      detail: "COINBASE_COMMERCE_API_KEY not set — create one in the Coinbase Commerce dashboard (Settings > Security > New API key) and add it to Cloudflare Pages env",
    };
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

    const res = await fetch(COMMERCE_CHARGES_URL, {
      method:  "POST",
      headers: {
        "X-CC-Api-Key":  apiKey,
        "X-CC-Version":  "2018-03-22",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
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

// ── Coinbase Business payment links (replaces dead Commerce charges) ──────────
// The classic Commerce charges API (api.commerce.coinbase.com) was shut down
// 2026-03-31. The replacement is the Coinbase Business payment-link API, CDP-JWT
// authenticated. createPaymentLink is a drop-in for createCommerceCharge: same
// input/output shape, so call sites only swap the function name.
//
// Prereqs (Travis): a Coinbase Business account + a CDP API key, with
//   COINBASE_CDP_KEY_ID + COINBASE_CDP_PRIVATE_KEY set in Cloudflare.
// Field names/auth are per the migration docs and pending a live-credential test.

const BUSINESS_HOST        = "business.coinbase.com";
// NOTE: hyphen, not underscore. Confirmed against the live CDP Business API
// reference 2026-06-14 (the underscore form returns the SPA 404 "page not found").
const PAYMENT_LINKS_PATH   = "/api/v1/payment-links";

export interface PaymentLink {
  hosted_url: string;
  id:         string;
  status:     string;
}

export async function createPaymentLink(input: CommerceChargeInput): Promise<PaymentLink | null> {
  lastError = null;

  const keyId  = process.env.COINBASE_CDP_KEY_ID;
  const pemKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyId || !pemKey) {
    lastError = {
      stage: "config",
      detail: "COINBASE_CDP_KEY_ID / COINBASE_CDP_PRIVATE_KEY not set — create a CDP API key in the Coinbase Business / CDP portal and add both to Cloudflare Pages env",
    };
    return null;
  }

  let jwt: string;
  try {
    jwt = await buildCdpJwt("POST", BUSINESS_HOST, PAYMENT_LINKS_PATH);
  } catch (e) {
    lastError = { stage: "jwt", detail: e instanceof Error ? e.message.slice(0, 200) : "jwt build failed" };
    return null;
  }

  try {
    // Body matches the CreatePaymentLinkRequest schema exactly: amount + currency
    // required; description/redirects/metadata optional. There is no `name` or
    // `network` field in the schema, so the product name is folded into the
    // description and the network is implied (USDC on Base).
    const body = {
      amount:             input.amount_usd,
      currency:           "USD",
      description:        `${input.name}: ${input.description}`.slice(0, 500),
      successRedirectUrl: input.redirect_url,
      failRedirectUrl:    input.cancel_url,
      metadata:           input.metadata,
    };

    const res = await fetch(`https://${BUSINESS_HOST}${PAYMENT_LINKS_PATH}`, {
      method: "POST",
      headers: {
        Authorization:     `Bearer ${jwt}`,
        "Content-Type":    "application/json",
        "Accept":          "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = { stage: "api", status: res.status, detail: text.slice(0, 200) };
      console.error("[coinbase] payment_links creation failed:", res.status, text);
      return null;
    }

    // Response may be flat or wrapped in { data: ... }; the hosted link is `url`.
    const json = await res.json() as
      { url?: string; id?: string; status?: string; data?: { url?: string; id?: string; status?: string } };
    const d = json.data ?? json;
    if (!d.url) {
      lastError = { stage: "api", detail: "payment_links response missing url" };
      return null;
    }
    return { hosted_url: d.url, id: d.id ?? "", status: d.status ?? "ACTIVE" };
  } catch (e) {
    lastError = { stage: "api", detail: e instanceof Error ? e.message.slice(0, 200) : "network failure" };
    console.error("[coinbase] createPaymentLink failed:", e);
    return null;
  }
}
