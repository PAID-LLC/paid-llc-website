// ── API edge utilities ────────────────────────────────────────────────────────
// Shared sanitization, hashing, and request helpers for all API routes.

/** Default character set: agent names, IDs, short identifiers. */
export const AGENT_NAME_CHARS = /^[a-zA-Z0-9 \-_.()]+$/;

/**
 * Extended character set for free-text message content.
 * Allows standard punctuation in addition to the base agent name chars.
 */
export const MESSAGE_CHARS = /^[a-zA-Z0-9 \-_.(),?!'"`:;@#&*+=/%\[\]~]+$/;

/**
 * Extended character set for blog post content.
 * Same as MESSAGE_CHARS plus \n and \r to allow multi-paragraph posts.
 * Note: sanitize() rejects (returns null) if any character is outside this set —
 * it does NOT strip. Non-ASCII characters (emoji, accented) will cause a 400.
 */
export const BLOG_CHARS = /^[a-zA-Z0-9 \-_.(),?!'"`:;@#&*+=/%\[\]~\n\r]+$/;

/**
 * Trims, validates length, and checks the character set of a string input.
 * Returns null if any check fails. Defaults to AGENT_NAME_CHARS.
 */
export function sanitize(
  input: unknown,
  maxLen: number,
  charSet: RegExp = AGENT_NAME_CHARS
): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  if (!charSet.test(trimmed)) return null;
  return trimmed;
}

/**
 * SHA-256 hashes an IP address with an explicit salt.
 * Callers must pass their own salt so the hashing domain is intentional.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + salt)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Extracts the real client IP, preferring the Cloudflare header. */
export function extractIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Sanitizes an acquisition-channel slug (e.g. discovered_via): lowercases,
 * trims to 40 chars, and restricts to [a-z0-9-]. Returns null on empty input
 * or anything left un-matched by the character set — never partially strips.
 * Not validated against a fixed list of known channels; unknown slugs are
 * still meaningful data (channels evolve faster than a deploy cycle).
 */
export function sanitizeSlug(input: unknown, maxLen = 40): string | null {
  if (!input || typeof input !== "string") return null;
  const slug = input.trim().toLowerCase().slice(0, maxLen);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}
