// ── The two model calls ──────────────────────────────────────────────────────
// Gemini does exactly two things per video, and neither of them is anything code
// could do:
//
//   1. Watch the video. A YouTube URL goes in as a file_data part and three
//      sentences come out. There is no non-model way to say what a video is.
//   2. Judge which of 25 pre-cleared jokes is funniest, given what the video is.
//      Humour is contextual; a lexicon cannot do it.
//
// Everything else on this page — sentiment, themes, bot share, the candidate
// shortlist, the headline — is computed in code before either call is made. The
// model never sees the raw comment dump, only a ~55-line digest.
//
// COST SHAPE. The video call is by far the largest request this site makes:
// clipped to 12 minutes at 0.25 fps it is roughly 35,000 input tokens, against
// 700 for a lounge chat reply. That is why it has its own counter rather than
// riding the shared "gemini" one — /api/econ/status prices per-counter, and
// billing five video calls at the chat rate would under-report the day by 50x.
//
// EVERY function here returns null rather than throwing. A Gemini failure
// degrades the card (see edition.ts); it never skips a video and never fails a
// run. Budget exhaustion is the most likely failure mode and it would otherwise
// take out all five videos at once.

import { underDailyLimit, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import { quarantine } from "@/lib/agents/service-executors";
import type { EditorialJson, ScoredComment, VideoAnalysis } from "./types";
import { signalLabel } from "./bots";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Video-understanding calls per day. Five videos plus retries. */
export const COMMENTS_VIDEO_DAILY = 8;
/** Editorial + fallback-summary + teaser calls per day. */
export const COMMENTS_TEXT_DAILY = 14;

/** Only the first 12 minutes are watched. Tokens scale linearly with duration. */
const CLIP_END = "720s";
/** One frame every four seconds. Enough to tell what a video is; 4x cheaper. */
const CLIP_FPS = 0.25;

const VIDEO_TIMEOUT_MS = 90_000;
const TEXT_TIMEOUT_MS = 20_000;

export interface GeminiUsage {
  in: number;
  out: number;
  ms: number;
}

interface CallResult {
  text: string;
  usage: GeminiUsage;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * One request, both budget gates, a hard timeout, and no throwing.
 *
 * Gate order is deliberate: the global "gemini" counter first so this feature
 * cannot starve the rest of the site, then the feature counter so the rest of
 * the site cannot be starved by a runaway here.
 */
async function callGemini(
  body: unknown,
  opts: { counter: string; cap: number; timeoutMs: number }
): Promise<CallResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!(await underDailyLimit("gemini", GEMINI_DAILY_BUDGET))) return null;
  if (!(await underDailyLimit(opts.counter, opts.cap))) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    return {
      text,
      usage: {
        in: data.usageMetadata?.promptTokenCount ?? 0,
        out: data.usageMetadata?.candidatesTokenCount ?? 0,
        ms: Date.now() - started,
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * House style, applied to every line of model prose before it is stored.
 * Em dashes are a standing rule for published text on this site and the model
 * reaches for them constantly, so it is enforced here rather than in the prompt.
 */
export function cleanProse(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\*\*/g, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. What is this video ────────────────────────────────────────────────────

/**
 * Watches the first 12 minutes and describes the video.
 *
 * The YouTube URL goes straight in as a file_data part: no download, no upload,
 * no storage of the video anywhere on our side. videoMetadata clips and
 * subsamples before tokenisation, which is where the cost saving happens.
 */
export async function geminiVideoSummary(
  videoId: string,
  title: string
): Promise<CallResult | null> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` },
            videoMetadata: { startOffset: "0s", endOffset: CLIP_END, fps: CLIP_FPS },
          },
          {
            text:
              `You are watching the first minutes of a public video titled ` +
              `${quarantine("TITLE", title)}.\n\n` +
              `Write 2 to 4 plain sentences for a reader who has not seen it: what it is, ` +
              `who is in it, what actually happens, and why people might be watching. ` +
              `If it is a music video or a performance, say so and describe the mood.\n\n` +
              `Rules: no preamble, no markdown, no hashtags, no em dashes, no hype words ` +
              `like "stunning" or "incredible". Do not speculate about anyone's private ` +
              `life, health, relationships, or motives. Describe only what is on screen.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 350,
      mediaResolution: "MEDIA_RESOLUTION_LOW",
    },
  };

  const result = await callGemini(body, {
    counter: "comments_video",
    cap: COMMENTS_VIDEO_DAILY,
    timeoutMs: VIDEO_TIMEOUT_MS,
  });
  return result ? { ...result, text: cleanProse(result.text) } : null;
}

/**
 * Fallback when the video call fails: describe it from metadata and reactions.
 * Weaker, and labelled as such in the analysis (`summarySource: "text"`), but a
 * card with a thin summary beats a blank page on a day the preview API hiccups.
 */
export async function geminiTextSummary(
  title: string,
  description: string,
  topComments: { text: string }[]
): Promise<CallResult | null> {
  const reactions = topComments
    .slice(0, 15)
    .map((c, i) => `${i + 1}. ${c.text.slice(0, 200)}`)
    .join("\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Describe a public video for a reader who has not seen it, using only ` +
              `the material below. You cannot watch it, so do not claim to have.\n\n` +
              `${quarantine("TITLE", title)}\n\n` +
              `${quarantine("DESCRIPTION", description.slice(0, 1200))}\n\n` +
              `${quarantine("TOP_REACTIONS", reactions)}\n\n` +
              `Write 2 to 3 plain sentences: what the video appears to be and what its ` +
              `audience is reacting to. No preamble, no markdown, no em dashes, no hype. ` +
              `Do not speculate about anyone's private life. If the material is too thin ` +
              `to say anything specific, say what it is in one sentence and stop.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
  };

  const result = await callGemini(body, {
    counter: "comments_text",
    cap: COMMENTS_TEXT_DAILY,
    timeoutMs: TEXT_TIMEOUT_MS,
  });
  return result ? { ...result, text: cleanProse(result.text) } : null;
}

// ── 2. The editorial pass ────────────────────────────────────────────────────

/**
 * OpenAPI-flavoured schema (uppercase types) for responseSchema. First use of
 * structured output in this repo: everything else parses JSON out of prose and
 * hopes. Constraining the shape here matters because `index` is used to look up
 * a comment, so a malformed response is a wrong quote rather than a parse error.
 */
export const EDITORIAL_SCHEMA = {
  type: "OBJECT",
  properties: {
    vibe: {
      type: "STRING",
      description: "One sentence under 140 characters describing the mood of the comment section.",
    },
    themes: {
      type: "ARRAY",
      items: { type: "STRING", description: "One to three words." },
    },
    funniest: {
      type: "OBJECT",
      properties: {
        index: { type: "INTEGER", description: "Index from the CANDIDATES list only." },
        why: { type: "STRING", description: "Under 120 characters on why it lands." },
      },
      required: ["index", "why"],
    },
    runners_up: { type: "ARRAY", items: { type: "INTEGER" } },
  },
  required: ["vibe", "themes", "funniest", "runners_up"],
  propertyOrdering: ["vibe", "themes", "funniest", "runners_up"],
} as const;

/**
 * Builds the digest: code-computed statistics, the most-liked comments as
 * context, then the eligible candidates by index.
 *
 * Two properties of this string matter. It is small (about 55 lines, ~3,500
 * tokens) because everything numeric was already computed. And every comment in
 * it is quarantined, because comment sections are an adversarial input channel:
 * somebody will eventually post "ignore previous instructions" under a trending
 * video, and when they do it must read as data.
 */
export function buildDigest(
  title: string,
  summary: string | null,
  analysis: VideoAnalysis,
  top: ScoredComment[],
  candidates: ScoredComment[]
): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const a = analysis;

  const stats = [
    `Video: ${title.slice(0, 120)}`,
    summary ? `What it is: ${summary}` : null,
    `Comments analysed: ${a.analyzed}`,
    `Sentiment: ${pct(a.positiveShare)} positive, ${pct(a.neutralShare)} neutral, ${pct(a.negativeShare)} negative`,
    `Estimated automated: ${pct(a.automation.shareLikely)}`,
    a.themes.length ? `Frequent terms (computed): ${a.themes.slice(0, 8).join(", ")}` : null,
    a.emoji.length ? `Top emoji: ${a.emoji.map((e) => e.char).join(" ")}` : null,
    `Median likes: ${a.medianLikes}, most-liked comment: ${a.maxLikes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const topLines = top
    .slice(0, 30)
    .map((c, i) => `T${i} (${c.likeCount} likes): ${quarantine("C", c.text.slice(0, 200))}`)
    .join("\n");

  const candidateLines = candidates
    .map((c, i) => `C${i} (${c.likeCount} likes): ${quarantine("C", c.text.slice(0, 280))}`)
    .join("\n");

  return [
    "=== SECTION STATS (already computed, do not recalculate) ===",
    stats,
    "",
    "=== MOST LIKED (context only, NOT eligible to be picked) ===",
    topLines,
    "",
    "=== CANDIDATES (the ONLY comments you may pick from, by index) ===",
    candidateLines,
  ].join("\n");
}

/**
 * The one judgement call: which candidate is funniest, and why.
 *
 * Returns null on any failure OR any schema violation, including an index that
 * does not exist. The caller then uses a deterministic fallback, so a bad
 * response never produces a wrong quote on the page.
 */
export async function geminiEditorial(
  digest: string,
  candidateCount: number
): Promise<{ editorial: EditorialJson; usage: GeminiUsage } | null> {
  if (candidateCount === 0) return null;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `You are writing a short daily column about what a video's comment section ` +
              `was actually like. Below is a digest of one section.\n\n${digest}\n\n` +
              `Return JSON with four fields.\n` +
              `- vibe: one sentence, under 140 characters, describing the mood of the room. ` +
              `Specific and plain. No em dashes, no hype, no hashtags.\n` +
              `- themes: exactly 3 short phrases (1-3 words) for what people are talking ` +
              `about. Use the computed terms as a guide but write them readably.\n` +
              `- funniest: the index of the single funniest CANDIDATE, plus "why" in under ` +
              `120 characters. Judge it in the context of what the video is. Prefer wit, ` +
              `timing and observation over shock. Never pick something cruel about a real ` +
              `person, and never pick an insult.\n` +
              `- runners_up: exactly 2 other candidate indexes, next funniest.\n\n` +
              `Indexes must come from the CANDIDATES list and be between 0 and ` +
              `${candidateCount - 1}. All three indexes must be different. ` +
              `The MOST LIKED list is context only and must never be picked from.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 400,
      responseMimeType: "application/json",
      responseSchema: EDITORIAL_SCHEMA,
    },
  };

  const result = await callGemini(body, {
    counter: "comments_text",
    cap: COMMENTS_TEXT_DAILY,
    timeoutMs: TEXT_TIMEOUT_MS,
  });
  if (!result) return null;

  const editorial = validateEditorial(result.text, candidateCount);
  return editorial ? { editorial, usage: result.usage } : null;
}

/** Parses and range-checks the editorial response. Null on anything unexpected. */
export function validateEditorial(raw: string, candidateCount: number): EditorialJson | null {
  let parsed: unknown;
  try {
    // responseSchema should make fences impossible, but the endpoint is not the
    // only thing that has ever changed under us.
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim());
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const vibe = typeof o.vibe === "string" ? cleanProse(o.vibe).slice(0, 200) : "";
  if (!vibe) return null;

  const themes = Array.isArray(o.themes)
    ? o.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .slice(0, 3)
        .map((t) => cleanProse(t).slice(0, 30))
    : [];
  if (themes.length === 0) return null;

  const f = o.funniest as Record<string, unknown> | undefined;
  if (!f || typeof f.index !== "number" || !Number.isInteger(f.index)) return null;
  if (f.index < 0 || f.index >= candidateCount) return null;
  const why = typeof f.why === "string" ? cleanProse(f.why).slice(0, 160) : "";

  const runners = Array.isArray(o.runners_up)
    ? o.runners_up.filter(
        (n): n is number =>
          typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n < candidateCount &&
          n !== f.index
      )
    : [];

  return {
    vibe,
    themes,
    funniest: { index: f.index, why },
    runners_up: [...new Set(runners)].slice(0, 2),
  };
}

/**
 * Deterministic editorial when the model is unavailable. The shortlist is
 * already ranked by humorScore, so taking the top three is a defensible pick
 * rather than a random one; only the "why" line is lost.
 */
export function fallbackEditorial(
  analysis: VideoAnalysis,
  candidates: ScoredComment[]
): EditorialJson {
  const mood =
    analysis.positiveShare > 0.6
      ? "The room was warm about this one."
      : analysis.negativeShare > 0.35
        ? "The room was not having it."
        : "The room was split.";

  const top = analysis.automation.shareLikely > 0.15
    ? `${mood} A noticeable share of the section looked automated.`
    : mood;

  return {
    vibe: top,
    themes: analysis.themes.slice(0, 3),
    funniest: { index: candidates.length > 0 ? 0 : -1, why: "" },
    runners_up: candidates.length > 2 ? [1, 2] : candidates.length > 1 ? [1] : [],
  };
}

// ── 3. The edition teaser ────────────────────────────────────────────────────

/** One line for the OG card and social. Cheap: 60 output tokens, once a day. */
export async function geminiTeaser(
  headline: string,
  funniestText: string | null
): Promise<string | null> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Write one sentence, under 120 characters, to preview today's edition of a ` +
              `daily column about video comment sections. It should make someone curious ` +
              `enough to click, without overselling.\n\n` +
              `Today's headline: ${quarantine("HEADLINE", headline)}\n` +
              (funniestText
                ? `Today's featured comment: ${quarantine("COMMENT", funniestText.slice(0, 200))}\n`
                : "") +
              `\nNo em dashes, no hashtags, no emoji, no quotation marks. One sentence only.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.8, maxOutputTokens: 80 },
  };

  const result = await callGemini(body, {
    counter: "comments_text",
    cap: COMMENTS_TEXT_DAILY,
    timeoutMs: TEXT_TIMEOUT_MS,
  });
  return result ? cleanProse(result.text).slice(0, 200) : null;
}

/** Re-exported so the UI can label automation signals without importing bots.ts. */
export { signalLabel };
