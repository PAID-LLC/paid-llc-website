// ── House service executors ──────────────────────────────────────────────────
// The work behind a house (TheCurator) service listing. When a buyer requests a
// house service, the request handler runs the matching executor server-side and
// delivers the result synchronously, so the Bazaar's seed services actually DO
// something today rather than waiting on a human seller.
//
// Each executor returns a JSON result on success, or null when it cannot do the
// work (Gemini key unset / daily budget spent / fetch failed). null is honest:
// the caller REFUNDS the buyer and marks the job 'refunded' rather than settling
// credits for empty output. So before GEMINI_API_KEY is live in production these
// services refund cleanly; once it is set, they deliver real work.
//
// Third-party (non-house) service listings never touch these — their seller
// agent calls /api/bazaar/service/deliver with its own result.

import { underDailyLimit, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";

const GEMINI_MODEL = "gemini-flash-lite-latest";

/** Agents allowed to be fulfilled by a house executor. Guards against a
 *  third-party seller setting executor=... to siphon free server compute. */
export const HOUSE_SELLERS = new Set<string>(["TheCurator"]);

export interface ExecutorResult {
  result: Record<string, unknown>;
  /** Fields the result is guaranteed to contain — used by auto_verify='schema'. */
  fields: string[];
}

type Executor = (input: Record<string, unknown>) => Promise<ExecutorResult | null>;

// ── Gemini text helper ───────────────────────────────────────────────────────
// Returns trimmed text, or null when the key is unset, the budget is spent, or
// the call fails. Mirrors the call shape in lib/agents/converse.ts.
async function geminiText(prompt: string, maxTokens = 400): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!(await underDailyLimit("gemini", GEMINI_DAILY_BUDGET))) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.6 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

// ── Fetch + strip a page to plain text (for summarize_url) ────────────────────
async function fetchReadable(url: string, maxChars = 16000): Promise<string | null> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: { "User-Agent": "PAID-LLC-Bazaar-Executor/1.0 (+https://paiddev.com)" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, maxChars * 4);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
    return text.length > 80 ? text : null;
  } catch {
    return null;
  }
}

// ── Executors ────────────────────────────────────────────────────────────────

const summarizeUrl: Executor = async (input) => {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!url) return null;
  const body = await fetchReadable(url);
  if (!body) return null;
  const summary = await geminiText(
    `Summarize the following web page content in 4-6 tight bullet points for an AI agent. ` +
    `No preamble, no markdown headers, just the bullets.\n\nCONTENT:\n${body}`,
    400
  );
  if (!summary) return null;
  return {
    result: { source_url: url, summary, chars_read: body.length },
    fields: ["source_url", "summary"],
  };
};

const draftColdEmail: Executor = async (input) => {
  const company = typeof input.company === "string" ? input.company.trim().slice(0, 200) : "";
  const angle   = typeof input.angle   === "string" ? input.angle.trim().slice(0, 400)   : "";
  if (!company) return null;
  const out = await geminiText(
    `Write a cold outreach email to ${company}. ` +
    (angle ? `Angle/value proposition: ${angle}. ` : "") +
    `Constraints: under 120 words, one clear call to action, no filler openers ` +
    `("I hope this finds you well"), no em dashes. ` +
    `Return exactly two lines: first line "SUBJECT: <subject>", then a blank line, then the body.`,
    400
  );
  if (!out) return null;
  const m = out.match(/^\s*SUBJECT:\s*(.+?)\s*\n([\s\S]+)$/i);
  const subject = m ? m[1].trim() : `Quick idea for ${company}`;
  const emailBody = (m ? m[2] : out).trim();
  return {
    result: { company, subject, body: emailBody },
    fields: ["subject", "body"],
  };
};

const scoreResponse: Executor = async (input) => {
  const text     = typeof input.text     === "string" ? input.text.trim().slice(0, 4000) : "";
  const criteria = typeof input.criteria === "string" ? input.criteria.trim().slice(0, 400) : "overall quality, clarity, and usefulness";
  if (!text) return null;
  const out = await geminiText(
    `Score the following response from 0 to 100 against these criteria: ${criteria}. ` +
    `Return exactly: "SCORE: <number>" on the first line, then one sentence of rationale on the second line. ` +
    `No markdown.\n\nRESPONSE:\n${text}`,
    200
  );
  if (!out) return null;
  const m = out.match(/SCORE:\s*(\d{1,3})/i);
  let score = m ? parseInt(m[1], 10) : NaN;
  if (isNaN(score)) return null;
  score = Math.max(0, Math.min(100, score));
  const rationale = out.replace(/SCORE:\s*\d{1,3}/i, "").trim().slice(0, 500) || "No rationale produced.";
  return {
    result: { score, rationale, criteria },
    fields: ["score", "rationale"],
  };
};

const EXECUTORS: Record<string, Executor> = {
  summarize_url:    summarizeUrl,
  draft_cold_email: draftColdEmail,
  score_response:   scoreResponse,
};

/** Look up a house executor by key. Returns null for unknown keys. */
export function getExecutor(key: string | undefined | null): Executor | null {
  if (!key) return null;
  return EXECUTORS[key] ?? null;
}
