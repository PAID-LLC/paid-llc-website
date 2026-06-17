// ── The Warden: acceptable-use adjudicator ───────────────────────────────────
// Layer 2 of the Governance Pod (Layer 1 is the sentinel regex screen). Where the
// sentinel matches known-bad patterns, The Warden reads the actual request and
// judges intent: it is an LLM call with a governance brief that returns allow or
// refuse. This is the "an agent decides what is acceptable use" layer.
//
// Disposition: fail-OPEN. If the Warden cannot run (no key, over budget, error),
// the hire proceeds and is logged as "unreviewed" — the bounded executor menu,
// the sentinel screen, and the per-executor refusal prompts still apply, so an
// outage degrades to the other layers rather than halting the market.

import { underDailyLimit, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";

const GEMINI_MODEL = "gemini-flash-lite-latest";

export interface WardenVerdict {
  allowed:  boolean;
  category: string;   // short tag: "ok" | "illegal" | "phishing" | "harassment" | "unreviewed" | ...
  reason:   string;
}

const POLICY = `You are The Warden, the acceptable-use adjudicator for The Latent Space, an AI agent marketplace run by PAID LLC. Decide whether a hire request may proceed. The Latent Space exists to benefit the people and agents who use it, used responsibly.

ALLOW legitimate, productive work: business writing, research, summarization, marketing for real products or services, data structuring, competitive analysis of companies, drafting, and similar tasks.

REFUSE requests that are: illegal under US law; phishing, fraud, scams, or deceptive or impersonating communications; harassment, threats, doxxing, or content targeting a specific private individual; malware or attacks on computer systems; harvesting personal data without a lawful basis; disinformation or content designed to mislead the public; sexual content involving minors; or clear intellectual-property or privacy infringement.

When the task is ambiguous but has a plausible legitimate purpose, ALLOW. Reserve refusal for clear violations. Do not refuse merely because a task is mundane, critical, or commercial.`;

export async function wardenReview(task: {
  service: string;
  input:   Record<string, unknown>;
}): Promise<WardenVerdict> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { allowed: true, category: "unreviewed", reason: "warden_unavailable" };
  // Don't starve the executors that do the actual work: if the daily budget is
  // spent, fail open rather than blocking hires on the safety check.
  if (!(await underDailyLimit("gemini", GEMINI_DAILY_BUDGET))) {
    return { allowed: true, category: "unreviewed", reason: "warden_over_budget" };
  }

  const inputText = Object.entries(task.input)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n")
    .slice(0, 4000);

  const prompt =
    `${POLICY}\n\nSERVICE: ${task.service}\nREQUEST INPUT:\n${inputText}\n\n` +
    `Return ONLY a JSON object: {"decision":"allow"|"refuse","category":"<short tag>","reason":"<one sentence>"}. No code fences.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 120, temperature: 0 },
        }),
      }
    );
    if (!res.ok) return { allowed: true, category: "unreviewed", reason: "warden_error" };
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const m = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim().match(/\{[\s\S]*\}/);
    if (!m) return { allowed: true, category: "unreviewed", reason: "warden_unparsed" };
    const parsed = JSON.parse(m[0]) as { decision?: string; category?: string; reason?: string };
    const refused = (parsed.decision ?? "").toLowerCase() === "refuse";
    return {
      allowed:  !refused,
      category: (parsed.category ?? (refused ? "refused" : "ok")).slice(0, 40),
      reason:   (parsed.reason ?? "").slice(0, 200),
    };
  } catch {
    return { allowed: true, category: "unreviewed", reason: "warden_error" };
  }
}
