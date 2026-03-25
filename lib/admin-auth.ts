// ── Admin auth helpers ──────────────────────────────────────────────────────
// Edge-compatible. No external deps. Used by /api/admin/* routes.

const enc = new TextEncoder();
const dec = new TextDecoder();

const COOKIE_NAME = "admin_session";
const TTL_MS      = 4 * 60 * 60 * 1000; // 4 hours

// ── Timing-safe comparison ────────────────────────────────────────────────

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const arrA = new Uint8Array(hashA);
  const arrB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
  return diff === 0;
}

// ── HMAC key from secret ──────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// ── Token: base64url(payload_json).base64url(signature) ───────────────────

export async function signAdminToken(secret: string): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + TTL_MS });
  const payloadB64 = btoa(payload).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return false;

    const key = await importKey(secret);
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payloadB64));
    if (!valid) return false;

    const payload = JSON.parse(dec.decode(Uint8Array.from(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export function parseAdminCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key === COOKIE_NAME) return val.join("=");
  }
  return null;
}

export { COOKIE_NAME, TTL_MS };
