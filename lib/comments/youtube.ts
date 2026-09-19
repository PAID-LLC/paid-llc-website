// ── YouTube Data API v3 client ───────────────────────────────────────────────
// Key-only, no OAuth: every endpoint used here serves public data.
//
// QUOTA IS THE REAL CONSTRAINT, not money. The free allowance is 10,000 units a
// day, resetting at midnight Pacific, and it cannot be topped up without a
// written compliance audit. So every call is counted into the `yt_units` daily
// counter, and the per-call costs are documented at each function:
//
//   videos.list          1 unit per call, up to 50 ids or one chart page
//   search.list          100 units per call (counted at the classic rate)
//   commentThreads.list  1 unit per PAGE of up to 100 comments
//   channels.list        1 unit per call, up to 50 ids
//   comments.list        1 unit per call, up to 50 ids
//
// One edition of five videos costs about 350 units: roughly 215 to build the
// candidate pool (eleven charts, two searches) and 135 to read five comment
// sections. The budget is not close to binding. It would only bind if something
// retried in a loop, which is why the step machine is idempotent and the
// workflow's loop is bounded.

import { bumpCounter } from "@/lib/usage-guard";
import type { CommentInput, ChannelInfo, VideoPick } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 20_000;

/** Typed failure so callers can distinguish "skip this video" from "stop". */
export class YouTubeError extends Error {
  constructor(
    public readonly kind:
      | "comments_disabled"
      | "quota_exceeded"
      | "not_found"
      | "forbidden"
      | "network"
      | "no_key",
    message?: string
  ) {
    super(message ?? kind);
    this.name = "YouTubeError";
  }
}

interface RawError {
  error?: { errors?: { reason?: string }[]; message?: string };
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("no_key");

  const qs = new URLSearchParams({ ...params, key });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API}/${path}?${qs}`, { signal: controller.signal });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as RawError;
      const reason = body.error?.errors?.[0]?.reason ?? "";
      if (reason === "commentsDisabled") throw new YouTubeError("comments_disabled");
      if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
        throw new YouTubeError("quota_exceeded", body.error?.message);
      }
      if (res.status === 404) throw new YouTubeError("not_found");
      if (res.status === 403) throw new YouTubeError("forbidden", body.error?.message);
      throw new YouTubeError("network", `HTTP ${res.status}: ${body.error?.message ?? ""}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof YouTubeError) throw err;
    throw new YouTubeError("network", err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

// ── Shapes we actually read (the API returns far more) ───────────────────────

interface VideoItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

interface ThreadItem {
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: {
        textOriginal?: string;
        authorDisplayName?: string;
        authorProfileImageUrl?: string;
        authorChannelId?: { value?: string };
        likeCount?: number;
        publishedAt?: string;
      };
    };
    totalReplyCount?: number;
  };
}

interface ChannelItem {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
    viewCount?: string;
  };
}

interface CommentItem {
  id: string;
  snippet?: {
    textOriginal?: string;
    authorDisplayName?: string;
    authorChannelId?: { value?: string };
    likeCount?: number;
    publishedAt?: string;
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Best available thumbnail. maxres is absent on plenty of videos. */
export function bestThumbnail(thumbs: Record<string, { url?: string }> | undefined): string {
  if (!thumbs) return "";
  for (const size of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbs[size]?.url;
    if (url) return url;
  }
  return "";
}

/** ISO 8601 duration ("PT4M13S") to seconds. */
export function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    (d ? +d * 86400 : 0) + (h ? +h * 3600 : 0) + (min ? +min * 60 : 0) + (s ? +s : 0)
  );
}

/** The most-popular chart for a region. 1 quota unit. */
export async function fetchMostPopular(region = "US", max = 25): Promise<VideoPick[]> {
  const data = await call<{ items?: VideoItem[] }>("videos", {
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: region,
    maxResults: String(Math.min(50, max)),
  });
  await bumpCounter("yt_units", 1);
  return (data.items ?? []).map(toPick);
}

/**
 * Categories whose US most-popular chart still exists, verified live 2026-09-19.
 *
 * Since 2025-07-21 the plain chart (no category) carries only YouTube's Trending
 * Music, Movies and Gaming charts, so on its own it is a music-and-games list,
 * not the day's most-watched: edition 1 had no news, sports or comedy at all.
 * Education (27), Movies (30) and Trailers (44) return 404/400 and are left out.
 * A category YouTube retires later is skipped, never fatal.
 */
export const POOL_CATEGORIES = ["1", "10", "17", "20", "22", "23", "24", "25", "26", "28"] as const;

/** search.list, counted at the classic rate so the daily counter never under-reports. */
const SEARCH_UNITS = 100;

/**
 * Views-sorted searches. The charts can miss the single biggest upload of the
 * day entirely (MrBeast's 10.4M-views-in-22-hours video on 2026-09-19 was in no
 * chart), and a views-sorted search finds it. Search is only a supplement: it
 * returns nothing without a query term (hence "*"), "US" there means viewable in
 * the US rather than popular in it, and YouTube documents its date-filtered
 * results as approximate and incomplete. The rank filters do the rest.
 */
const POOL_SEARCHES: { label: string; hours: number; videoDuration?: string }[] = [
  { label: "search:24h", hours: 24 },
  { label: "search:48h-long", hours: 48, videoDuration: "long" },
];

export interface CandidatePool {
  videos: VideoPick[];
  /** New unique videos each source contributed, for the workflow log. */
  sources: Record<string, number>;
}

/**
 * Every video that could lead today's edition: the default chart, each category
 * chart, and two views-sorted searches, de-duplicated. Roughly 450 videos for
 * about 215 quota units. Ranking and filtering happen in edition.ts.
 *
 * Only a quota failure on the CHARTS is fatal. A retired category chart or a
 * failed search costs that source, not the edition.
 */
export async function fetchCandidatePool(region = "US", now = Date.now()): Promise<CandidatePool> {
  const byId = new Map<string, VideoPick>();
  const sources: Record<string, number> = {};
  const add = (label: string, picks: VideoPick[]) => {
    let fresh = 0;
    for (const p of picks) {
      if (!byId.has(p.videoId)) {
        byId.set(p.videoId, p);
        fresh++;
      }
    }
    sources[label] = fresh;
  };

  for (const category of [null, ...POOL_CATEGORIES]) {
    const label = category ? `chart:${category}` : "chart";
    try {
      await bumpCounter("yt_units", 1);
      const data = await call<{ items?: VideoItem[] }>("videos", {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode: region,
        maxResults: "50",
        ...(category ? { videoCategoryId: category } : {}),
      });
      add(label, (data.items ?? []).map(toPick));
    } catch (err) {
      if (err instanceof YouTubeError && err.kind === "quota_exceeded") throw err;
      sources[label] = 0;
    }
  }

  for (const s of POOL_SEARCHES) {
    try {
      await bumpCounter("yt_units", SEARCH_UNITS);
      const data = await call<{ items?: { id?: { videoId?: string } }[] }>("search", {
        part: "id",
        type: "video",
        order: "viewCount",
        q: "*",
        publishedAfter: new Date(now - s.hours * 3_600_000).toISOString(),
        regionCode: region,
        relevanceLanguage: "en",
        maxResults: "50",
        ...(s.videoDuration ? { videoDuration: s.videoDuration } : {}),
      });
      const ids = (data.items ?? [])
        .map((i) => i.id?.videoId)
        .filter((id): id is string => !!id && !byId.has(id));
      add(s.label, ids.length > 0 ? await fetchVideoDetails(ids) : []);
    } catch {
      // Including quota: search has its own bucket, and the charts already
      // produced a usable pool.
      sources[s.label] = 0;
    }
  }

  return { videos: [...byId.values()], sources };
}

/** Full details for specific ids, batched 50 per call. 1 unit per batch. */
export async function fetchVideoDetails(ids: string[]): Promise<VideoPick[]> {
  const out: VideoPick[] = [];
  for (const batch of chunk(ids, 50)) {
    const data = await call<{ items?: VideoItem[] }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
      maxResults: "50",
    });
    await bumpCounter("yt_units", 1);
    out.push(...(data.items ?? []).map(toPick));
  }
  return out;
}

/**
 * Statistics only, for the 30-day re-verification. 1 unit per 50 ids.
 * Returns a map so the caller can tell which ids came back and which are gone —
 * a video deleted upstream simply does not appear in the response.
 */
export interface VideoRefresh {
  views: number;
  likes: number;
  comments: number;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/**
 * Statistics AND the snippet fields we display. Titles, channel names and
 * thumbnails are YouTube API data under the same 30-day rule as view counts,
 * and until 2026-09-19 only the counts were re-fetched, so a stored title could
 * outlive the limit. Adding "snippet" costs nothing: videos.list is 1 unit per
 * call whatever the parts.
 */
export async function fetchVideoStats(ids: string[]): Promise<Map<string, VideoRefresh>> {
  const out = new Map<string, VideoRefresh>();
  for (const batch of chunk(ids, 50)) {
    const data = await call<{ items?: VideoItem[] }>("videos", {
      part: "snippet,statistics",
      id: batch.join(","),
      maxResults: "50",
    });
    await bumpCounter("yt_units", 1);
    for (const item of data.items ?? []) {
      out.set(item.id, {
        views: num(item.statistics?.viewCount),
        likes: num(item.statistics?.likeCount),
        comments: num(item.statistics?.commentCount),
        title: item.snippet?.title ?? "",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
      });
    }
  }
  return out;
}

/**
 * Top-level comments, paginated. 1 unit per page of up to 100.
 *
 * Ordered by relevance rather than time: YouTube's relevance ordering surfaces
 * the comments people actually engaged with, which is the population the "most
 * liked" list needs. The underrated pick still works because relevance ordering
 * returns plenty of low-like comments too, and it does not bias by like count
 * alone the way `order=time` biases by recency.
 *
 * textFormat=plainText matters: the html format returns entity-escaped markup
 * that would need sanitizing before it ever reached a page.
 */
export async function fetchCommentThreads(
  videoId: string,
  maxPages = 10
): Promise<CommentInput[]> {
  const out: CommentInput[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "snippet",
      videoId,
      maxResults: "100",
      order: "relevance",
      textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await call<{ items?: ThreadItem[]; nextPageToken?: string }>(
      "commentThreads",
      params
    );
    await bumpCounter("yt_units", 1);

    for (const item of data.items ?? []) {
      const c = toComment(item);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break; // fewer comments than we asked for; stop paying
  }

  return out;
}

/**
 * Public channel facts for comment authors. 1 unit per 50 ids.
 *
 * Failure here is survivable and the caller treats it that way: without channel
 * data the automation estimate loses its identity signals and reports lower
 * confidence, which is better than failing the whole video.
 */
export async function fetchChannels(ids: string[]): Promise<Map<string, ChannelInfo>> {
  const out = new Map<string, ChannelInfo>();
  const unique = [...new Set(ids.filter(Boolean))];

  for (const batch of chunk(unique, 50)) {
    const data = await call<{ items?: ChannelItem[] }>("channels", {
      part: "snippet,statistics",
      id: batch.join(","),
      maxResults: "50",
    });
    await bumpCounter("yt_units", 1);

    for (const item of data.items ?? []) {
      out.set(item.id, {
        id: item.id,
        title: item.snippet?.title ?? "",
        createdAt: item.snippet?.publishedAt ?? "",
        subscriberCount: item.statistics?.hiddenSubscriberCount
          ? null
          : num(item.statistics?.subscriberCount),
        hiddenSubs: item.statistics?.hiddenSubscriberCount === true,
        videoCount: num(item.statistics?.videoCount),
        avatarUrl: bestThumbnail(item.snippet?.thumbnails),
      });
    }
  }
  return out;
}

/**
 * Re-fetch featured comments by id. 1 unit per 50. This is the compliance call:
 * ids missing from the response have been deleted upstream, and the caller nulls
 * their stored text.
 */
export async function fetchCommentsById(ids: string[]): Promise<Map<string, CommentInput>> {
  const out = new Map<string, CommentInput>();
  for (const batch of chunk(ids, 50)) {
    const data = await call<{ items?: CommentItem[] }>("comments", {
      part: "snippet",
      id: batch.join(","),
      textFormat: "plainText",
      maxResults: "100",
    });
    await bumpCounter("yt_units", 1);

    for (const item of data.items ?? []) {
      const sn = item.snippet;
      if (!sn) continue;
      out.set(item.id, {
        id: item.id,
        text: sn.textOriginal ?? "",
        authorDisplay: sn.authorDisplayName ?? "",
        authorChannelId: sn.authorChannelId?.value ?? "",
        authorAvatarUrl: "",
        likeCount: sn.likeCount ?? 0,
        replyCount: 0,
        publishedAt: sn.publishedAt ?? "",
      });
    }
  }
  return out;
}

/** Accepts a watch URL, a youtu.be link, a Shorts URL, or a bare id. */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

function toPick(item: VideoItem): VideoPick {
  const sn = item.snippet;
  return {
    videoId: item.id,
    title: sn?.title ?? "",
    description: sn?.description ?? "",
    channelId: sn?.channelId ?? "",
    channelTitle: sn?.channelTitle ?? "",
    thumbnailUrl: bestThumbnail(sn?.thumbnails),
    durationS: parseIsoDuration(item.contentDetails?.duration),
    publishedAt: sn?.publishedAt ?? "",
    views: num(item.statistics?.viewCount),
    likes: num(item.statistics?.likeCount),
    // Absent commentCount means comments are disabled — NOT zero comments.
    // -1 keeps that distinction so the pick rules can reject rather than
    // silently treat a disabled section as an empty one.
    comments: item.statistics?.commentCount === undefined ? -1 : num(item.statistics.commentCount),
    liveBroadcastContent: sn?.liveBroadcastContent ?? "none",
    defaultAudioLanguage: sn?.defaultAudioLanguage ?? null,
    defaultLanguage: sn?.defaultLanguage ?? null,
  };
}

function toComment(item: ThreadItem): CommentInput | null {
  const top = item.snippet?.topLevelComment;
  const sn = top?.snippet;
  if (!top?.id || !sn) return null;
  return {
    id: top.id,
    text: sn.textOriginal ?? "",
    authorDisplay: sn.authorDisplayName ?? "",
    authorChannelId: sn.authorChannelId?.value ?? "",
    authorAvatarUrl: sn.authorProfileImageUrl ?? "",
    likeCount: sn.likeCount ?? 0,
    replyCount: item.snippet?.totalReplyCount ?? 0,
    publishedAt: sn.publishedAt ?? "",
  };
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
