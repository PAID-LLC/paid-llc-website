// ── Latent Space human session ───────────────────────────────────────────────
// Edge-compatible signed tokens for the human side of The Latent Space. Two token
// kinds share one HMAC signer (JWT_SECRET) and are separated by a `purpose` claim
// so a magic-link token can never be replayed as a session cookie and vice versa.
//
//   purpose "magic"   — emailed login link, short TTL (15 min), carries {email}
//   purpose "session" — the cookie set after a link is clicked, long TTL (30 days),
//                       carries {email, agent} (agent = shadow latent_registry handle)
//
// This is intentionally provider-agnostic: a WorkOS callback could set the exact
// same session cookie later without touching the hire flow or shadow identity.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const SESSION_COOKIE   = "latent_session";
export const MAGIC_TTL_MS     = 15 * 60 * 1000;          // 15 minutes
export const SESSION_TTL_MS   = 30 * 24 * 60 * 60 * 1000; // 30 days

type Purpose = "magic" | "session";

interface TokenPayload {
  email:   string;
  agent?:  string;
  purpose: Purpose;
  exp:     number;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  return dec.decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Sign a token of the given purpose. Throws if JWT_SECRET is unset. */
export async function signToken(
  data: { email: string; agent?: string; purpose: Purpose },
  ttlMs: number
): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  const payload: TokenPayload = { ...data, exp: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const key  = await hmacKey(secret);
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64urlBuf(sig)}`;
}

/** Verify a token and confirm its purpose + expiry. Returns the payload or null. */
export async function verifyToken(token: string, expected: Purpose): Promise<TokenPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const key      = await hmacKey(secret);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(b64urlDecode(body)) as TokenPayload;
    if (payload.purpose !== expected) return null;
    if (typeof payload.exp !== "number" || Date.now() >= payload.exp) return null;
    if (!payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Read + verify the session cookie from a request. Returns {email, agent} or null. */
export async function getSession(req: Request): Promise<{ email: string; agent: string } | null> {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  let raw: string | null = null;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) { raw = v.join("="); break; }
  }
  if (!raw) return null;
  const payload = await verifyToken(decodeURIComponent(raw), "session");
  if (!payload || !payload.agent) return null;
  return { email: payload.email, agent: payload.agent };
}

const COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Lax; Path=/";

export function sessionSetCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${COOKIE_ATTRS}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function sessionClearCookie(): string {
  return `${SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}
