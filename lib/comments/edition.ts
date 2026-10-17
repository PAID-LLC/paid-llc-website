// ── The daily step machine ───────────────────────────────────────────────────
// Four steps, driven by GitHub Actions against /api/comments/cron:
//
//   pick     pool ~450 videos, rank by view and comment velocity, keep five  ~5 seconds
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
  fetchCandidatePool,
  fetchCommentThreads,
  fetchChannels,
  fetchCommentsById,
  fetchVideoStats,
  UNAVAILABLE_VIDEO_IDS,
  YouTubeError,
  type CandidatePool,
} from "./youtube";
import { analyzeVideo } from "./analyze";
import {
  geminiVideoSummary,
  geminiTextSummary,
  geminiEditorial,
  geminiHero,
  geminiTeaser,
  buildDigest,
  fallbackEditorial,
  templatedVibe,
} from "./gemini";
import { aggregateEdition, buildHeadline } from "./headline";
import { humorScore } from "./humor";
import * as store from "./store";
import type {
  StepName,
  StepResult,
  VideoPick,
  FeaturedRow,
  ScoredComment,
  GeminiUsageMap,
  ReserveVideo,
} from "./types";

/** Videos per edition. */
const PICK_COUNT = 5;
/**
 * Backups stored with the five. Promoted only when a pick is skipped, so a thin
 * section costs a card instead of a hole. Language is not a skip. No comment
 * quota until promotion: the workflow's video loop has room for both.
 */
const RESERVE_COUNT = 2;
/**
 * Upload-age window for competing. Velocity since upload only means "rising
 * right now" for a recent upload: a month-old video with a big lifetime total
 * would otherwise outrank today's actual story.
 */
const MAX_AGE_H = 72;
/**
 * Too new to judge. The funniest-comment shortlist only admits comments at least
 * six hours old (humor.ts), so a two-hour-old video would arrive with nothing
 * eligible to feature.
 */
const MIN_AGE_H = 8;
/**
 * Past this age the average-since-upload overstates "trending now" for anything
 * that front-loaded its views. The rank multiplies by a factor that is 1 through
 * 36h and FRESHNESS_FLOOR at 72h. YouTube does not publish hourly view counts
 * for other people's videos, so this is the recent-velocity term we can afford.
 */
const FRESHNESS_FULL_AGE_H = 36;
const FRESHNESS_FLOOR = 0.7;
/**
 * Hard-filter survivors looked up in history. Batched in store.ts, 40 ids at a
 * time, so this can be wider than the old single-URL cap of 40 without putting
 * 450 ids in one request. Past this we would rather stop than re-pick a video
 * whose id we failed to check.
 */
const ELIGIBLE_LOOKED_UP = 120;
/** Rejections echoed in full to the workflow log; the rest are counted. */
const REJECTED_LOGGED = 25;
/**
 * Below this many comments there is nothing to analyse. 200 let through cards
 * that published 119–300 comments (Jynxzi on 2026-10-06, the Narnia and Gilded
 * Age trailers on 2026-10-14). 400 is the floor for a section worth a column.
 */
const MIN_COMMENTS = 400;
/**
 * One comment per this many views. A trailer with 12M views and ~300 comments
 * (Narnia, 2026-10-14) and a 7.4M-view minute-long clip with 306 comments
 * (2026-10-08) clear a raw count while nobody is actually talking.
 */
const MIN_VIEWS_PER_COMMENT = 20_000;
/** Below this many actually fetched, the section is too thin to publish. */
const MIN_FETCHED = 250;
/** Under a minute is a Short even when the uploader never tagged it. */
const MIN_DURATION_S = 60;
/**
 * Shorts run to three minutes and dominate a views-per-hour sort. A clip that
 * short only earns a card when the section is large enough to be one: trailers
 * like the GTA VI launch (1:31, a full fetch) stay, the 60–120s challenge clips
 * with a few hundred comments do not.
 */
const SHORT_MAX_DURATION_S = 180;
const SHORT_MIN_COMMENTS = 800;
/** At most this many videos from one YouTube category in the five. */
const MAX_PER_CATEGORY = 2;
/**
 * A channel that already ran inside this many days waits. His Story took six of
 * fourteen editions from 2026-10-03, on consecutive days; Jimmy Kimmel, Serena
 * Neel, IShowSpeed and MLB each took four. The cap is relaxed if the edition
 * would otherwise publish short.
 */
const CHANNEL_COOLDOWN_DAYS = 3;
/** Token-set overlap that counts as the same upload under two titles. */
const NEAR_DUP_JACCARD = 0.6;
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
  | "unavailable"
  | "live"
  | "comments_disabled"
  | "too_few_comments"
  | "thin_discussion"
  | "too_short"
  | "short"
  | "hashtag_title"
  | "too_new"
  | "too_old"
  | "already_analyzed"
  | "recently_skipped"
  | "same_channel"
  | "same_category"
  | "recent_channel"
  | "near_duplicate";

/** Hours since upload, or null when the timestamp is missing or unparseable. */
function ageHours(v: VideoPick, now: number): number | null {
  const t = Date.parse(v.publishedAt);
  return Number.isFinite(t) ? (now - t) / 3_600_000 : null;
}

/**
 * Average views per hour since upload. YouTube publishes no daily view counts
 * for other people's videos, so this is the view half of "rising right now".
 * Age is floored at one hour so a brand-new upload cannot divide by nearly nothing.
 * Shown on the card; the sort itself is rankScore.
 */
export function viewsPerHour(v: VideoPick, now = Date.now()): number {
  return v.views / Math.max(1, ageHours(v, now) ?? Infinity);
}

/** Average comments per hour since upload. The comment-section half of the rank. */
export function commentsPerHour(v: VideoPick, now = Date.now()): number {
  if (v.comments <= 0) return 0;
  return v.comments / Math.max(1, ageHours(v, now) ?? Infinity);
}

/**
 * 1 through FRESHNESS_FULL_AGE_H, then a straight line down to FRESHNESS_FLOOR
 * at MAX_AGE_H. A missing timestamp gets the floor rather than a free boost.
 */
export function freshnessFactor(ageH: number | null): number {
  if (ageH === null) return FRESHNESS_FLOOR;
  if (ageH <= FRESHNESS_FULL_AGE_H) return 1;
  const t = Math.min(1, (ageH - FRESHNESS_FULL_AGE_H) / (MAX_AGE_H - FRESHNESS_FULL_AGE_H));
  return 1 - t * (1 - FRESHNESS_FLOOR);
}

/**
 * The sort key: geometric mean of view velocity and comment velocity, times
 * freshness.
 *
 * Views per hour alone is what the page used through 2026-10-16, and across
 * those fourteen editions it promoted view-bombs whose rooms were thin (a 7.4M
 * view, 68-second clip with 306 comments; a 12M-view trailer with 300). The
 * geometric mean makes a quiet room and a slow video both lose, so neither
 * signal can carry a pick by itself. Raw lifetime totals are not an input.
 */
export function rankScore(v: VideoPick, now = Date.now()): number {
  const vph = viewsPerHour(v, now);
  const cph = commentsPerHour(v, now);
  if (vph <= 0 || cph <= 0) return 0;
  return Math.sqrt(vph * cph) * freshnessFactor(ageHours(v, now));
}

/** The pool, best rank score first. */
export function rankByVelocity(pool: VideoPick[], now = Date.now()): VideoPick[] {
  return [...pool].sort((a, b) => rankScore(b, now) - rankScore(a, now));
}

const TITLE_STOP = new Set([
  "the", "a", "an", "of", "and", "or", "to", "for", "in", "on", "with", "from",
  "official", "video", "music", "trailer", "teaser", "highlights", "full",
  "game", "episode", "feat", "part", "new", "watch", "live", "its", "his", "her",
]);

/** Significant title words, for near-duplicate detection. Exported for the quality report. */
export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !TITLE_STOP.has(t));
}

/**
 * True when `title` is the same upload as one of `others` under a different
 * cut of the words. Requires two shared tokens so a single word ("trailer",
 * already stripped, or "minecraft") cannot collide unrelated videos.
 */
export function nearDuplicateTitle(title: string, others: string[]): boolean {
  const a = titleTokens(title);
  if (a.length < 2) return false;
  const A = new Set(a);
  for (const other of others) {
    const B = new Set(titleTokens(other));
    if (B.size < 2) continue;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    if (inter < 2) continue;
    const union = A.size + B.size - inter;
    if (union > 0 && inter / union >= NEAR_DUP_JACCARD) return true;
  }
  return false;
}

/**
 * The editorial filter, in priority order. The first rule a video fails is the
 * one reported, so the workflow log shows WHY the pool thinned out on a day it
 * produced fewer than five.
 *
 * Channel cooldown, category cap and near-duplicates are applied by choosePicks,
 * because they depend on what else has already been picked. Everything here is
 * a property of the video alone.
 */
export function rejectReason(
  v: VideoPick,
  seen: Map<string, { status: string; created_at: string }>,
  now = Date.now()
): RejectRule | null {
  if (UNAVAILABLE_VIDEO_IDS.has(v.videoId)) return "unavailable";
  if (v.privacyStatus && v.privacyStatus !== "public") return "unavailable";
  if (v.uploadStatus && v.uploadStatus !== "processed") return "unavailable";
  if (v.regionBlocked) return "unavailable";

  if (v.liveBroadcastContent !== "none") return "live";
  // -1 means the API omitted commentCount, which is how it signals disabled.
  if (v.comments < 0) return "comments_disabled";
  if (v.comments < MIN_COMMENTS) return "too_few_comments";
  if (v.views > 0 && v.comments / v.views < 1 / MIN_VIEWS_PER_COMMENT) return "thin_discussion";
  if (v.durationS > 0 && v.durationS < MIN_DURATION_S) return "too_short";
  // Shorts now run to three minutes. The tag is how uploaders mark them, and
  // "#sportsshorts" is the form that cleared the old /^#shorts?\b/ check
  // (Jared Berlin, 2026-10-09). A short clip with a real section still passes
  // on the comment floor below: the GTA VI launch trailer is 91 seconds.
  if (/#\w*shorts?\b/i.test(`${v.title} ${v.description}`)) return "short";
  if (
    v.durationS > 0 &&
    v.durationS <= SHORT_MAX_DURATION_S &&
    v.comments < SHORT_MIN_COMMENTS
  ) {
    return "short";
  }
  // A title that is nothing but hashtags is the other signature of Shorts and
  // clip reposts: the first pooled run put "#hoyoverse", a reuploaded Doctor
  // Strange montage, fourth on the page. One real word is enough ("Wolverine").
  // Marks count as part of a word: scripts like Khmer write vowels as combining
  // marks between letters, and without them a real title reads as no words.
  if (!/[\p{L}\p{M}]{3,}/u.test(v.title.replace(/#[\p{L}\p{M}\p{N}_]+/gu, ""))) return "hashtag_title";

  const age = ageHours(v, now);
  if (age !== null && age < MIN_AGE_H) return "too_new";
  if (age !== null && age > MAX_AGE_H) return "too_old";

  // Language is not a gate. A non-English upload that clears the floors keeps
  // its place, and the card offers Translate. See lib/comments/language.ts.

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

  let pool: CandidatePool;
  try {
    pool = await fetchCandidatePool("US");
  } catch (err) {
    const kind = err instanceof YouTubeError ? err.kind : "network";
    await store.upsertEdition({ edition_date: date, status: "failed", region: "US" });
    return { step: "pick", picked: 0, error: kind, http: 500 };
  }

  const now = Date.now();
  const { picked, reserves, rejected, rejectedCounts, relaxed } = await choosePicks(pool.videos, now);
  const log = {
    pool: pool.videos.length,
    sources: pool.sources,
    rejected,
    rejected_counts: rejectedCounts,
    reserves: reserves.length,
    relaxed,
  };

  if (picked.length === 0) {
    await store.upsertEdition({ edition_date: date, status: "failed", region: "US" });
    return { step: "pick", picked: 0, ...log, http: 500 };
  }

  await store.upsertEdition({
    edition_date: date,
    status: "building",
    region: "US",
    video_ids: picked.map((v) => v.videoId),
    stats: { reserves: reserves.map((v) => toReserve(v, now)) },
  });

  await store.upsertVideos(picked.map((v, i) => videoInsert(v, date, i, now)));

  return { step: "pick", picked: picked.length, ids: picked.map((v) => v.videoId), ...log };
}

function videoInsert(v: VideoPick, date: string, rank: number, now: number) {
  return {
    video_id: v.videoId,
    first_edition: date,
    rank,
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
      views_per_hour: Math.round(viewsPerHour(v, now)),
      comments_per_hour: Math.round(commentsPerHour(v, now)),
      rank_score: Math.round(rankScore(v, now)),
      category_id: v.categoryId ?? null,
      default_audio_language: v.defaultAudioLanguage,
      default_language: v.defaultLanguage,
      verified_at: new Date().toISOString(),
    },
  };
}

function toReserve(v: VideoPick, now: number): ReserveVideo {
  return {
    videoId: v.videoId,
    title: v.title,
    channelId: v.channelId,
    channelTitle: v.channelTitle,
    thumbnailUrl: v.thumbnailUrl,
    durationS: v.durationS,
    publishedAt: v.publishedAt,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    viewsPerHour: Math.round(viewsPerHour(v, now)),
    commentsPerHour: Math.round(commentsPerHour(v, now)),
    rankScore: Math.round(rankScore(v, now)),
    categoryId: v.categoryId ?? null,
    defaultAudioLanguage: v.defaultAudioLanguage,
    defaultLanguage: v.defaultLanguage,
  };
}

export interface RecentPickRef {
  channel_id: string;
  title: string;
}

/**
 * The five, best rank score first, plus up to two backups.
 *
 * One video per channel (the 2026-09-19 pool held three episodes of one TV
 * serial). On top of that, while the five are still open: at most two from any
 * category, no channel that already ran in the last CHANNEL_COOLDOWN_DAYS, and
 * no title that is a near-duplicate of a recent pick or of one already chosen.
 * Those three are diversity rules. If they would leave the edition short, a
 * second pass drops them and keeps the hard filters. Backups ignore the
 * diversity rules either way, so a skip has somewhere to go.
 *
 * Pass `recent` to supply cooldown history (tests). Otherwise the last few
 * editions are read from the store, which returns nothing when Supabase is unset.
 */
export async function choosePicks(
  pool: VideoPick[],
  now = Date.now(),
  recent?: RecentPickRef[]
): Promise<{
  picked: VideoPick[];
  reserves: VideoPick[];
  rejected: { id: string; title: string; rule: RejectRule }[];
  rejectedCounts: Partial<Record<RejectRule, number>>;
  relaxed: boolean;
}> {
  const ranked = rankByVelocity(pool, now);
  const eligible = ranked
    .filter((v) => rejectReason(v, NO_HISTORY, now) === null)
    .slice(0, ELIGIBLE_LOOKED_UP);
  const seen = await store.getExistingVideoRows(eligible.map((v) => v.videoId));
  const history =
    recent ??
    (await store.listRecentPicks(
      editionDateToday(new Date(now - CHANNEL_COOLDOWN_DAYS * 86_400_000))
    ));
  const recentChannels = new Set(history.map((r) => r.channel_id).filter(Boolean));
  const recentTitles = history.map((r) => r.title);

  const strict = selectFrom(ranked, seen, recentChannels, recentTitles, now, false);
  const pass = strict.selected.length >= PICK_COUNT
    ? strict
    : selectFrom(ranked, seen, recentChannels, recentTitles, now, true);

  return {
    picked: pass.selected.slice(0, PICK_COUNT),
    reserves: pass.selected.slice(PICK_COUNT, PICK_COUNT + RESERVE_COUNT),
    rejected: pass.rejected,
    rejectedCounts: pass.rejectedCounts,
    relaxed: strict.selected.length < PICK_COUNT,
  };
}

function selectFrom(
  ranked: VideoPick[],
  seen: Map<string, { status: string; created_at: string }>,
  recentChannels: Set<string>,
  recentTitles: string[],
  now: number,
  ignoreSoft: boolean
): {
  selected: VideoPick[];
  rejected: { id: string; title: string; rule: RejectRule }[];
  rejectedCounts: Partial<Record<RejectRule, number>>;
} {
  const selected: VideoPick[] = [];
  const rejected: { id: string; title: string; rule: RejectRule }[] = [];
  const rejectedCounts: Partial<Record<RejectRule, number>> = {};
  const channels = new Set<string>();
  const categories = new Map<string, number>();
  const titles: string[] = [];
  const stopAt = PICK_COUNT + RESERVE_COUNT;

  for (const v of ranked) {
    if (selected.length >= stopAt) break;
    let rule = rejectReason(v, seen, now);
    if (!rule && channels.has(v.channelId)) rule = "same_channel";
    if (!rule && nearDuplicateTitle(v.title, titles)) rule = "near_duplicate";

    // Diversity applies only while the five are open. Backups are the next
    // best videos that still pass the hard rules, so a skip has a replacement
    // even on a day when one category is the whole story.
    const fillingReserves = selected.length >= PICK_COUNT;
    if (!ignoreSoft && !fillingReserves) {
      if (!rule && v.channelId && recentChannels.has(v.channelId)) rule = "recent_channel";
      if (!rule && nearDuplicateTitle(v.title, recentTitles)) rule = "near_duplicate";
      if (
        !rule &&
        v.categoryId &&
        (categories.get(v.categoryId) ?? 0) >= MAX_PER_CATEGORY
      ) {
        rule = "same_category";
      }
    }

    if (rule) {
      rejectedCounts[rule] = (rejectedCounts[rule] ?? 0) + 1;
      if (rejected.length < REJECTED_LOGGED) {
        rejected.push({ id: v.videoId, title: v.title.slice(0, 60), rule });
      }
      continue;
    }

    selected.push(v);
    channels.add(v.channelId);
    titles.push(v.title);
    if (!fillingReserves && v.categoryId) {
      categories.set(v.categoryId, (categories.get(v.categoryId) ?? 0) + 1);
    }
  }

  return { selected, rejected, rejectedCounts };
}

const NO_HISTORY = new Map<string, { status: string; created_at: string }>();

/**
 * Mark a claimed video skipped and promote the next backup, if one is waiting.
 * The backup becomes a pending row, so the workflow's next video request picks
 * it up. Returns the promoted id, or null when the edition has no backups left.
 */
async function skipAndPromote(date: string, videoId: string, reason: string): Promise<string | null> {
  await store.patchVideo(videoId, { status: "skipped", skip_reason: reason });
  const edition = await store.getEdition(date);
  const reserves = edition?.stats.reserves;
  if (!edition || !reserves || reserves.length === 0) return null;

  const [next, ...rest] = reserves;
  const rank = edition.video_ids.length;
  const inserted = await store.upsertVideos([
    {
      video_id: next.videoId,
      first_edition: date,
      rank,
      status: "pending",
      title: next.title,
      channel_id: next.channelId,
      channel_title: next.channelTitle,
      thumbnail_url: next.thumbnailUrl,
      duration_s: next.durationS,
      published_at: next.publishedAt || null,
      stats: {
        views: next.views,
        likes: next.likes,
        comments: next.comments,
        views_per_hour: next.viewsPerHour,
        comments_per_hour: next.commentsPerHour,
        rank_score: next.rankScore,
        category_id: next.categoryId ?? null,
        default_audio_language: next.defaultAudioLanguage ?? null,
        default_language: next.defaultLanguage ?? null,
        verified_at: new Date().toISOString(),
      },
    },
  ]);
  if (!inserted) return null;

  await store.patchEdition(date, {
    video_ids: [...edition.video_ids, next.videoId],
    stats: { ...edition.stats, reserves: rest },
  });
  return next.videoId;
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
    const promoted = await skipAndPromote(date, claimed.video_id, reason);
    return { step: "video", done: false, video_id: claimed.video_id, status: "skipped", reason, promoted };
  }

  if (comments.length < MIN_FETCHED) {
    const promoted = await skipAndPromote(date, claimed.video_id, "too_few_comments");
    return {
      step: "video",
      done: false,
      video_id: claimed.video_id,
      status: "skipped",
      reason: "too_few_comments",
      fetched: comments.length,
      promoted,
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

  // Language does not skip the video. englishRatio stays on the analysis so the
  // card can offer Translate when the section is not in English.

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

  // A section that fills faster than the six-hour "overlooked" rule can see had
  // its age gate relaxed to the section's own median comment age. Worth showing:
  // it is a weaker claim about the pick than the standard one, and on 2026-09-20
  // the unrelaxed rule left a MrBeast card with no underrated comment at all.
  const gateH = analysis.candidateAgeGateH;
  if (typeof gateH === "number" && gateH < 6) degraded.push(`candidates:fast_section_${gateH}h`);
  if (candidates.length === 0) degraded.push("candidates:none");

  // ── Editorial: the one judgement call ─────────────────────────────────────
  const digest = buildDigest(claimed.title, summary, analysis, top, candidates);
  const editorialCall = await geminiEditorial(digest, candidates.length);
  const editorial = editorialCall?.editorial ?? fallbackEditorial(analysis, candidates);
  if (editorialCall) {
    gemini.editorial = editorialCall.usage;
  } else {
    degraded.push("editorial:fallback");
  }

  // An empty vibe means the model's mood line carried a house-style tell (the
  // "Viewers are cracking up over..." opener that eight of the first ten used)
  // and was dropped in validation. The computed one is plainer and always true.
  if (editorial.vibe) {
    analysis.vibe = editorial.vibe;
  } else {
    analysis.vibe = templatedVibe(analysis);
    degraded.push("vibe:house_style");
  }
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

/**
 * The per-video winners, best first by code alone: fewest likes, then the
 * humour score, then newest.
 *
 * Likes alone cannot decide it. Every finalist already cleared the underrated
 * bar, so most days several tie at 0, and on edition 1 (2026-09-19) a pure
 * recency tiebreak led the page with a comment that only said the video was
 * funny. The humour score demotes exactly that kind of reaction, so even with
 * the model unavailable the fallback now prefers an actual joke.
 */
export function rankHeroFinalists(featured: FeaturedRow[]): FeaturedRow[] {
  return featured
    .filter((f) => f.role === "funniest" && f.text)
    .sort((a, b) => {
      if (a.like_count !== b.like_count) return a.like_count - b.like_count;
      const humor = humorScore(b.text ?? "") - humorScore(a.text ?? "");
      if (humor !== 0) return humor;
      return Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0");
    });
}

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

  // The hero: the funniest of the day's per-video winners, judged by the model,
  // with the code ranking as the fallback and as the order the model sees.
  const featured = await store.getFeaturedForVideos(analyzed.map((v) => v.video_id));
  const finalists = rankHeroFinalists(featured);
  const heroIndex = await geminiHero(
    finalists.map((f) => ({ text: f.text ?? "", video: byId.get(f.video_id)?.title ?? "" }))
  );
  const hero = finalists[heroIndex ?? 0];

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
          const { title, channelTitle, thumbnailUrl, ...counts } = fresh;
          await store.patchVideo(row.video_id, {
            stats: { ...row.stats, ...counts, verified_at: now },
            // Displayed snippet fields are API data on the same 30-day clock.
            ...(title ? { title } : {}),
            ...(channelTitle ? { channel_title: channelTitle } : {}),
            ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
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
  RESERVE_COUNT,
  MAX_AGE_H,
  MIN_AGE_H,
  FRESHNESS_FULL_AGE_H,
  FRESHNESS_FLOOR,
  MIN_COMMENTS,
  MIN_VIEWS_PER_COMMENT,
  MIN_FETCHED,
  MIN_DURATION_S,
  SHORT_MAX_DURATION_S,
  SHORT_MIN_COMMENTS,
  MAX_PER_CATEGORY,
  CHANNEL_COOLDOWN_DAYS,
  NEAR_DUP_JACCARD,
  SKIP_RETRY_DAYS,
  REFRESH_AFTER_DAYS,
};
