// ── Automation scoring ───────────────────────────────────────────────────────
// Estimates how much of a comment section is not a person typing.
//
// READ THIS BEFORE CHANGING ANYTHING HERE.
//
// Calling a named account a bot is a factual claim about a human being, made by
// a heuristic with no ground truth, on a site that publishes. So this module is
// built to make that claim impossible to render:
//
//   - scoreAutomation returns a number to its CALLER only. No per-comment score
//     is persisted. There is no column for it (see db/01-comment-section.sql).
//   - summarizeAutomation returns shares and signal COUNTS. It takes author
//     identity in and never gives any back; a unit test asserts that.
//   - humor.ts refuses any comment scoring >= 30 as a featured pick, so a name
//     never appears on the page next to an automation figure at all.
//
// The published claim is therefore "about 14% of this section looked automated",
// which is defensible, and never "this person is a bot", which is not.
//
// The signals are deliberately boring and observable. Aged-account marketplaces
// mean account age alone stopped working years ago, which is exactly why no
// single signal here can cross the threshold on its own: the weights are set so
// that "likely" needs at least two independent things to be wrong.

import type { CommentInput, ChannelInfo, AutomationSummary } from "./types";
import { extractEmoji } from "./lexicon";

/** Score at or above which a comment is counted as likely automated. */
export const LIKELY_THRESHOLD = 50;
/** Score at or above which a comment is counted as suspicious. */
export const SUSPICIOUS_THRESHOLD = 30;
/** Featured picks must score strictly below this. */
export const CLEAN_THRESHOLD = 30;

const WEIGHTS = {
  dup_text: 35,
  scam_phrase: 30,
  url_or_phone: 20,
  auto_handle: 15,
  unicode_trick: 15,
  new_account: 15,
  burst: 10,
  emoji_heavy: 10,
  unknown_channel: 10,
  no_videos: 5,
  hidden_subs: 5,
  default_avatar: 5,
} as const;

/** Phrases that recur across engagement-farm and crypto-scam comment rings. */
const SCAM_PATTERNS: RegExp[] = [
  // "WhatsApp me", "DM him", "text us".
  /\b(dm|message|text|whats ?app|telegram|tele ?gram)\s*(me|him|her|us|@|\+)/i,
  // "contact me on WhatsApp", "reach out to me via Telegram" -- the reversed
  // word order the pattern above misses, and the most common cold-pitch CTA
  // there is. Added 2026-09-15 after a real contact-form pitch using exactly
  // this phrasing scored only 20 of 100.
  /\b(contact|reach|message|text|ping|add)\s+(me|us|him|her)\b[^.]{0,30}\b(on|at|via|through)\s+(whats ?app|telegram|tele ?gram|signal|wechat|skype|viber)\b/i,
  // A messaging channel named within a line of a phone number, either order.
  /\b(whats ?app|telegram|signal|wechat|viber)\b[^.]{0,40}\+\d[\d\s().-]{7,}/i,
  /\b(invest|trading|forex|crypto|bitcoin|btc|eth|binary option)\b.{0,40}\b(profit|earn|income|expert|mentor|coach|signal)/i,
  /\b(earn|make)\s*\$?\d[\d,.]*\s*(k|usd|dollars?)?\s*(a|per|\/)\s*(day|week|month)/i,
  /\bgiveaway\b.{0,30}\b(click|link|claim|winner|selected)/i,
  /\byou('| a)?ve been (selected|chosen|picked)\b/i,
  /\b(promo|discount|coupon)\s*code\b.{0,20}\b(use|apply|enter)/i,
  /\bsubscribe (to|my|our) (my |our )?channel\b.{0,30}\b(back|sub4sub|sub 4 sub)/i,
  /\bsub ?4 ?sub\b|\bsub2sub\b|\bl4l\b|\bf4f\b/i,
  /\bhack(ed|ing)? (your|any|his|her) (account|phone|whatsapp|instagram)/i,
  /\b(recover|retrieve) (your|lost|stolen) (funds|money|crypto|wallet|account)/i,
  /\bcheck (out )?my (profile|page|bio|channel) (for|to)\b/i,
  /\bclick (the )?link (in|on) (my )?(bio|profile|description)/i,
];

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|ru|cn|link|shop|store|info|biz)\b/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/**
 * Auto-generated YouTube handles. When someone never picks a handle, YouTube
 * assigns one: "@user-xy3kq", "@channel-1234", or a display name ending in a
 * run of random characters. Common for real lurkers too, which is why this is
 * only 15 points and can never flag a comment on its own.
 */
const AUTO_HANDLE_RE = /^@?(?:user|channel|guest|account)[-_.]?[a-z0-9]{3,}$|^@?[a-z]+[-_.]?[a-z0-9]{6,}\d{2,}$/i;

/** Zero-width and confusable characters used to slip past text filters. */
// Escapes, not literal characters: an invisible codepoint pasted into source is
// exactly the kind of thing a future editor silently strips.
const UNICODE_TRICK_RE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]|[\u0430\u0435\u043E\u0440\u0441\u0445](?=[a-z])/u;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BURST_WINDOW_MS = 10 * 60 * 1000;

/** Context shared across every comment in one section. */
export interface AutomationContext {
  /** normalized text -> how many DISTINCT authors posted it. */
  duplicateAuthors: Map<string, number>;
  channels: Map<string, ChannelInfo>;
  videoPublishedAt: number;
  /** True when channel lookups failed, so account-age signals are unavailable. */
  channelsMissing: boolean;
}

/**
 * Collapses a comment to its recognizable core: lowercase, no punctuation, no
 * emoji, whitespace squeezed. Two comments that differ only by an emoji or an
 * exclamation mark hash the same, which is what catches a copy-paste ring that
 * sprinkles variation to dodge exact-match filters.
 */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds the cross-comment context. Call once per video, before scoring. */
export function buildAutomationContext(
  comments: CommentInput[],
  channels: Map<string, ChannelInfo>,
  videoPublishedAt: string
): AutomationContext {
  // Authors per normalized text. A single author repeating themselves is a
  // person being annoying; three different accounts posting the same sentence
  // is a ring. Only the second one scores.
  const authorsByText = new Map<string, Set<string>>();
  for (const c of comments) {
    const norm = normalizeForHash(c.text);
    if (norm.length < 8) continue; // "first" / "lol" collide innocently
    let set = authorsByText.get(norm);
    if (!set) authorsByText.set(norm, (set = new Set()));
    set.add(c.authorChannelId || c.authorDisplay);
  }

  const duplicateAuthors = new Map<string, number>();
  for (const [text, authors] of authorsByText) {
    if (authors.size >= 3) duplicateAuthors.set(text, authors.size);
  }

  const published = Date.parse(videoPublishedAt);
  return {
    duplicateAuthors,
    channels,
    videoPublishedAt: Number.isFinite(published) ? published : 0,
    channelsMissing: channels.size === 0,
  };
}

/**
 * Automation likelihood for one comment, 0-100, plus which signals fired.
 * The return value is for aggregation. Do not persist it and do not render it.
 */
export function scoreAutomation(
  c: CommentInput,
  ctx: AutomationContext
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  const add = (signal: keyof typeof WEIGHTS) => {
    signals.push(signal);
    score += WEIGHTS[signal];
  };

  // ── Text signals ───────────────────────────────────────────────────────────
  const norm = normalizeForHash(c.text);
  if (norm.length >= 8 && ctx.duplicateAuthors.has(norm)) add("dup_text");

  for (const p of SCAM_PATTERNS) {
    if (p.test(c.text)) {
      add("scam_phrase");
      break;
    }
  }

  if (URL_RE.test(c.text) || PHONE_RE.test(c.text)) add("url_or_phone");
  if (UNICODE_TRICK_RE.test(c.text)) add("unicode_trick");

  const emoji = extractEmoji(c.text);
  const bare = c.text.replace(/\s/g, "").length;
  if (bare > 10 && emoji.length / bare > 0.5) add("emoji_heavy");

  // ── Identity signals ───────────────────────────────────────────────────────
  if (AUTO_HANDLE_RE.test(c.authorDisplay.trim())) add("auto_handle");

  const channel = ctx.channels.get(c.authorChannelId);
  if (!channel) {
    // Only meaningful when we successfully looked channels up at all. When the
    // whole lookup failed, every comment would score this, which would turn a
    // YouTube outage into a fabricated bot wave.
    if (!ctx.channelsMissing) add("unknown_channel");
  } else {
    const created = Date.parse(channel.createdAt);
    if (Number.isFinite(created) && Date.now() - created < THIRTY_DAYS_MS) add("new_account");
    if (channel.videoCount === 0) add("no_videos");
    if (channel.hiddenSubs) add("hidden_subs");
    // YouTube does not label default avatars in the URL, so the only honest
    // version of this signal is "no avatar came back at all". Weak by design.
    if (!channel.avatarUrl) add("default_avatar");
  }

  // ── Timing ─────────────────────────────────────────────────────────────────
  // A short comment inside ten minutes of upload, on a video with thousands of
  // comments, is the classic first-comment farm.
  if (ctx.videoPublishedAt > 0) {
    const posted = Date.parse(c.publishedAt);
    if (
      Number.isFinite(posted) &&
      posted - ctx.videoPublishedAt < BURST_WINDOW_MS &&
      c.text.trim().length < 40
    ) {
      add("burst");
    }
  }

  return { score: Math.min(100, score), signals };
}

/**
 * Aggregate reading for the whole section.
 *
 * Takes scored comments in; gives shares and signal counts out. No identifier
 * of any kind crosses this boundary — that is the property the page's disclosure
 * depends on, and tests/api/comments-bots.test.ts asserts it.
 */
export function summarizeAutomation(
  scored: { automation: number; signals: string[]; authorChannelId: string }[],
  channelsResolved: number
): AutomationSummary {
  const n = scored.length;
  if (n === 0) {
    return {
      shareLikely: 0,
      shareSuspicious: 0,
      signals: {},
      confidence: "low",
      uniqueAuthors: 0,
      channelsResolved: 0,
    };
  }

  let likely = 0;
  let suspicious = 0;
  const signals: Record<string, number> = {};
  const authors = new Set<string>();

  for (const c of scored) {
    if (c.automation >= LIKELY_THRESHOLD) likely++;
    else if (c.automation >= SUSPICIOUS_THRESHOLD) suspicious++;
    for (const s of c.signals) signals[s] = (signals[s] ?? 0) + 1;
    if (c.authorChannelId) authors.add(c.authorChannelId);
  }

  // Confidence is about how much we actually knew, not how sure the maths is.
  // Without channel data the identity half of the signal set never fires, so the
  // number is a floor rather than an estimate and the UI says so.
  const coverage = authors.size > 0 ? channelsResolved / authors.size : 0;
  const confidence: AutomationSummary["confidence"] =
    n >= 300 && coverage > 0.8 ? "high" : n >= 100 && coverage > 0.4 ? "medium" : "low";

  return {
    shareLikely: likely / n,
    shareSuspicious: suspicious / n,
    signals,
    confidence,
    uniqueAuthors: authors.size,
    channelsResolved,
  };
}

/** Human-readable label for a signal key, for the UI's chips. */
export function signalLabel(key: string): string {
  const labels: Record<string, string> = {
    dup_text: "identical text from several accounts",
    scam_phrase: "scam or engagement-farm phrasing",
    url_or_phone: "links or phone numbers",
    auto_handle: "auto-generated account names",
    unicode_trick: "hidden or lookalike characters",
    new_account: "accounts under a month old",
    burst: "posted within minutes of upload",
    emoji_heavy: "mostly emoji",
    unknown_channel: "account not resolvable",
    no_videos: "accounts with no uploads",
    hidden_subs: "hidden subscriber counts",
    default_avatar: "default profile pictures",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}
