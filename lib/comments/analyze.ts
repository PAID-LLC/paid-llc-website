// ── The analysis pass ────────────────────────────────────────────────────────
// Takes a video and its comments, returns everything the page shows plus the two
// shortlists Gemini works from. Pure: no fetch, no clock beyond an injectable
// `now`, no Supabase. All of it runs in memory and most of it is thrown away.
//
// This function is the retention boundary. Roughly a thousand comments go in;
// what comes out is an analysis object with no comment text, no display name and
// no channel id in it, plus two arrays of ScoredComment that the caller uses to
// build exactly six featured rows and then drops. If you add a field to
// VideoAnalysis that quotes a commenter, the 30-day refresh no longer covers
// everything we store, and the compliance story breaks quietly.

import type {
  CommentInput,
  ChannelInfo,
  ScoredComment,
  VideoAnalysis,
  VideoPick,
} from "./types";
import { scoreSentiment, labelOf, isLikelyEnglish, tokenize, extractEmoji, STOPWORDS } from "./lexicon";
import { buildAutomationContext, scoreAutomation, summarizeAutomation } from "./bots";
import { pickCandidatesTiered, pickTopComments } from "./humor";

const HISTOGRAM_BINS = 10;
const VELOCITY_BUCKETS = 24;

export interface AnalyzeResult {
  analysis: VideoAnalysis;
  top: ScoredComment[];
  candidates: ScoredComment[];
}

export function analyzeVideo(
  video: Pick<VideoPick, "videoId" | "title" | "publishedAt">,
  comments: CommentInput[],
  channels: Map<string, ChannelInfo>,
  now = Date.now()
): AnalyzeResult {
  const ctx = buildAutomationContext(comments, channels, video.publishedAt);

  let englishCount = 0;
  const scored: ScoredComment[] = comments.map((c) => {
    const { score, signals } = scoreAutomation(c, ctx);
    if (isLikelyEnglish(c.text)) englishCount++;
    return {
      ...c,
      sentiment: scoreSentiment(c.text),
      automation: score,
      signals,
      humor: 0,
    };
  });

  const n = scored.length;
  const analyzed = n;

  // ── Sentiment shares and distribution ──────────────────────────────────────
  let pos = 0;
  let neg = 0;
  let sentimentSum = 0;
  const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);

  for (const c of scored) {
    const label = labelOf(c.sentiment);
    if (label === "positive") pos++;
    else if (label === "negative") neg++;
    sentimentSum += c.sentiment;

    // Map [-1, 1] onto 0..9. +1 exactly must land in the last bin, not past it.
    const bin = Math.min(
      HISTOGRAM_BINS - 1,
      Math.floor(((c.sentiment + 1) / 2) * HISTOGRAM_BINS)
    );
    histogram[bin]++;
  }

  const neu = n - pos - neg;

  // ── Likes distribution, for the "underrated" framing ───────────────────────
  const likes = scored.map((c) => c.likeCount).sort((a, b) => a - b);
  const medianLikes = likes.length ? likes[Math.floor(likes.length / 2)] : 0;
  const maxLikes = likes.length ? likes[likes.length - 1] : 0;

  const velocity = velocityBuckets(scored, video.publishedAt);

  const shortlist = pickCandidatesTiered(scored, 25, now);

  return {
    analysis: {
      analyzed,
      positiveShare: share(pos, n),
      neutralShare: share(neu, n),
      negativeShare: share(neg, n),
      meanSentiment: n ? sentimentSum / n : 0,
      histogram,
      themes: themesFrom(scored, video.title),
      emoji: emojiLeaderboard(scored),
      velocity,
      busiestHour: busiestOf(velocity),
      automation: summarizeAutomation(scored, channels.size),
      englishRatio: n ? englishCount / n : 0,
      medianLikes,
      maxLikes,
      // The age gate the shortlist actually ran at. Six hours is the standard;
      // anything lower means the section moved too fast for it and the tiered
      // fallback took over. edition.ts turns this into a degradation marker.
      candidateAgeGateH: Math.round((shortlist.minAgeMs / 3_600_000) * 100) / 100,
      degraded: [],
      summarySource: "none",
      vibe: "",
      ytUnits: 0,
    },
    top: pickTopComments(scored, 30),
    candidates: shortlist.candidates,
  };
}

/**
 * What the section is talking about: frequent unigrams and bigrams, minus
 * stopwords and minus anything already in the title.
 *
 * The title exclusion matters more than it looks. Without it every theme list
 * for a music video is the artist's name and the song title, which tells the
 * reader nothing they did not get from the thumbnail.
 */
export function themesFrom(comments: { text: string }[], title = ""): string[] {
  const titleWords = new Set(tokenize(title));
  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();

  for (const c of comments) {
    const tokens = tokenize(c.text).filter(
      (t) => t.length >= 3 && t.length <= 20 && !STOPWORDS.has(t) && !titleWords.has(t)
    );

    // Count each term once per comment, so one person saying "goat" ten times
    // does not become the section's theme.
    const seenUni = new Set<string>();
    for (const t of tokens) {
      if (seenUni.has(t)) continue;
      seenUni.add(t);
      unigrams.set(t, (unigrams.get(t) ?? 0) + 1);
    }

    const seenBi = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      if (seenBi.has(pair)) continue;
      seenBi.add(pair);
      bigrams.set(pair, (bigrams.get(pair) ?? 0) + 1);
    }
  }

  const minCount = Math.max(3, Math.floor(comments.length * 0.02));

  // Bigrams are weighted up: "camera work" is a more useful theme than "camera",
  // so a phrase only needs 60% of a word's count to outrank it.
  const ranked = [
    ...[...bigrams.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([term, count]) => ({ term, weight: count * 1.7 })),
    ...[...unigrams.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([term, count]) => ({ term, weight: count })),
  ].sort((a, b) => b.weight - a.weight);

  // Drop a unigram already covered by a surviving bigram.
  const out: string[] = [];
  for (const { term } of ranked) {
    if (out.length >= 12) break;
    if (out.some((existing) => existing.includes(term) || term.includes(existing))) continue;
    out.push(term);
  }
  return out;
}

/** Most-used emoji across the section. */
export function emojiLeaderboard(comments: { text: string }[], n = 5): { char: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of comments) {
    for (const e of extractEmoji(c.text)) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([char, count]) => ({ char, count }));
}

/**
 * Comments per hour for the first 24 hours after upload. Anything later lands in
 * the final bucket, so the shape stays readable for a video that has been up a
 * week; the page labels it "first 24 hours" for exactly that reason.
 */
export function velocityBuckets(
  comments: { publishedAt: string }[],
  videoPublishedAt: string
): number[] {
  const buckets = new Array<number>(VELOCITY_BUCKETS).fill(0);
  const start = Date.parse(videoPublishedAt);
  if (!Number.isFinite(start)) return buckets;

  for (const c of comments) {
    const t = Date.parse(c.publishedAt);
    if (!Number.isFinite(t)) continue;
    const hours = Math.floor((t - start) / 3_600_000);
    const idx = Math.min(VELOCITY_BUCKETS - 1, Math.max(0, hours));
    buckets[idx]++;
  }
  return buckets;
}

function busiestOf(buckets: number[]): number {
  let best = 0;
  for (let i = 1; i < buckets.length; i++) if (buckets[i] > buckets[best]) best = i;
  return best;
}

function share(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}
