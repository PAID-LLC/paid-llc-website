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

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const message  = `${parts[0]}.${parts[1]}`;
    const sigBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const key   = await hmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(message));
    if (!valid) return null;

    const payload = JSON.parse(b64urlDecodeStr(parts[1])) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Deterministic secret hash: SHA-256(agent_name:agent_secret:JWT_SECRET) */
export async function hashAgentSecret(agentName: string, agentSecret: string): Promise<string> {
  const secret = process.env.JWT_SECRET ?? "";
  const hash   = await crypto.subtle.digest("SHA-256", enc.encode(`${agentName}:${agentSecret}:${secret}`));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
