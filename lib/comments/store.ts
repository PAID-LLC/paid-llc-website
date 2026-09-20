// ── Persistence ──────────────────────────────────────────────────────────────
// PostgREST over fetch with the service key, matching every other data module in
// this repo (there is no supabase-js here, deliberately: it does not belong in an
// edge bundle that is already near its size cap).
//
// Nothing in this file throws. Reads return null or an empty array, writes return
// a boolean. Callers decide what a failure means; a page that cannot reach
// Supabase renders its empty state rather than a 500.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import type { EditionRow, VideoRow, FeaturedRow, EditionBundle, VideoIndexRow } from "./types";

/** The tables exist and Supabase is configured. */
export async function commentsReady(): Promise<boolean> {
  if (!supabaseReady()) return false;
  try {
    const res = await fetch(sbUrl("comment_editions?select=edition_date&limit=1"), {
      headers: sbHeaders(),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T[]> {
  if (!supabaseReady()) return [];
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

export async function getEdition(date: string): Promise<EditionRow | null> {
  const rows = await get<EditionRow>(
    `comment_editions?edition_date=eq.${encodeURIComponent(date)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getLatestPublishedEdition(): Promise<EditionRow | null> {
  const rows = await get<EditionRow>(
    "comment_editions?status=eq.published&order=edition_date.desc&limit=1"
  );
  return rows[0] ?? null;
}

export async function listEditions(limit = 14): Promise<EditionRow[]> {
  return get<EditionRow>(
    `comment_editions?status=eq.published&select=edition_date,edition_no,headline,stats&order=edition_date.desc&limit=${limit}`
  );
}

export async function getVideosForEdition(date: string): Promise<VideoRow[]> {
  return get<VideoRow>(
    `comment_videos?first_edition=eq.${encodeURIComponent(date)}&order=rank.asc`
  );
}

/**
 * Every analyzed video, newest edition first, as narrow rows.
 *
 * Backs /comments/videos, the video titles on the archive, and the permalink
 * list in the sitemap. One query for all three, because the alternative each of
 * them would otherwise reach for is a request per edition, and the point of the
 * index is that it stays cheap as the archive grows.
 *
 * `views` and `analyzed` come out of JSONB by path so the heavy columns
 * (`analysis`, `gemini`) never enter the payload. PostgREST returns a JSON
 * number for `->` and a string for `->>`; both are coerced here so callers get
 * a number or null and never a surprise string.
 */
export async function listAnalyzedVideos(limit = 1000): Promise<VideoIndexRow[]> {
  const rows = await get<Record<string, unknown>>(
    "comment_videos?status=eq.analyzed" +
      "&select=video_id,title,channel_title,first_edition,rank,views:stats->views,analyzed:analysis->analyzed" +
      `&order=first_edition.desc,rank.asc&limit=${limit}`
  );

  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  return rows.map((r) => ({
    video_id: String(r.video_id ?? ""),
    title: String(r.title ?? ""),
    channel_title: String(r.channel_title ?? ""),
    first_edition: String(r.first_edition ?? ""),
    rank: num(r.rank),
    views: num(r.views),
    analyzed: num(r.analyzed),
  }));
}

export async function getVideo(videoId: string): Promise<VideoRow | null> {
  const rows = await get<VideoRow>(
    `comment_videos?video_id=eq.${encodeURIComponent(videoId)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getFeaturedForVideos(videoIds: string[]): Promise<FeaturedRow[]> {
  if (videoIds.length === 0) return [];
  const list = videoIds.map((id) => `"${id}"`).join(",");
  return get<FeaturedRow>(
    `comment_featured?video_id=in.(${encodeURIComponent(list)})&order=role.asc,position.asc`
  );
}

/** Which of these ids have been analyzed before, and when they were created. */
export async function getExistingVideoRows(
  ids: string[]
): Promise<Map<string, { status: string; created_at: string }>> {
  if (ids.length === 0) return new Map();
  const list = ids.map((id) => `"${id}"`).join(",");
  const rows = await get<{ video_id: string; status: string; created_at: string }>(
    `comment_videos?video_id=in.(${encodeURIComponent(list)})&select=video_id,status,created_at`
  );
  return new Map(rows.map((r) => [r.video_id, { status: r.status, created_at: r.created_at }]));
}

/**
 * One edition with everything needed to render it. Pass "latest" for the current
 * front page. Three round trips, which is why pages wrap this in React cache().
 */
export async function getEditionBundle(dateOrLatest: string): Promise<EditionBundle | null> {
  const edition =
    dateOrLatest === "latest"
      ? await getLatestPublishedEdition()
      : await getEdition(dateOrLatest);

  if (!edition || edition.status !== "published") return null;

  const videos = await getVideosForEdition(edition.edition_date);
  const featured = await getFeaturedForVideos(videos.map((v) => v.video_id));
  return { edition, videos, featured };
}

/** A single video plus its featured comments, for the permalink page. */
export async function getVideoBundle(
  videoId: string
): Promise<{ video: VideoRow; featured: FeaturedRow[] } | null> {
  const video = await getVideo(videoId);
  if (!video || video.status !== "analyzed") return null;
  return { video, featured: await getFeaturedForVideos([videoId]) };
}

// ── Writes ───────────────────────────────────────────────────────────────────

async function write(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  prefer?: string
): Promise<boolean> {
  if (!supabaseReady()) return false;
  try {
    const res = await fetch(sbUrl(path), {
      method,
      headers: prefer ? { ...sbHeaders(), Prefer: prefer } : sbHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[comments][store]", method, path, res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[comments][store]", method, path, err);
    return false;
  }
}

export async function upsertEdition(row: Partial<EditionRow>): Promise<boolean> {
  return write(
    "comment_editions?on_conflict=edition_date",
    "POST",
    row,
    "resolution=merge-duplicates,return=minimal"
  );
}

export async function patchEdition(date: string, patch: Partial<EditionRow>): Promise<boolean> {
  return write(
    `comment_editions?edition_date=eq.${encodeURIComponent(date)}`,
    "PATCH",
    patch
  );
}

export async function upsertVideos(rows: Partial<VideoRow>[]): Promise<boolean> {
  if (rows.length === 0) return true;
  return write(
    "comment_videos?on_conflict=video_id",
    "POST",
    rows,
    "resolution=merge-duplicates,return=minimal"
  );
}

export async function patchVideo(videoId: string, patch: Partial<VideoRow>): Promise<boolean> {
  return write(`comment_videos?video_id=eq.${encodeURIComponent(videoId)}`, "PATCH", {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Claims the next video to process, or returns null when there is nothing to do.
 *
 * This is the only conditional write in the feature and it is what makes the
 * video step safe to retry. Two calls, because PostgREST cannot express
 * "update the first matching row" atomically:
 *
 *   1. read the lowest-rank candidate: pending, or processing and stale
 *   2. PATCH it to processing, filtered on the status we just observed
 *
 * Step 2 returns zero rows if anything changed in between, which means another
 * request won the claim, and the caller simply asks again. The ten-minute
 * staleness window is what recovers a request that died mid-run: without it, one
 * crashed video would wedge the edition until somebody noticed.
 */
export async function claimNextVideo(
  date: string,
  staleMs = 10 * 60 * 1000
): Promise<VideoRow | null> {
  if (!supabaseReady()) return null;

  const candidates = await get<VideoRow>(
    `comment_videos?first_edition=eq.${encodeURIComponent(date)}` +
      `&status=in.("pending","processing")&order=rank.asc&limit=5`
  );

  const cutoff = Date.now() - staleMs;
  const claimable = candidates.find(
    (v) =>
      v.status === "pending" ||
      (v.status === "processing" && Date.parse(v.updated_at ?? "") < cutoff)
  );
  if (!claimable) return null;

  try {
    const res = await fetch(
      sbUrl(
        `comment_videos?video_id=eq.${encodeURIComponent(claimable.video_id)}` +
          `&status=eq.${claimable.status}`
      ),
      {
        method: "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({ status: "processing", updated_at: new Date().toISOString() }),
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as VideoRow[];
    return rows[0] ?? null; // zero rows: someone else claimed it first
  } catch {
    return null;
  }
}

/** Replaces a video's featured comments. Delete-then-insert keeps reruns clean. */
export async function replaceFeatured(videoId: string, rows: Partial<FeaturedRow>[]): Promise<boolean> {
  if (!supabaseReady()) return false;
  try {
    await fetch(sbUrl(`comment_featured?video_id=eq.${encodeURIComponent(videoId)}`), {
      method: "DELETE",
      headers: sbHeaders(),
    });
  } catch {
    return false;
  }
  if (rows.length === 0) return true;
  return write("comment_featured?on_conflict=comment_id", "POST", rows, "resolution=merge-duplicates,return=minimal");
}

export async function patchFeatured(commentId: string, patch: Partial<FeaturedRow>): Promise<boolean> {
  return write(`comment_featured?comment_id=eq.${encodeURIComponent(commentId)}`, "PATCH", patch);
}

// ── The retention read paths ─────────────────────────────────────────────────
// Both of these back the daily refresh step. If they stop returning rows that
// are actually due, stored YouTube data silently ages past 30 days.

export async function listFeaturedDue(beforeIso: string, limit = 200): Promise<FeaturedRow[]> {
  return get<FeaturedRow>(
    `comment_featured?removed_at=is.null&refreshed_at=lt.${encodeURIComponent(beforeIso)}` +
      `&select=comment_id,video_id&order=refreshed_at.asc&limit=${limit}`
  );
}

export async function listVideosDue(beforeIso: string, limit = 200): Promise<VideoRow[]> {
  return get<VideoRow>(
    `comment_videos?status=eq.analyzed&refreshed_at=lt.${encodeURIComponent(beforeIso)}` +
      `&select=video_id,stats&order=refreshed_at.asc&limit=${limit}`
  );
}

/** Count of published editions, for the issue number. */
export async function countPublishedEditions(): Promise<number> {
  if (!supabaseReady()) return 0;
  try {
    const res = await fetch(sbUrl("comment_editions?status=eq.published&select=edition_date"), {
      headers: { ...sbHeaders(), Prefer: "count=exact", Range: "0-0" },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    // PostgREST reports the total in Content-Range as "0-0/N".
    const total = res.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : 0;
  } catch {
    return 0;
  }
}
