// ── Edition aggregation and headline ─────────────────────────────────────────
// The front page gets a headline every morning and no model is involved in it.
//
// That is a deliberate choice, not a cost saving. A templated headline can only
// say things the day's numbers actually support, so it cannot drift, cannot
// hallucinate a trend, and reads the same on day 200 as on day 1. The model gets
// one 60-token call for the social teaser, where a little colour is worth the
// risk, and stays out of the headline entirely.

import type { EditionStats, VideoRow } from "./types";
import { formatCount } from "./render-helpers";

/** Sums only analyzed videos. Skipped ones contribute nothing but their count. */
export function aggregateEdition(videos: VideoRow[]): EditionStats {
  const analyzed = videos.filter((v) => v.status === "analyzed");
  const skipped = videos.filter((v) => v.status === "skipped");

  const stats: EditionStats = {
    videosPicked: videos.length,
    videosAnalyzed: analyzed.length,
    videosSkipped: skipped.length,
    commentsAnalyzed: 0,
    positiveShare: 0,
    neutralShare: 0,
    negativeShare: 0,
    automationShare: 0,
    mostPositive: null,
    mostNegative: null,
    mostAutomated: null,
    topEmoji: [],
    busiestHour: 0,
    ytUnits: 0,
    geminiIn: 0,
    geminiOut: 0,
  };

  if (analyzed.length === 0) return stats;

  // Shares are weighted by comment count, not averaged across videos. A video
  // with 4,000 comments should move the day's number more than one with 250.
  let pos = 0;
  let neu = 0;
  let neg = 0;
  let automated = 0;
  let total = 0;

  let bestPos = -Infinity;
  let bestNeg = -Infinity;
  let bestAuto = -Infinity;
  const emoji = new Map<string, number>();
  const hours = new Array<number>(24).fill(0);

  for (const v of analyzed) {
    const a = v.analysis;
    const n = a.analyzed ?? 0;
    total += n;

    pos += (a.positiveShare ?? 0) * n;
    neu += (a.neutralShare ?? 0) * n;
    neg += (a.negativeShare ?? 0) * n;
    automated += (a.automation?.shareLikely ?? 0) * n;

    if ((a.positiveShare ?? 0) > bestPos) {
      bestPos = a.positiveShare ?? 0;
      stats.mostPositive = v.video_id;
    }
    if ((a.negativeShare ?? 0) > bestNeg) {
      bestNeg = a.negativeShare ?? 0;
      stats.mostNegative = v.video_id;
    }
    if ((a.automation?.shareLikely ?? 0) > bestAuto) {
      bestAuto = a.automation?.shareLikely ?? 0;
      stats.mostAutomated = v.video_id;
    }

    for (const e of a.emoji ?? []) emoji.set(e.char, (emoji.get(e.char) ?? 0) + e.count);
    (a.velocity ?? []).forEach((count, i) => {
      if (i < 24) hours[i] += count;
    });

    stats.ytUnits += a.ytUnits ?? 0;
    for (const usage of Object.values(v.gemini ?? {})) {
      stats.geminiIn += usage.in ?? 0;
      stats.geminiOut += usage.out ?? 0;
    }
  }

  stats.commentsAnalyzed = total;
  if (total > 0) {
    stats.positiveShare = pos / total;
    stats.neutralShare = neu / total;
    stats.negativeShare = neg / total;
    stats.automationShare = automated / total;
  }

  stats.topEmoji = [...emoji.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([char, count]) => ({ char, count }));

  stats.busiestHour = hours.reduce((best, v, i) => (v > hours[best] ? i : best), 0);

  return stats;
}

export type HeadlineTemplate = "thin" | "negative" | "automated" | "lovefest" | "default";

/** Which story the day's numbers actually tell. Order is priority order. */
export function pickTemplate(stats: EditionStats): HeadlineTemplate {
  if (stats.videosAnalyzed <= 2) return "thin";
  if (stats.negativeShare >= 0.35) return "negative";
  if (stats.automationShare >= 0.2) return "automated";
  if (stats.positiveShare >= 0.75) return "lovefest";
  return "default";
}

/**
 * The day's headline, built from its own numbers.
 * `channelFor` resolves a video id to a channel name for the templates that
 * name one; it returns null when that video is not available.
 */
export function buildHeadline(
  stats: EditionStats,
  channelFor: (videoId: string | null) => string | null
): string {
  const comments = formatCount(stats.commentsAnalyzed);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const videos = numberWord(stats.videosAnalyzed);

  switch (pickTemplate(stats)) {
    case "thin":
      return `${capitalize(videos)} ${plural(stats.videosAnalyzed, "video")} made the cut today, ${comments} comments between them.`;

    case "negative": {
      const who = channelFor(stats.mostNegative);
      return who
        ? `The internet was not kind today. ${pct(stats.negativeShare)} of ${comments} comments came in negative, and ${who} took the worst of it.`
        : `The internet was not kind today. ${pct(stats.negativeShare)} of ${comments} comments came in negative.`;
    }

    case "automated": {
      const who = channelFor(stats.mostAutomated);
      return who
        ? `Roughly ${pct(stats.automationShare)} of today's comments looked automated. ${who} drew the most of them.`
        : `Roughly ${pct(stats.automationShare)} of today's ${comments} comments looked automated.`;
    }

    case "lovefest":
      return `A good day in the comments. ${pct(stats.positiveShare)} positive across ${comments} of them.`;

    default: {
      // "about 0% automated" was edition 1's headline. Under half a percent rounds
      // to zero, and a rounded zero reads as a glitch rather than as good news.
      const automated =
        stats.automationShare < 0.005
          ? "almost none of it looked automated"
          : `about ${pct(stats.automationShare)} of it looked automated`;
      return `${capitalize(videos)} videos, ${comments} comments. The room ran ${pct(stats.positiveShare)} positive, and ${automated}.`;
    }
  }
}

/** The standfirst under the headline. Constant by design; it frames the method. */
export const STANDFIRST =
  "The most-watched videos in the United States today, read through their comment sections.";

function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
