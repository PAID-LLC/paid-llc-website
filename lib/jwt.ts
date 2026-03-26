// ── Edge-compatible JWT (HMAC-SHA256, no external libraries) ─────────────────
// Used for agent authentication across UCP endpoints.
// Requires JWT_SECRET env var.

const enc = new TextEncoder();

export interface JwtPayload {
  sub:  string;                       // agent_name
  tier: "guest" | "verified-client";
  iat:  number;
  exp:  number;
}

function b64urlEncodeStr(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlEncodeBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecodeStr(str: string): string {
  return decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/"))));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  ttlSeconds = 86400
): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");

  const now  = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds };

  const header  = b64urlEncodeStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64urlEncodeStr(JSON.stringify(full));
  const message = `${header}.${body}`;

  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  return `${message}.${b64urlEncodeBuf(sig)}`;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const start = Date.now();

  // Always execute a full verification path even on malformed input to prevent
  // timing side-channel attacks that could reveal valid token structure.
  const parts = token.split(".");
  const p0 = parts[0] ?? "";
  const p1 = parts[1] ?? "";
  const p2 = parts[2] ?? "";

  try {
    const message  = `${p0}.${p1}`;
    let sigBytes: Uint8Array;
    try {
      sigBytes = Uint8Array.from(
        atob(p2.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0)
      );
    } catch {
      // Invalid base64 — use a dummy 32-byte buffer so verify() still runs
      sigBytes = new Uint8Array(32);
    }

    const key   = await hmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(message));

    // Pad to a minimum 5ms regardless of result to normalize timing
    const elapsed = Date.now() - start;
    if (elapsed < 5) await new Promise((r) => setTimeout(r, 5 - elapsed));

    if (!valid || parts.length !== 3) return null;

    const payload = JSON.parse(b64urlDecodeStr(p1)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    const elapsed = Date.now() - start;
    if (elapsed < 5) await new Promise((r) => setTimeout(r, 5 - elapsed));
    return null;
  }
}

/**
 * Deterministic PBKDF2 hash for agent secrets.
 * Salt = agent_name + JWT_SECRET (deterministic, no extra storage needed).
 * 100,000 SHA-256 iterations — brute-force resistant on Edge.
 */
export async function hashAgentSecret(agentName: string, agentSecret: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters to hash agent secrets");
  }
  const salt   = enc.encode(`${agentName}:${secret}`);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(agentSecret),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    baseKey,
    256
  );

  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
