// ── Finding the underrated joke ──────────────────────────────────────────────
// The hook of the whole publication: the funniest comment with the fewest likes.
//
// This file does the narrowing; Gemini does the judging. That split is the
// entire cost argument. Scoring ~1,000 comments for humor with a model would be
// a thousand calls; instead code filters to 25 plausible candidates and one call
// picks among them. It also means the safety filtering happens BEFORE anything
// reaches a model or a page: a candidate has already passed moderation, already
// scored clean on automation, and is already length-bounded by the time Gemini
// sees an index for it.
//
// "Underrated" is defined as at or below the 25th percentile of likes in the
// section, floored at 2. A fixed "zero likes" rule would mostly surface comments
// posted four minutes ago that nobody has scrolled to yet, which is not the same
// thing as overlooked — hence the minimum age below.

import type { ScoredComment } from "./types";
import { LAUGH_MARKERS } from "./lexicon";
import { normalizeForHash, CLEAN_THRESHOLD } from "./bots";
import { sentinelCheck } from "@/lib/sentinel";

/** Minimum characters: shorter than this is a reaction, not a joke. */
const MIN_LEN = 15;
/** Maximum characters: longer than this does not read as a punchline on a card. */
const MAX_LEN = 280;
/**
 * A comment must have been visible this long before "few likes" means anything.
 *
 * This is the STRICT gate, and on a fast comment section it is unreachable by
 * construction. Measured on the MrBeast video in edition 2 (2026-09-20): of
 * 1,000 comments sampled, 705 sat at or below the like threshold, 523 survived
 * the length rules, and every single one of those 523 was under six hours old.
 * The oldest was one hour and ten minutes. The card shipped with no underrated
 * comment at all, which is the publication's entire hook missing from its
 * biggest video.
 *
 * The cause is not the rule, it is the constant. YouTube's relevance ordering
 * returns the most-engaged comments plus recent ones, so on a section taking
 * thousands of comments an hour, every low-like comment in the sample arrived
 * in the last seventy minutes. Six hours assumes an hour is a short time. On
 * that video an hour is thousands of readers who scrolled past and did not
 * press like, which is exactly what "overlooked" is supposed to mean.
 *
 * So the gate falls back to the section's own median comment age (see
 * pickCandidatesTiered), which says the same thing in the section's own units:
 * half the comments here arrived after this one.
 */
const MIN_AGE_MS = 6 * 60 * 60 * 1000;

/** Below this many candidates, the shortlist is too thin to be worth judging. */
const MIN_CANDIDATES = 5;

/** Comedic structures that recur in comment sections. */
const JOKE_SHAPES: { re: RegExp; points: number }[] = [
  { re: /^nobody:/im, points: 3 },
  { re: /^(me|him|her|them|my \w+):/im, points: 2 },
  { re: /\bpov\b\s*:/i, points: 2 },
  { re: /\bthe way (he|she|they|it|this|that)\b/i, points: 2 },
  { re: /\bnot (me|him|her|them|the|this|that)\b/i, points: 2 },
  { re: /\bwhy (is|does|did|are) (this|he|she|they|it)\b/i, points: 2 },
  { re: /\bsir,? this is a\b/i, points: 3 },
  { re: /\bbro (said|thought|really)\b/i, points: 2 },
  { re: /\bi'?m (dead|done|crying|screaming|weak)\b/i, points: 2 },
  { re: /\b(he|she|they) really (said|did|went)\b/i, points: 2 },
  { re: /\bain'?t no way\b/i, points: 2 },
  { re: /\btell me why\b/i, points: 2 },
  { re: /\bplot twist\b/i, points: 1 },
  { re: /\bnarrator:/i, points: 3 },
  { re: /\b(as|like) a \w+,? I can confirm\b/i, points: 2 },
];

/**
 * Comments that REPORT laughing rather than being the joke: "this playthrough
 * was so funny", "the narrator parts were cracking me up". They carry every
 * surface marker the scorer rewards (laugh emoji, the word "funny", a quoted
 * line) and none of the wit, and edition 1 (2026-09-19) led with one. They stay
 * eligible, since a reaction can still be charming, but they rank below jokes.
 */
const REACTION_RE =
  /\b(so|really|too|super|actually) (funny|hilarious)\b|\bcracking me up\b|\bcracked me up\b|\bmade me (laugh|lol)\b|\blaugh(ed|ing) so hard\b|\b(this|that|the) (video|playthrough|episode|series|stream|part|parts|ending) (was|is|were|are) (so |really |too )?(funny|hilarious|gold)\b|\bfunniest (video|episode|part|thing)\b/i;
const REACTION_PENALTY = 3;

/**
 * A timestamp plus a quoted line with little else: the joke is the creator's,
 * not the commenter's. After the edition 1 fix the Supermarket card picked
 * "28:29 'Don't listen to my private thoughts that I'm saying out loud' I love
 * mark". A comment that riffs on a timestamp in its own words ("2:18 Mads
 * Mikkelsen jumpscare") has no quoted span and is untouched.
 */
export function isQuoteBack(text: string): boolean {
  if (!/^\s*@?\d{1,2}:\d{2}/.test(text)) return false;
  // Signed rather than quoted: "5:27 and some fossilized dinosaur poop because
  // you never know... ~jerryrigeverything" (first pooled run, 2026-09-19).
  if (/~\s*@?[\p{L}\p{N}_.]{3,}[\s\p{Extended_Pictographic}️]*$/u.test(text)) return true;
  const quoted = text.match(/[“"]([^”"]{8,})[”"]/);
  if (!quoted) return false;
  const own = text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/^\s*@?\d{1,2}:\d{2}(:\d{2})?/, "")
    .trim();
  return quoted[1].length / Math.max(1, own.length) >= 0.5;
}
const QUOTE_BACK_PENALTY = 2;

/**
 * How much a comment reads like an attempt at a joke, 0-12ish.
 * Ranking only — this never decides whether something IS funny, it decides
 * which 25 comments are worth a model's attention.
 */
export function humorScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const m of LAUGH_MARKERS) {
    if (lower.includes(m)) {
      score += 1.5;
      break; // one marker is signal; five is just typing
    }
  }

  for (const shape of JOKE_SHAPES) {
    if (shape.re.test(text)) score += shape.points;
  }

  // A skull or a sobbing face is the modern laugh track.
  const laughEmoji = (text.match(/[\u{1F480}\u{1F602}\u{1F923}\u{1F62D}]/gu) ?? []).length;
  score += Math.min(laughEmoji, 3) * 0.8;

  // Mid-length comments land best: enough for a setup, short enough for a card.
  // Measured AFTER stripping emoji, so twenty skulls in a row cannot buy the
  // length bonus and outrank an actual joke. (Caught by the repetition test.)
  const len = text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu, "")
    .trim().length;
  if (len >= 40 && len <= 180) score += 1;

  // Wordplay signals: internal contrast punctuation.
  if (/[^.]\.\.\.[^.]/.test(text) || /\bbut\b.*\?$/i.test(text)) score += 0.5;

  // A question that is clearly rhetorical tends to be a bit.
  if (/\?$/.test(text.trim()) && len > 30) score += 0.5;

  if (REACTION_RE.test(text)) score -= REACTION_PENALTY;
  if (isQuoteBack(text)) score -= QUOTE_BACK_PENALTY;

  return score;
}

/** Deterministic 32-bit hash, so candidate order is stable across reruns. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The like count at or below which a comment counts as overlooked. */
export function underratedThreshold(comments: ScoredComment[]): number {
  const likes = comments.map((c) => c.likeCount).sort((a, b) => a - b);
  if (likes.length === 0) return 2;
  const p25 = likes[Math.floor(likes.length * 0.25)] ?? 0;
  return Math.max(2, p25);
}

/**
 * The shortlist handed to Gemini.
 *
 * Every filter here is a gate the final published comment has already passed, so
 * read this as the publication's editorial standard rather than as tuning:
 *   - automation < 30, so a name never appears beside a bot estimate
 *   - sentinelCheck, so no slur, threat, or injection attempt can be featured
 *   - at or below the underrated threshold, which is the hook
 *   - six hours old, so "few likes" means overlooked and not merely new
 *   - deduped by normalized text, so a copypasta cannot win
 */
function collect(
  comments: ScoredComment[],
  n: number,
  now: number,
  minAgeMs: number
): ScoredComment[] {
  const threshold = underratedThreshold(comments);
  const seen = new Set<string>();
  const eligible: ScoredComment[] = [];

  for (const c of comments) {
    if (c.automation >= CLEAN_THRESHOLD) continue;
    if (c.likeCount > threshold) continue;

    const text = c.text.trim();
    if (text.length < MIN_LEN || text.length > MAX_LEN) continue;

    const posted = Date.parse(c.publishedAt);
    if (Number.isFinite(posted) && now - posted < minAgeMs) continue;

    // Links never get featured, regardless of how the automation score landed.
    if (/https?:\/\/|www\./i.test(text)) continue;

    if (!sentinelCheck(text).allowed) continue;

    const norm = normalizeForHash(text);
    if (norm.length < 8 || seen.has(norm)) continue;
    seen.add(norm);

    const humor = humorScore(text);
    if (humor <= 0) continue;

    eligible.push({ ...c, humor });
  }

  eligible.sort((a, b) => {
    if (b.humor !== a.humor) return b.humor - a.humor;
    // Equally funny: prefer the more overlooked one. That is the whole premise.
    if (a.likeCount !== b.likeCount) return a.likeCount - b.likeCount;
    // Still tied: a stable hash, so two runs of the same input agree.
    return hashStr(a.id) - hashStr(b.id);
  });

  return eligible.slice(0, n);
}

/** Median age of the sampled comments, in milliseconds. */
export function medianCommentAge(comments: ScoredComment[], now = Date.now()): number {
  const ages = comments
    .map((c) => now - Date.parse(c.publishedAt))
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);
  return ages.length === 0 ? 0 : ages[Math.floor(ages.length / 2)];
}

/**
 * How many comments a section needs before "the older half" means anything.
 * Matches MIN_FETCHED in edition.ts, the count below which a video is skipped
 * outright, so the two thresholds cannot drift apart.
 */
const MIN_SAMPLE_FOR_RELAX = 100;

/**
 * The shortlist, with the age gate relaxed only where volume makes that honest.
 *
 * Two tiers. The strict six hours first. If that starves the shortlist AND the
 * section is big enough for the word "overlooked" to carry weight, fall back to
 * the section's own median comment age, which says the same thing in the
 * section's units: half of these comments arrived after this one.
 *
 * There is deliberately NO third tier that drops the gate entirely. On a small
 * or slow section an empty shortlist is the correct answer, and a comment
 * posted five minutes ago into a quiet comment section has not been overlooked
 * by anybody. Publishing no underrated pick is better than publishing a
 * meaningless one, and `candidates:none` records it either way.
 *
 * `minAgeMs` in the result is what the caller records as a degradation, so a
 * relaxed tier is visible on the card and in the run output instead of being a
 * silent change of editorial standard.
 */
export function pickCandidatesTiered(
  comments: ScoredComment[],
  n = 25,
  now = Date.now()
): { candidates: ScoredComment[]; minAgeMs: number } {
  const strict = collect(comments, n, now, MIN_AGE_MS);
  if (strict.length >= MIN_CANDIDATES) return { candidates: strict, minAgeMs: MIN_AGE_MS };
  if (comments.length < MIN_SAMPLE_FOR_RELAX) return { candidates: strict, minAgeMs: MIN_AGE_MS };

  const median = Math.min(medianCommentAge(comments, now), MIN_AGE_MS);
  if (median <= 0) return { candidates: strict, minAgeMs: MIN_AGE_MS };

  const relaxed = collect(comments, n, now, median);
  return relaxed.length > strict.length
    ? { candidates: relaxed, minAgeMs: median }
    : { candidates: strict, minAgeMs: MIN_AGE_MS };
}

/** The shortlist. Kept as the plain call for tests and any non-pipeline caller. */
export function pickCandidates(
  comments: ScoredComment[],
  n = 25,
  now = Date.now()
): ScoredComment[] {
  return pickCandidatesTiered(comments, n, now).candidates;
}

/**
 * The most-liked comments, for context on the card and in the digest.
 * Automation-screened at the looser threshold: a heavily-liked comment is
 * unlikely to be a bot, but a scam pinned by likes would be a bad look.
 */
export function pickTopComments(comments: ScoredComment[], n = 30): ScoredComment[] {
  return comments
    .filter((c) => c.automation < 50 && c.text.trim().length > 0)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, n);
}
