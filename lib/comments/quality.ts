// ── Edition quality report ───────────────────────────────────────────────────
// Scores a published edition from the numbers the page already shows, so a
// change to the picker can be compared against the editions it replaced.
//
// Nothing here calls YouTube or Supabase. scripts/comments-edition-quality.ts
// prints the report; tests/api/comments-quality.test.ts locks the 2026-10-03
// to 2026-10-16 reading that motivated the ranking change.

import { rejectReason, RULES } from "./edition";
import { UNAVAILABLE_VIDEO_IDS } from "./youtube";
import type { VideoPick } from "./types";

export interface QualityVideo {
  videoId: string;
  title: string;
  channel: string;
  /** Views at pick time. Null when the page did not render them. */
  views: number | null;
  /** Views per hour at pick time, rounded the way the card renders it. */
  viewsPerHour: number | null;
  /**
   * Comments actually read. The pipeline caps this at 1,000, so a value of
   * 1,000 with commentsCapped means "at least 1,000", not "exactly 1,000".
   */
  commentsRead: number | null;
  commentsCapped: boolean;
  durationS: number | null;
  /** False when the video is confirmed gone (oEmbed 404 or the blocklist). */
  available: boolean;
}

export interface QualitySkip {
  videoId: string;
  title: string;
  reason: string | null;
}

export interface QualityEdition {
  editionDate: string;
  editionNo: number | null;
  videos: QualityVideo[];
  skipped: QualitySkip[];
}

export interface EditionScore {
  editionDate: string;
  picked: number;
  skipped: number;
  medianViewsPerHour: number | null;
  medianCommentsRead: number | null;
  /** Sections that did not fill the 1,000-comment fetch. */
  uncapped: number;
  /** Uncapped sections under the current comment floor. */
  thin: number;
  /** Duration at or under three minutes. */
  shortForm: number;
  duplicateIds: string[];
  deadLinks: string[];
  /** Hard rules the current picker would apply. Capped comment totals are not judged for density. */
  wouldReject: { videoId: string; title: string; rule: string }[];
}

export interface RunScore {
  editions: number;
  videos: number;
  medianViewsPerHour: number | null;
  medianCommentsRead: number | null;
  uncapped: number;
  thin: number;
  shortForm: number;
  duplicateIds: string[];
  deadLinks: string[];
  /** channel -> how many editions it appeared in. */
  channelCounts: { channel: string; editions: number }[];
  wouldReject: { editionDate: string; videoId: string; title: string; rule: string }[];
}

export function median(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

function dead(v: QualityVideo): boolean {
  return v.available === false || UNAVAILABLE_VIDEO_IDS.has(v.videoId);
}

function duplicateIds(ids: string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

/**
 * The hard gate, replayed against a stored card.
 *
 * Comment totals are only known exactly when the fetch did not hit the 1,000
 * cap. A capped row is given a comment count that clears the floors, so the
 * replay does not punish a trailer whose real section is larger than what we
 * stored. Title, duration, and availability still apply.
 */
export function replayReject(v: QualityVideo, now = Date.now()): string | null {
  const comments = v.commentsCapped
    ? Math.max(v.commentsRead ?? 0, RULES.SHORT_MIN_COMMENTS, RULES.MIN_COMMENTS)
    : (v.commentsRead ?? 0);
  // A capped count is a floor ("at least 1,000"), so the real section may be
  // far larger. Density is judged only when the count is exact; a capped row
  // is given just enough views to sit on the floor and no thinner.
  const views = v.commentsCapped ? comments * RULES.MIN_VIEWS_PER_COMMENT : (v.views ?? 0);
  const pick: VideoPick = {
    videoId: v.videoId,
    title: v.title,
    description: "",
    channelId: v.channel,
    channelTitle: v.channel,
    thumbnailUrl: "",
    durationS: v.durationS ?? 600,
    publishedAt: new Date(now - 24 * 3_600_000).toISOString(),
    views,
    likes: 0,
    comments,
    liveBroadcastContent: "none",
    defaultAudioLanguage: null,
    defaultLanguage: null,
    uploadStatus: v.available === false ? "deleted" : null,
  };
  return rejectReason(pick, new Map(), now);
}

export function scoreEdition(edition: QualityEdition): EditionScore {
  const videos = edition.videos;
  return {
    editionDate: edition.editionDate,
    picked: videos.length,
    skipped: edition.skipped.length,
    medianViewsPerHour: median(videos.map((v) => v.viewsPerHour).filter((n): n is number => n !== null)),
    medianCommentsRead: median(videos.map((v) => v.commentsRead).filter((n): n is number => n !== null)),
    uncapped: videos.filter((v) => !v.commentsCapped).length,
    thin: videos.filter((v) => !v.commentsCapped && (v.commentsRead ?? 0) < RULES.MIN_COMMENTS).length,
    shortForm: videos.filter((v) => (v.durationS ?? 0) > 0 && (v.durationS ?? 0) <= RULES.SHORT_MAX_DURATION_S).length,
    duplicateIds: duplicateIds(videos.map((v) => v.videoId)),
    deadLinks: videos.filter(dead).map((v) => v.videoId),
    wouldReject: videos.flatMap((v) => {
      const rule = replayReject(v);
      return rule ? [{ videoId: v.videoId, title: v.title, rule }] : [];
    }),
  };
}

export function scoreRun(editions: QualityEdition[]): RunScore {
  const videos = editions.flatMap((e) => e.videos);
  const channels = new Map<string, number>();
  for (const e of editions) {
    const names = new Set(e.videos.map((v) => v.channel));
    for (const name of names) channels.set(name, (channels.get(name) ?? 0) + 1);
  }
  return {
    editions: editions.length,
    videos: videos.length,
    medianViewsPerHour: median(videos.map((v) => v.viewsPerHour).filter((n): n is number => n !== null)),
    medianCommentsRead: median(videos.map((v) => v.commentsRead).filter((n): n is number => n !== null)),
    uncapped: videos.filter((v) => !v.commentsCapped).length,
    thin: videos.filter((v) => !v.commentsCapped && (v.commentsRead ?? 0) < RULES.MIN_COMMENTS).length,
    shortForm: videos.filter((v) => (v.durationS ?? 0) > 0 && (v.durationS ?? 0) <= RULES.SHORT_MAX_DURATION_S).length,
    duplicateIds: duplicateIds(videos.map((v) => v.videoId)),
    deadLinks: videos.filter(dead).map((v) => v.videoId),
    channelCounts: [...channels.entries()]
      .map(([channel, editions]) => ({ channel, editions }))
      .filter((c) => c.editions > 1)
      .sort((a, b) => b.editions - a.editions || a.channel.localeCompare(b.channel)),
    wouldReject: editions.flatMap((e) =>
      e.videos.flatMap((v) => {
        const rule = replayReject(v);
        return rule ? [{ editionDate: e.editionDate, videoId: v.videoId, title: v.title, rule }] : [];
      })
    ),
  };
}

/** Plain-text report. The script prints this; the test locks the headline numbers. */
export function formatQualityReport(editions: QualityEdition[]): string {
  const run = scoreRun(editions);
  const lines: string[] = [];
  const n = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("en-US"));
  lines.push(`Editions ${run.editions}  videos ${run.videos}`);
  lines.push(`Median views/hour ${n(run.medianViewsPerHour)}  median comments read ${n(run.medianCommentsRead)}`);
  lines.push(
    `Uncapped sections ${run.uncapped}  under ${RULES.MIN_COMMENTS} comments ${run.thin}  ` +
      `≤${RULES.SHORT_MAX_DURATION_S}s ${run.shortForm}  duplicate ids ${run.duplicateIds.length}  dead links ${run.deadLinks.length}`
  );
  if (run.channelCounts.length > 0) {
    lines.push("Repeat channels: " + run.channelCounts.map((c) => `${c.channel} ×${c.editions}`).join(", "));
  }
  lines.push(`Would reject under current hard rules: ${run.wouldReject.length}`);
  for (const r of run.wouldReject) {
    lines.push(`  ${r.editionDate}  ${r.videoId}  ${r.rule}  ${r.title.slice(0, 70)}`);
  }
  lines.push("");
  for (const e of editions) {
    const s = scoreEdition(e);
    lines.push(
      `${s.editionDate}  picked ${s.picked}  skipped ${s.skipped}  ` +
        `median ${n(s.medianViewsPerHour)}/hr  comments ${n(s.medianCommentsRead)}  ` +
        `thin ${s.thin}  short ${s.shortForm}  reject ${s.wouldReject.length}`
    );
  }
  return lines.join("\n");
}
