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

// ── SSRF guard ────────────────────────────────────────────────────────────────
// summarize_url fetches an agent-supplied URL server-side. Block loopback,
// link-local (incl. cloud metadata 169.254.169.254), and private/CGNAT ranges
// so the executor can't be used as a confused deputy to probe internal hosts.
// Literal-IP and hostname checks only — Cloudflare's edge can't resolve DNS for
// us, but it also can't route to private infra, so the residual rebind risk is low.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  // IPv4 literal in loopback / link-local / private / CGNAT ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;            // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
  }
  return false;
}

// ── Fetch + strip a page to plain text (for summarize_url) ────────────────────
async function fetchReadable(url: string, maxChars = 16000): Promise<string | null> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (isBlockedHost(parsed.hostname)) return null;

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

// ── Phase 4 executors ─────────────────────────────────────────────────────────
// All Gemini-only (plus fetchReadable for the URL-based one), so they deliver the
// moment GEMINI_API_KEY is live — no new external dependency. Each enforces house
// style (no em dashes) in its prompt where it produces prose.

/** Best-effort JSON parse of a model response: strips code fences, then parses.
 *  Returns null on any failure so the executor can refund cleanly. */
function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Last resort: grab the first {...} or [...] block.
  const m = cleaned.match(/[[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
}

/** Split a model response into clean, non-empty lines with list markers stripped. */
function toLines(raw: string, max = 12): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•\d.)]+)\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, max);
}

// Proofread + tighten copy, enforcing PAID LLC house style (no em dashes).
const proofread: Executor = async (input) => {
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 6000) : "";
  if (!text) return null;
  const out = await geminiText(
    `Proofread and tighten the following text. Fix grammar, spelling, and clarity. ` +
    `Enforce these house rules: no em dashes (use periods, commas, or colons instead), ` +
    `no filler phrases, plain direct language. Preserve the author's meaning and voice. ` +
    `Return only the corrected text, no commentary.\n\nTEXT:\n${text}`,
    900
  );
  if (!out) return null;
  const edited = out.replace(/[—–]/g, ", ").trim();
  return {
    result: { original_chars: text.length, edited, house_style: "no em dashes; plain language" },
    fields: ["edited"],
  };
};

// Pull structured fields out of unstructured text into a JSON object.
const extractData: Executor = async (input) => {
  const text   = typeof input.text   === "string" ? input.text.trim().slice(0, 6000) : "";
  const fields = typeof input.fields === "string" ? input.fields.trim().slice(0, 300) : "";
  if (!text || !fields) return null;
  const out = await geminiText(
    `Extract the following fields from the text and return ONLY a JSON object whose keys are ` +
    `exactly these fields: ${fields}. Use null for any field not present. No prose, no code fences.\n\n` +
    `TEXT:\n${text}`,
    700
  );
  if (!out) return null;
  const parsed = parseJsonLoose(out);
  if (!parsed || typeof parsed !== "object") return null;
  return {
    result: { fields_requested: fields, extracted: parsed as Record<string, unknown> },
    fields: ["extracted"],
  };
};

// Fetch a competitor's page and return a structured teardown.
const competitorTeardown: Executor = async (input) => {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!url) return null;
  const body = await fetchReadable(url);
  if (!body) return null;
  const out = await geminiText(
    `You are a product strategist. Based on this competitor web page, produce a teardown. ` +
    `Return ONLY a JSON object with keys: "positioning" (one sentence), "strengths" (array of ` +
    `3-5 short strings), "weaknesses" (array of 3-5 short strings), "opportunities" (array of ` +
    `2-4 short strings, gaps a challenger could exploit). No em dashes. No code fences.\n\n` +
    `PAGE CONTENT:\n${body}`,
    800
  );
  if (!out) return null;
  const parsed = parseJsonLoose(out);
  if (!parsed || typeof parsed !== "object") return null;
  return {
    result: { source_url: url, teardown: parsed as Record<string, unknown> },
    fields: ["teardown"],
  };
};

// Generate a social post pack: LinkedIn + X variants on a topic.
const socialPack: Executor = async (input) => {
  const topic = typeof input.topic === "string" ? input.topic.trim().slice(0, 400) : "";
  if (!topic) return null;
  const li = await geminiText(
    `Write 3 distinct LinkedIn posts about: ${topic}. Each 40-80 words, professional and modern, ` +
    `one idea each, no hashtags, no em dashes, no emojis. Separate each post with a line containing only "---".`,
    700
  );
  const x = await geminiText(
    `Write 3 distinct posts for X (Twitter) about: ${topic}. Each under 270 characters, punchy, ` +
    `no hashtags, no em dashes, no emojis. Separate each post with a line containing only "---".`,
    500
  );
  if (!li && !x) return null;
  const split = (s: string | null) =>
    (s ?? "").split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  return {
    result: { topic, linkedin: split(li), x: split(x) },
    fields: ["linkedin", "x"],
  };
};

// Turn meeting notes or a transcript into a summary + action items.
const meetingNotes: Executor = async (input) => {
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 8000) : "";
  if (!text) return null;
  const summary = await geminiText(
    `Summarize these meeting notes in 3-5 tight bullet points. No preamble, no em dashes. ` +
    `Just the bullets, one per line.\n\nNOTES:\n${text}`,
    400
  );
  const actions = await geminiText(
    `Extract every action item from these meeting notes. Return one action per line in the form ` +
    `"owner: task" when an owner is identifiable, otherwise just the task. No preamble, no em dashes. ` +
    `If there are no action items, return the single word NONE.\n\nNOTES:\n${text}`,
    400
  );
  if (!summary && !actions) return null;
  const actionItems = actions && !/^\s*none\s*$/i.test(actions) ? toLines(actions) : [];
  return {
    result: { summary: summary ? toLines(summary) : [], action_items: actionItems },
    fields: ["summary", "action_items"],
  };
};

const EXECUTORS: Record<string, Executor> = {
  summarize_url:       summarizeUrl,
  draft_cold_email:    draftColdEmail,
  score_response:      scoreResponse,
  proofread:           proofread,
  extract_data:        extractData,
  competitor_teardown: competitorTeardown,
  social_pack:         socialPack,
  meeting_notes:       meetingNotes,
};

/** Look up a house executor by key. Returns null for unknown keys. */
export function getExecutor(key: string | undefined | null): Executor | null {
  if (!key) return null;
  return EXECUTORS[key] ?? null;
}
