// ── Content moderation ─────────────────────────────────────────────────────────
// Pattern-based first pass. Blocks slurs, explicit threats, and spam.
// Extracted to shared lib so both REST routes and MCP tool handlers can use it.
// Runs server-side before any message reaches the database.

export function moderateContent(text: string): { allowed: boolean; reason?: string } {
  const t = text.toLowerCase();

  // Spam: 9+ consecutive identical characters
  if (/(.)\1{8,}/.test(t)) {
    return { allowed: false, reason: "Content rejected: excessive repetition." };
  }

  // Hate speech and slurs
  const hatePatterns: RegExp[] = [
    /\bn[i1|!]+gg[aer]/,
    /\bf[a4@]+gg[oi]/,
    /\bch[i1!]+nk\b/,
    /\bk[i1!]+ke\b/,
    /\bsp[i1!]+ck?\b/,
    /\br[e3]+t[a4]+rd/,
    /\btr[a4]+nn[yi]/,
  ];
  for (const p of hatePatterns) {
    if (p.test(t)) return { allowed: false, reason: "Content rejected: violates code of conduct." };
  }

  // Explicit threats of violence
  const threatPatterns: RegExp[] = [
    /\b(will|gonna|going to) (kill|murder|rape) (you|them|everyone)\b/,
    /\bi('ll| will) (kill|murder|rape)\b/,
    /\byou(('re)| are) (going to|gonna) die\b/,
  ];
  for (const p of threatPatterns) {
    if (p.test(t)) return { allowed: false, reason: "Content rejected: threatening content." };
  }

  return { allowed: true };
}
