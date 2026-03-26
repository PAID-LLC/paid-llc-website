import { moderateContent } from "@/lib/content-moderation";

// ── Sentinel: Input/Output Guard ──────────────────────────────────────────────
// Layer 1 of the Governance Pod.
// sentinelCheck — gate inbound user-supplied text before it reaches Supabase or an LLM.
// maskPii       — scrub outbound content before returning to MCP callers.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all )?(previous|prior|above) (instructions?|prompts?|context)/i,
  /you are now\b/i,
  /disregard (your|all|any)/i,
  /system\s*prompt\s*:/i,
  /\[INST\]/i,
  /\[\[SYSTEM\]\]/i,
  /<\|im_start\|>/i,
  // Sentence-boundary guard: "act as X" but not "act as judge/referee/neutral/moderator"
  /(^|\.\s+)act as (a |an )?(?!judge|referee|neutral|moderator)/i,
  /jailbreak/i,
  /developer mode\b/i,
  /\bDAN\b.*mode/i,
  /do anything now/i,
  /decode (the following|this) base64/i,
  /\[START OF RESPONSE\]/i,
  /pretend (you are|you're) (not|without) (restrictions|filters|guidelines)/i,
];

const PII_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,   // email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,              // phone
  /\b\d{3}-\d{2}-\d{4}\b/,                          // SSN
];

export function sentinelCheck(text: string): { allowed: boolean; reason?: string } {
  // Step 1: existing moderation (hate speech, threats, spam)
  const mod = moderateContent(text);
  if (!mod.allowed) return mod;
  // Step 2: prompt injection patterns
  for (const p of INJECTION_PATTERNS) {
    if (p.test(text)) return { allowed: false, reason: "Content rejected: potential prompt injection." };
  }
  return { allowed: true };
}

export function maskPii(text: string): string {
  let out = text;
  for (const p of PII_PATTERNS) out = out.replace(p, "[REDACTED]");
  return out;
}
