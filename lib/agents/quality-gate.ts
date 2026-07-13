// ── Bazaar quality gate ──────────────────────────────────────────────────────
// Judge-or-refund on house-executed services: a buyer can never pay for output
// we know is below the bar. Built to the abuse-economics invariants in the
// spec (cowork references/autoresearch/2026-07-10-bazaar-quality-gate-spec-v1.md):
// garbage never generates (deterministic pre-check, zero tokens), revision
// happens at most once and only for near-misses, judge unavailability delivers
// unscored rather than refunding probably-fine work, and every quality refund
// consumes a per-buyer daily allowance so refund farming caps out cheaply.
//
// All model calls go through geminiText, so the global daily Gemini budget
// guard binds here structurally — the gate can never spend past the cap.

import { geminiText, parseJsonLoose, quarantine } from "@/lib/agents/service-executors";

/** Judge score required to deliver. Tighten from live data, not vibes. */
export const QUALITY_BAR = 75;
/** Scores in [REVISE_BAND_MIN, QUALITY_BAR) get one revision; below it the
 *  draft is refunded immediately — revise tokens are not spent on hopeless
 *  output, which is exactly the adversarial-input case. */
export const REVISE_BAND_MIN = 55;
export const RUBRIC_VERSION = "v1";
/** Quality refunds per buyer per day. Generous for honest use, a hard wall
 *  for farming. Infra-fault refunds (executor_unavailable) never count. */
export const QUALITY_REFUNDS_PER_DAY = 3;

// ── Rubrics v1 ────────────────────────────────────────────────────────────────
// One per executor, mirroring what the listing sells. The judge scores against
// these; they are also the contract a future public "scored or refunded" claim
// points at, so keep them plain-language and honest.

const RUBRICS: Record<string, string> = {
  summarize_url:
    "4-6 bullets; each bullet states a concrete fact or claim from the page, not filler; " +
    "no invented information; together they cover the page's main purpose; useful to someone who has not read the page.",
  draft_cold_email:
    "Subject is specific and non-spammy; body under 120 words; opens with relevance to the target company, " +
    "not the sender; exactly one clear call to action; no filler or generic flattery; claims are plausible and honest.",
  score_response:
    "Score is consistent with the stated criteria; rationale names a specific strength or weakness " +
    "of the evaluated text rather than restating the number.",
  proofread:
    "Grammar and spelling corrected; the author's meaning and voice preserved; tighter than the original " +
    "where possible; no em dashes; no new claims introduced.",
  extract_data:
    "Every requested field is present as a key; values actually appear in or are directly supported by " +
    "the source text; null is used where a field is absent rather than a guess.",
  competitor_teardown:
    "Positioning is one accurate sentence; strengths and weaknesses are specific to this company, " +
    "not generic business platitudes; opportunities are actionable gaps a challenger could exploit.",
  social_pack:
    "Three genuinely distinct angles per platform, not rephrasings of one idea; each post self-contained " +
    "with a real hook; X posts under 280 characters; no hashtags, no emojis; honest claims.",
  meeting_notes:
    "Summary captures the decisions and topics actually present in the notes; every action item is " +
    "traceable to the notes; owners are attributed only when the notes name them.",
  humanize_text:
    "Reads naturally with varied sentence rhythm; every fact and claim from the original preserved; " +
    "no new claims; stiff transitions, hedging, and generic openers removed.",
  product_descriptions:
    "All components present (short, medium, long, bullets, seo_title); no invented specs, materials, or " +
    "certifications; length ranges respected; bullets are concrete features, not adjectives; seo_title under 60 characters.",
  prompt_upgrade:
    "Improved prompt is materially more specific and structured than the original; the why items name real " +
    "prompting principles; the two variants are genuinely different approaches worth testing.",
  website_audit_brief:
    "Positioning is accurate to the page; messaging issues and quick wins are specific to this page's actual " +
    "copy and implementable today, not generic advice; the clarity score is justified by the issues named.",
};

const DEFAULT_RUBRIC =
  "The output completely fulfills the service's promise as named, is specific to the buyer's input rather " +
  "than generic, contains no fabricated information, and is polished enough to charge money for.";

export function rubricFor(executorKey: string | undefined | null): string {
  return (executorKey && RUBRICS[executorKey]) || DEFAULT_RUBRIC;
}

// ── Garbage-input pre-check (deterministic, zero tokens) ─────────────────────
// Invariant I1: input that cannot plausibly produce paid-quality work is
// rejected before the Warden, escrow, or any model call. Conservative on
// purpose — falsely rejecting an honest buyer is a worse failure than a few
// wasted drafts, so only the unambiguous cases fail here.

/** Minimum trimmed length for the fields that carry the buyer's real payload.
 *  URL-based executors are absent: the executor's own URL parse + fetch is
 *  already the stronger check. */
const CONTENT_MINIMUMS: Record<string, Record<string, number>> = {
  score_response:       { text: 40 },
  proofread:            { text: 40 },
  extract_data:         { text: 40, fields: 3 },
  social_pack:          { topic: 8 },
  meeting_notes:        { text: 60 },
  humanize_text:        { text: 40 },
  product_descriptions: { product: 3, details: 30 },
  prompt_upgrade:       { prompt: 15 },
  draft_cold_email:     { company: 2 },
};

/** Cheap noise heuristics, applied only to substantial text fields. */
function looksLikeNoise(text: string): string | null {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters / text.length < 0.35) return "is mostly non-text characters";
  if (/(.)\1{19,}/.test(text)) return "contains long repeated character runs";
  if (new Set(text.toLowerCase().replace(/\s/g, "")).size < 8) {
    return "has too little variety to be working text";
  }
  return null;
}

export function garbageCheck(
  executorKey: string | undefined | null,
  input: Record<string, unknown>
): { ok: true } | { ok: false; reason: string } {
  const minimums = executorKey ? CONTENT_MINIMUMS[executorKey] : undefined;
  if (!minimums) return { ok: true };
  for (const [field, min] of Object.entries(minimums)) {
    const raw = input[field];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text.length < min) {
      return {
        ok: false,
        reason: `input.${field} is too short to produce paid-quality work (needs at least ${min} characters)`,
      };
    }
    if (min >= 30) {
      const noise = looksLikeNoise(text);
      if (noise) return { ok: false, reason: `input.${field} ${noise}` };
    }
  }
  return { ok: true };
}

// ── Result post-processing: autofix + lint ───────────────────────────────────

/** Walk every string leaf of a JSON-ish value through `fn`. */
function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}

function stringLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringLeaves(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) stringLeaves(v, out);
  return out;
}

/** Free deterministic fixes — applied before any judging so tokens are never
 *  spent revising what a regex repairs (house style: no em dashes). */
function autoFix(result: Record<string, unknown>): Record<string, unknown> {
  return mapStrings(result, (s) => s.replace(/\s*[—–]\s*/g, ", ")) as Record<string, unknown>;
}

/** Deterministic style/format violations. These never refund on their own —
 *  they sharpen the revise critique and give the judge concrete failures. */
export function lintResult(executorKey: string | undefined | null, result: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const leaves = stringLeaves(result);

  for (const leaf of leaves) {
    if (leaf.length >= 60 && /^\s*(sure|certainly|here (is|are)|i('ve| have) (written|created))\b/i.test(leaf)) {
      violations.push("output opens with meta commentary instead of the deliverable");
      break;
    }
  }
  if (leaves.some((l) => /\b(as an ai|i cannot assist|i am unable to)\b/i.test(l))) {
    violations.push("output contains a partial refusal instead of the deliverable");
  }

  if (executorKey === "social_pack") {
    const r = result as { linkedin?: unknown; x?: unknown };
    const posts = [...(Array.isArray(r.linkedin) ? r.linkedin : []), ...(Array.isArray(r.x) ? r.x : [])];
    if (posts.some((p) => typeof p === "string" && /#\w/.test(p))) violations.push("posts contain hashtags (forbidden)");
    if (posts.some((p) => typeof p === "string" && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(p))) {
      violations.push("posts contain emojis (forbidden)");
    }
    if (Array.isArray(r.x) && r.x.some((p) => typeof p === "string" && p.length > 280)) {
      violations.push("an X post exceeds 280 characters");
    }
  }

  if (executorKey === "draft_cold_email") {
    const r = result as { subject?: unknown; body?: unknown };
    if (typeof r.subject === "string" && r.subject.length > 90) violations.push("subject line over 90 characters");
    if (typeof r.body === "string" && r.body.split(/\s+/).length > 150) violations.push("body exceeds 150 words (listing promises under 120)");
  }

  return violations;
}

// ── Judge + reviser ──────────────────────────────────────────────────────────

async function judge(
  serviceName: string,
  executorKey: string | undefined | null,
  input: Record<string, unknown>,
  result: Record<string, unknown>
): Promise<{ score: number; rationale: string } | null> {
  const out = await geminiText(
    `You are a strict quality judge for a paid micro-service. A buyer paid real money for this output. ` +
    `Score it 0-100 against the rubric. Be demanding: 75+ means you would confidently charge for it, ` +
    `below 55 means it is not salvageable with one edit.\n` +
    `SERVICE: ${serviceName}\n` +
    `RUBRIC: ${rubricFor(executorKey)}\n` +
    `BUYER INPUT (JSON, may be truncated):\n${quarantine("BUYER_INPUT", JSON.stringify(input).slice(0, 1200))}\n` +
    `DELIVERED OUTPUT (JSON, may be truncated):\n${quarantine("DELIVERED_OUTPUT", JSON.stringify(result).slice(0, 2600))}\n` +
    `Return exactly: "SCORE: <number>" on the first line, then one sentence of rationale naming the ` +
    `biggest strength or defect. No markdown.`,
    200,
    0.2
  );
  if (!out) return null;
  const m = out.match(/SCORE:\s*(\d{1,3})/i);
  if (!m) return null;
  const score = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  const rationale = out.replace(/SCORE:\s*\d{1,3}/i, "").trim().slice(0, 300) || "No rationale produced.";
  return { score, rationale };
}

/** One generic revision pass for any executor's JSON result. Returns null if
 *  the model fails or the revision drops keys — the caller then falls back to
 *  the original draft's verdict. */
async function revise(
  serviceName: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>,
  critique: string
): Promise<Record<string, unknown> | null> {
  const out = await geminiText(
    `You produced a draft result for a paid micro-service, and a quality judge found problems. ` +
    `Fix them. Keep everything that is already good. No em dashes anywhere.\n` +
    `SERVICE: ${serviceName}\n` +
    `BUYER INPUT (JSON, may be truncated):\n${quarantine("BUYER_INPUT", JSON.stringify(input).slice(0, 1200))}\n` +
    `YOUR DRAFT (JSON):\n${quarantine("DRAFT", JSON.stringify(result).slice(0, 2600))}\n` +
    `JUDGE CRITIQUE: ${quarantine("CRITIQUE", critique.slice(0, 500))}\n` +
    `Return ONLY the corrected JSON object with exactly the same keys as the draft. No code fences, no commentary.`,
    1000,
    0.5
  );
  if (!out) return null;
  const parsed = parseJsonLoose(out);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const revised = parsed as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!(key in revised)) return null;   // dropped a contract field — unusable
  }
  return revised;
}

// ── Gate orchestration ───────────────────────────────────────────────────────

export interface QualityOutcome {
  deliver: boolean;
  /** Final result (possibly revised), with the quality receipt attached. */
  result: Record<string, unknown>;
  judged: boolean;
  revised: boolean;
  score: number | null;
  rationale?: string;
}

function withReceipt(
  result: Record<string, unknown>,
  q: { judged: boolean; revised: boolean; score: number | null; rationale?: string }
): Record<string, unknown> {
  return {
    ...result,
    quality: {
      judged: q.judged,
      score: q.score,
      bar: QUALITY_BAR,
      rubric_version: RUBRIC_VERSION,
      revised: q.revised,
      ...(q.rationale ? { rationale: q.rationale.slice(0, 240) } : {}),
      ...(q.judged ? {} : { note: "quality judge unavailable; delivered unscored" }),
    },
  };
}

export async function qualityGate(args: {
  serviceName: string;
  executorKey: string | undefined | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}): Promise<QualityOutcome> {
  let result = autoFix(args.result);
  const violations = lintResult(args.executorKey, result);

  const first = await judge(args.serviceName, args.executorKey, args.input, result);
  if (!first) {
    // Budget spent or transient failure. Fail OPEN and deliver unscored:
    // refunding probably-fine work on a judging hiccup is the cost leak this
    // gate exists to prevent (spec I7). The receipt says judged:false.
    return {
      deliver: true, judged: false, revised: false, score: null,
      result: withReceipt(result, { judged: false, revised: false, score: null }),
    };
  }

  let { score, rationale } = first;
  let revised = false;

  if (score >= REVISE_BAND_MIN && score < QUALITY_BAR) {
    const critique = [rationale, ...violations].filter(Boolean).join("; ");
    const better = await revise(args.serviceName, args.input, result, critique);
    if (better) {
      const second = await judge(args.serviceName, args.executorKey, args.input, autoFix(better));
      if (second) {
        revised = true;
        if (second.score > score) {
          result = autoFix(better);
          score = second.score;
          rationale = second.rationale;
        }
      }
    }
  }

  return {
    deliver: score >= QUALITY_BAR,
    judged: true,
    revised,
    score,
    rationale,
    result: withReceipt(result, { judged: true, revised, score, rationale }),
  };
}
