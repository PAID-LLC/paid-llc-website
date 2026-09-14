// ── The daily step machine ───────────────────────────────────────────────────
// Four steps, driven by GitHub Actions against /api/comments/cron:
//
//   pick     choose the day's videos, create the edition           ~1 second
//   video    process ONE video, repeated until it reports done     ~60-125 s each
//   publish  aggregate, headline, flip to published                ~2 seconds
//   refresh  re-fetch anything approaching the 30-day limit        ~2 seconds
//
// WHY ONE VIDEO PER REQUEST. A Cloudflare Worker does not mind waiting on fetch
// (awaiting I/O does not consume CPU time against the 30-second limit), but a
// single request doing all five videos would sit for ten minutes and any failure
// would lose the whole edition. Splitting it means a crash costs one video, and
// the claim mechanism in store.ts means a retry picks up exactly where it left off.
//
// WHY GEMINI FAILURE DOES NOT SKIP A VIDEO. The budget guard fails open, so the
// most likely Gemini failure is "budget exhausted", which would hit all five
// videos in the same run and publish an empty edition. Instead the summary falls
// back to text, then to nothing, and the editorial pick falls back to the
// code-ranked shortlist. Only YouTube-side conditions skip a video, because
// those genuinely mean there is nothing to write about.

import {
  fetchMostPopular,
  fetchCommentThreads,
  fetchChannels,
  fetchCommentsById,
  fetchVideoStats,
  YouTubeError,
} from "./youtube";
import { analyzeVideo } from "./analyze";
import {
  geminiVideoSummary,
  geminiTextSummary,
  geminiEditorial,
  geminiTeaser,
  buildDigest,
  fallbackEditorial,
} from "./gemini";
import { aggregateEdition, buildHeadline } from "./headline";
import * as store from "./store";
import type {
  StepName,
  StepResult,
  VideoPick,
  FeaturedRow,
  ScoredComment,
  GeminiUsageMap,
} from "./types";

/** Videos per edition. */
const PICK_COUNT = 5;
/** Chart rows fetched to choose from. More slack than we need, at 1 quota unit. */
const CHART_SIZE = 25;
/** Below this many comments there is nothing to analyse. */
const MIN_COMMENTS = 200;
/** Below this many actually fetched, the section is too thin to publish. */
const MIN_FETCHED = 100;
/** Shorts have reply-shaped comment sections; they do not read as a column. */
const MIN_DURATION_S = 60;
/** Below this share of scorable English, the lexicon cannot speak to it. */
const MIN_ENGLISH_RATIO = 0.4;
/** A skipped video can be reconsidered after a week. */
const SKIP_RETRY_DAYS = 7;
/** Re-fetch stored YouTube data at 25 days, five short of the 30-day limit. */
const REFRESH_AFTER_DAYS = 25;

/**
 * Today, in Central time.
 *
 * The edition is a morning publication for a Central-time owner, so its date
 * boundary is Central rather than UTC. en-CA formats as YYYY-MM-DD, which is the
 * one locale that gives an ISO date directly.
 */
export function editionDateToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isStepName(s: unknown): s is StepName {
  return s === "pick" || s === "video" || s === "publish" || s === "refresh";
}

export async function runCommentsStep(step: StepName, date: string): Promise<StepResult> {
  switch (step) {
    case "pick":
      return stepPick(date);
    case "video":
      return stepVideo(date);
    case "publish":
      return stepPublish(date);
    case "refresh":
      return stepRefresh();
  }
}

// ── pick ─────────────────────────────────────────────────────────────────────

type RejectRule =
  | "live"
  | "comments_disabled"
  | "too_few_comments"
  | "too_short"
  | "not_english"
  | "already_analyzed"
  | "recently_skipped";

/**
 * The editorial filter, in priority order. The first rule a video fails is the
 * one reported, so the workflow log shows WHY the chart thinned out on a day it
 * produced fewer than five.
 */
export function rejectReason(
  v: VideoPick,
  seen: Map<string, { status: string; created_at: string }>,
  now = Date.now()
): RejectRule | null {
  if (v.liveBroadcastContent !== "none") return "live";
  // -1 means the API omitted commentCount, which is how it signals disabled.
  if (v.comments < 0) return "comments_disabled";
  if (v.comments < MIN_COMMENTS) return "too_few_comments";
  if (v.durationS > 0 && v.durationS < MIN_DURATION_S) return "too_short";

  for (const lang of [v.defaultAudioLanguage, v.defaultLanguage]) {
    if (lang && !lang.toLowerCase().startsWith("en")) return "not_english";
  }

  const prior = seen.get(v.videoId);
  if (prior) {
    if (prior.status === "analyzed") return "already_analyzed";
    const created = Date.parse(prior.created_at);
    if (Number.isFinite(created) && now - created < SKIP_RETRY_DAYS * 86_400_000) {
      return "recently_skipped";
    }
  }

  return null;
}

async function stepPick(date: string): Promise<StepResult> {
  const existing = await store.getEdition(date);
  if (existing) {
    return {
      step: "pick",
      existing: true,
      status: existing.status,
      picked: existing.video_ids.length,
    };
  }

  let chart: VideoPick[];
  try {
    chart = await fetchMostPopular("US", CHART_SIZE);
  } catch (err) {
    const kind = err instanceof YouTubeError ? err.kind : "network";
    await store.upsertEdition({ edition_date: date, status: "failed", region: "US" });
    return { step: "pick", picked: 0, error: kind, http: 500 };
  }

  const seen = await store.getExistingVideoRows(chart.map((v) => v.videoId));
  const rejected: { id: string; title: string; rule: RejectRule }[] = [];
  const picked: VideoPick[] = [];

  for (const v of chart) {
    if (picked.length >= PICK_COUNT) break;
    const rule = rejectReason(v, seen);
    if (rule) rejected.push({ id: v.videoId, title: v.title.slice(0, 60), rule });
    else picked.push(v);
  }

  if (picked.length === 0) {
    await store.upsertEdition({ edition_date: date, status: "failed", region: "US" });
    return { step: "pick", picked: 0, rejected, http: 500 };
  }

  await store.upsertEdition({
    edition_date: date,
    status: "building",
    region: "US",
    video_ids: picked.map((v) => v.videoId),
  });

  await store.upsertVideos(
    picked.map((v, i) => ({
      video_id: v.videoId,
      first_edition: date,
      rank: i,
      status: "pending" as const,
      title: v.title,
      channel_id: v.channelId,
      channel_title: v.channelTitle,
      thumbnail_url: v.thumbnailUrl,
      duration_s: v.durationS,
      published_at: v.publishedAt || null,
      stats: {
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        verified_at: new Date().toISOString(),
      },
    }))
  );

  return { step: "pick", picked: picked.length, ids: picked.map((v) => v.videoId), rejected };
}

// ── video ────────────────────────────────────────────────────────────────────

async function stepVideo(date: string): Promise<StepResult> {
  const edition = await store.getEdition(date);
  if (!edition) return { step: "video", done: true, reason: "no_edition" };
  if (edition.status === "published") return { step: "video", done: true, reason: "already_published" };

  const claimed = await store.claimNextVideo(date);
  if (!claimed) {
    // Either everything is done, or another request holds the last claim.
    const remaining = (await store.getVideosForEdition(date)).filter(
      (v) => v.status === "pending" || v.status === "processing"
    ).length;
    return { step: "video", done: remaining === 0, claimed: false, remaining };
  }

  const degraded: string[] = [];
  const gemini: GeminiUsageMap = {};

  // ── Comments ───────────────────────────────────────────────────────────────
  let comments;
  try {
    comments = await fetchCommentThreads(claimed.video_id, 10);
  } catch (err) {
    const kind = err instanceof YouTubeError ? err.kind : "network";
    const reason = kind === "comments_disabled" ? "comments_disabled" : `api_${kind}`;
    await store.patchVideo(claimed.video_id, { status: "skipped", skip_reason: reason });
    return { step: "video", done: false, video_id: claimed.video_id, status: "skipped", reason };
  }

  if (comments.length < MIN_FETCHED) {
    await store.patchVideo(claimed.video_id, {
      status: "skipped",
      skip_reason: "too_few_comments",
    });
    return {
      step: "video",
      done: false,
      video_id: claimed.video_id,
      status: "skipped",
      reason: "too_few_comments",
      fetched: comments.length,
    };
  }

  // ── Author channels. Non-fatal: losing these costs confidence, not the run. ─
  let channels = new Map<string, import("./types").ChannelInfo>();
  try {
    channels = await fetchChannels(comments.map((c) => c.authorChannelId));
  } catch {
    degraded.push("channels:unavailable");
  }

  // ── Everything numeric, in code ────────────────────────────────────────────
  const { analysis, top, candidates } = analyzeVideo(
    {
      videoId: claimed.video_id,
      title: claimed.title,
      publishedAt: claimed.published_at ?? "",
    },
    comments,
    channels
  );

  if (analysis.englishRatio < MIN_ENGLISH_RATIO) {
    await store.patchVideo(claimed.video_id, {
      status: "skipped",
      skip_reason: "non_english_comments",
    });
    return {
      step: "video",
      done: false,
      video_id: claimed.video_id,
      status: "skipped",
      reason: "non_english_comments",
      english_ratio: Number(analysis.englishRatio.toFixed(2)),
    };
  }

  // ── Summary: watch it, else describe it, else say nothing ─────────────────
  let summary: string | null = null;
  const videoCall = await geminiVideoSummary(claimed.video_id, claimed.title);
  if (videoCall) {
    summary = videoCall.text;
    analysis.summarySource = "video";
    gemini.video = videoCall.usage;
  } else {
    degraded.push("summary:video_failed");
    const textCall = await geminiTextSummary(claimed.title, "", top);
    if (textCall) {
      summary = textCall.text;
      analysis.summarySource = "text";
      gemini.text_summary = textCall.usage;
      degraded.push("summary:text_fallback");
    } else {
      analysis.summarySource = "none";
      degraded.push("summary:none");
    }
  }

  // ── Editorial: the one judgement call ─────────────────────────────────────
  const digest = buildDigest(claimed.title, summary, analysis, top, candidates);
  const editorialCall = await geminiEditorial(digest, candidates.length);
  const editorial = editorialCall?.editorial ?? fallbackEditorial(analysis, candidates);
  if (editorialCall) {
    gemini.editorial = editorialCall.usage;
  } else {
    degraded.push("editorial:fallback");
  }

  analysis.vibe = editorial.vibe;
  if (editorial.themes.length > 0) analysis.themes = editorial.themes;
  analysis.degraded = degraded;
  analysis.ytUnits = countUnits(comments.length, channels.size);

  // ── Featured rows: the only comment text that gets stored ─────────────────
  const featured = buildFeaturedRows(claimed.video_id, editorial, candidates, top);

  await store.replaceFeatured(claimed.video_id, featured);
  await store.patchVideo(claimed.video_id, {
    status: "analyzed",
    summary,
    analysis,
    gemini,
    refreshed_at: new Date().toISOString(),
  });

  const remaining = (await store.getVideosForEdition(date)).filter(
    (v) => v.status === "pending" || v.status === "processing"
  ).length;

  return {
    step: "video",
    done: false,
    video_id: claimed.video_id,
    status: "analyzed",
    comments: comments.length,
    candidates: candidates.length,
    degraded,
    yt_units: analysis.ytUnits,
    remaining,
  };
}

/** Six rows: the pick, two runners-up, and the three most-liked for context. */
export function buildFeaturedRows(
  videoId: string,
  editorial: import("./types").EditorialJson,
  candidates: ScoredComment[],
  top: ScoredComment[]
): Partial<FeaturedRow>[] {
  const rows: Partial<FeaturedRow>[] = [];
  const used = new Set<string>();

  const push = (c: ScoredComment | undefined, role: FeaturedRow["role"], position: number, why?: string) => {
    if (!c || used.has(c.id)) return;
    used.add(c.id);
    rows.push({
      comment_id: c.id,
      video_id: videoId,
      role,
      position,
      author_display: c.authorDisplay,
      author_channel_id: c.authorChannelId,
      text: c.text,
      like_count: c.likeCount,
      published_at: c.publishedAt || null,
      why: why || null,
      refreshed_at: new Date().toISOString(),
      removed_at: null,
    });
  };

  push(candidates[editorial.funniest.index], "funniest", 0, editorial.funniest.why);
  editorial.runners_up.forEach((idx, i) => push(candidates[idx], "runner_up", i));
  top.slice(0, 3).forEach((c, i) => push(c, "top", i));

  return rows;
}

/** Quota actually spent on one video: comment pages + channel batches. */
function countUnits(commentCount: number, channelCount: number): number {
  return Math.ceil(commentCount / 100) + Math.ceil(channelCount / 50);
}

// ── publish ──────────────────────────────────────────────────────────────────

async function stepPublish(date: string): Promise<StepResult> {
  const edition = await store.getEdition(date);
  if (!edition) return { step: "publish", http: 409, reason: "no_edition" };
  if (edition.status === "published") {
    return { step: "publish", done: true, existing: true, edition_no: edition.edition_no };
  }

  const videos = await store.getVideosForEdition(date);
  const pending = videos.filter((v) => v.status === "pending" || v.status === "processing");
  if (pending.length > 0) {
    // Red build rather than a half edition. The workflow's video loop should
    // have drained these; if it did not, something is wrong and we want to see it.
    return { step: "publish", http: 409, reason: "videos_pending", pending: pending.length };
  }

  const analyzed = videos.filter((v) => v.status === "analyzed");
  if (analyzed.length === 0) {
    await store.patchEdition(date, { status: "failed" });
    return { step: "publish", status: "failed", reason: "no_analyzed_videos", http: 500 };
  }

  const stats = aggregateEdition(videos);
  const byId = new Map(videos.map((v) => [v.video_id, v]));
  const headline = buildHeadline(stats, (id) => (id ? byId.get(id)?.channel_title ?? null : null));

  // The hero: of the day's five picks, the funniest with the fewest likes.
  const featured = await store.getFeaturedForVideos(analyzed.map((v) => v.video_id));
  const hero = featured
    .filter((f) => f.role === "funniest" && f.text)
    .sort((a, b) => {
      if (a.like_count !== b.like_count) return a.like_count - b.like_count;
      return Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0");
    })[0];

  const teaser = (await geminiTeaser(headline, hero?.text ?? null)) ?? headline;
  const editionNo = (await store.countPublishedEditions()) + 1;

  await store.patchEdition(date, {
    status: "published",
    edition_no: editionNo,
    headline,
    teaser,
    stats,
    video_ids: analyzed.map((v) => v.video_id),
    hero_comment_id: hero?.comment_id ?? null,
    published_at: new Date().toISOString(),
  });

  return {
    step: "publish",
    done: true,
    status: "published",
    edition_no: editionNo,
    headline,
    videos_analyzed: stats.videosAnalyzed,
    videos_skipped: stats.videosSkipped,
    comments_analyzed: stats.commentsAnalyzed,
  };
}

// ── refresh ──────────────────────────────────────────────────────────────────

/**
 * The compliance step. Runs last in the daily workflow rather than on its own
 * monthly schedule, because a monthly job that misses one run is already a
 * breach. At 25 days there are five days of retries before anything is late, and
 * on a typical day this costs zero quota units because nothing is due yet.
 */
async function stepRefresh(): Promise<StepResult> {
  const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 86_400_000).toISOString();
  const now = new Date().toISOString();

  let updated = 0;
  let removed = 0;
  let videosUpdated = 0;
  let videosRemoved = 0;

  // ── Featured comments ──────────────────────────────────────────────────────
  const due = await store.listFeaturedDue(cutoff, 200);
  if (due.length > 0) {
    try {
      const live = await fetchCommentsById(due.map((f) => f.comment_id));
      for (const row of due) {
        const fresh = live.get(row.comment_id);
        if (fresh) {
          await store.patchFeatured(row.comment_id, {
            text: fresh.text,
            like_count: fresh.likeCount,
            author_display: fresh.authorDisplay,
            refreshed_at: now,
          });
          updated++;
        } else {
          // Deleted upstream. Our commentary stays; the quote goes.
          await store.patchFeatured(row.comment_id, {
            text: null,
            removed_at: now,
            refreshed_at: now,
          });
          removed++;
        }
      }
    } catch (err) {
      const kind = err instanceof YouTubeError ? err.kind : "network";
      return { step: "refresh", error: kind, due: due.length, updated, removed };
    }
  }

  // ── Video statistics ───────────────────────────────────────────────────────
  const videosDue = await store.listVideosDue(cutoff, 200);
  if (videosDue.length > 0) {
    try {
      const live = await fetchVideoStats(videosDue.map((v) => v.video_id));
      for (const row of videosDue) {
        const fresh = live.get(row.video_id);
        if (fresh) {
          await store.patchVideo(row.video_id, {
            stats: { ...row.stats, ...fresh, verified_at: now },
            refreshed_at: now,
          });
          videosUpdated++;
        } else {
          await store.patchVideo(row.video_id, {
            stats: { ...row.stats, removed: true, verified_at: now },
            refreshed_at: now,
          });
          videosRemoved++;
        }
      }
    } catch (err) {
      const kind = err instanceof YouTubeError ? err.kind : "network";
      return { step: "refresh", error: kind, updated, removed, videos_updated: videosUpdated };
    }
  }

  return {
    step: "refresh",
    featured_due: due.length,
    updated,
    removed,
    videos_due: videosDue.length,
    videos_updated: videosUpdated,
    videos_removed: videosRemoved,
  };
}

/** Exported for the dry-run script and tests. */
export const RULES = {
  PICK_COUNT,
  CHART_SIZE,
  MIN_COMMENTS,
  MIN_FETCHED,
  MIN_DURATION_S,
  MIN_ENGLISH_RATIO,
  SKIP_RETRY_DAYS,
  REFRESH_AFTER_DAYS,
};
