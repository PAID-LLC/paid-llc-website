/**
 * Tests for the pooled candidate feed and its ranking
 * (fetchCandidatePool in lib/comments/youtube.ts, the pick rules in edition.ts).
 *
 * Why this file exists: until 2026-09-19 the edition read one chart, which since
 * YouTube's July 2025 change carries only its Music, Movies and Gaming charts,
 * while the page promised "the most-watched videos in the United States". The
 * pool fixes the feed; these tests lock the three things that make the new claim
 * ("fastest-rising", ranked by views per hour) true:
 *
 *   1. Every category chart and both searches are read, and a single retired
 *      chart or failed search never costs the edition.
 *   2. The ranking is views per hour since upload, not lifetime views.
 *   3. The noise a wider pool lets in (Shorts, foreign-language uploads with no
 *      language metadata, stale videos, one channel filling the page) is filtered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCandidatePool, POOL_CATEGORIES, YouTubeError } from "@/lib/comments/youtube";
import { rejectReason, rankByVelocity, viewsPerHour, choosePicks } from "@/lib/comments/edition";
import type { VideoPick } from "@/lib/comments/types";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-yt-key";
  // No Supabase: counters and the history lookup fail open, so nothing leaves the test.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function apiError(status: number, reason: string) {
  return new Response(JSON.stringify({ error: { errors: [{ reason }], message: reason } }), { status });
}

function item(id: string) {
  return {
    id,
    snippet: {
      title: `Video ${id}`,
      channelId: `UC${id}`,
      channelTitle: `Channel ${id}`,
      publishedAt: "2026-09-18T12:00:00Z",
      liveBroadcastContent: "none",
    },
    statistics: { viewCount: "1000", likeCount: "10", commentCount: "500" },
    contentDetails: { duration: "PT10M" },
  };
}

function stubFetch(handler: (url: string) => Response): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return handler(url);
    })
  );
  return calls;
}

/** Charts answer per category; searches return ids; id lookups hydrate them. */
function poolHandler(overrides: (url: string) => Response | null = () => null) {
  return (url: string): Response => {
    const custom = overrides(url);
    if (custom) return custom;
    if (url.includes("/search?")) {
      return ok({ items: [{ id: { videoId: "s1" } }, { id: { videoId: "shared" } }] });
    }
    if (url.includes("chart=mostPopular")) {
      const category = (url.match(/videoCategoryId=(\d+)/) ?? [])[1] ?? "default";
      return ok({ items: [item(`c-${category}`), item("shared")] });
    }
    const ids = decodeURIComponent((url.match(/[?&]id=([^&]+)/) ?? [])[1] ?? "").split(",");
    return ok({ items: ids.filter(Boolean).map(item) });
  };
}

describe("fetchCandidatePool — the feed", () => {
  it("reads the default chart, every category chart, and both searches, without duplicates", async () => {
    const calls = stubFetch(poolHandler());
    const pool = await fetchCandidatePool("US");
    const ids = pool.videos.map((v) => v.videoId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("c-default");
    // News: exactly what the plain chart stopped carrying in July 2025.
    expect(ids).toContain("c-25");
    expect(ids).toContain("s1");
    expect(calls.filter((u) => u.includes("chart=mostPopular"))).toHaveLength(1 + POOL_CATEGORIES.length);

    const searches = calls.filter((u) => u.includes("/search?"));
    expect(searches).toHaveLength(2);
    for (const u of searches) {
      expect(u).toContain("order=viewCount");
      // Without a query term search returns nothing at all (measured 2026-09-19).
      expect(u).toMatch(/[?&]q=/);
    }
  });

  it("survives a retired category chart and a failed search", async () => {
    stubFetch(
      poolHandler((url) => {
        if (url.includes("videoCategoryId=25")) return apiError(404, "notFound");
        if (url.includes("/search?")) return apiError(403, "forbidden");
        return null;
      })
    );
    const pool = await fetchCandidatePool("US");
    expect(pool.videos.map((v) => v.videoId)).toContain("c-default");
    expect(pool.sources["chart:25"]).toBe(0);
    expect(pool.sources["search:24h"]).toBe(0);
  });

  it("gives up only when the charts themselves are out of quota", async () => {
    stubFetch(() => apiError(403, "quotaExceeded"));
    await expect(fetchCandidatePool("US")).rejects.toBeInstanceOf(YouTubeError);
  });
});

// ── Ranking and filtering ────────────────────────────────────────────────────

const NOW = Date.parse("2026-09-19T12:00:00Z");
const DAY_AGO = "2026-09-18T12:00:00Z";
const NONE = new Map<string, { status: string; created_at: string }>();

function pick(over: Partial<VideoPick> = {}): VideoPick {
  return {
    videoId: "vid",
    title: "A Rising Video",
    description: "",
    channelId: "UCchannel",
    channelTitle: "Some Channel",
    thumbnailUrl: "",
    durationS: 600,
    publishedAt: DAY_AGO,
    views: 1_000_000,
    likes: 10_000,
    comments: 2_000,
    liveBroadcastContent: "none",
    defaultAudioLanguage: "en",
    defaultLanguage: null,
    ...over,
  };
}

describe("the ranking — views per hour since upload", () => {
  it("puts a fast riser ahead of a bigger but older video", () => {
    // 60M over 48h is 1.25M/hr; 20M over 10h is 2M/hr.
    const big = pick({ videoId: "big", views: 60_000_000, publishedAt: "2026-09-17T12:00:00Z" });
    const fast = pick({ videoId: "fast", views: 20_000_000, publishedAt: "2026-09-19T02:00:00Z" });
    expect(rankByVelocity([big, fast], NOW).map((v) => v.videoId)).toEqual(["fast", "big"]);
  });

  it("ranks a video with no upload time last instead of dividing by nothing", () => {
    expect(viewsPerHour(pick({ publishedAt: "" }), NOW)).toBe(0);
  });
});

describe("rejectReason — the noise a wider pool lets in", () => {
  it("rejects Shorts by tag, since Shorts now run to three minutes", () => {
    expect(rejectReason(pick({ title: "Wait for it #shorts", durationS: 150 }), NONE, NOW)).toBe("short");
  });

  it("rejects uploads too new to have mature comments, and anything past three days", () => {
    expect(rejectReason(pick({ publishedAt: "2026-09-19T08:00:00Z" }), NONE, NOW)).toBe("too_new");
    expect(rejectReason(pick({ publishedAt: "2026-09-15T12:00:00Z" }), NONE, NOW)).toBe("too_old");
  });

  it("catches non-English uploads whose language metadata is unset", () => {
    const unset = { defaultAudioLanguage: null, defaultLanguage: null };
    // Both of these were in the real pool on 2026-09-19.
    expect(rejectReason(pick({ ...unset, title: "Nashtar Episode 09 [Eng Sub] Digitally Presented" }), NONE, NOW)).toBe("not_english");
    expect(rejectReason(pick({ ...unset, title: "អាបឺតនេះ រឿង" }), NONE, NOW)).toBe("not_english");
  });

  it("does not mistake accented English titles for another language", () => {
    const unset = { defaultAudioLanguage: null, defaultLanguage: null };
    expect(rejectReason(pick({ ...unset, title: "ROSÉ - new trick (OFFICIAL MUSIC VIDEO)" }), NONE, NOW)).toBeNull();
  });
});

describe("choosePicks — the five", () => {
  it("keeps one video per channel, fastest first, and counts why the rest lost", async () => {
    const pool = [
      pick({ videoId: "a1", channelId: "UCa", views: 9_000_000 }),
      pick({ videoId: "a2", channelId: "UCa", views: 8_000_000 }),
      pick({ videoId: "s", channelId: "UCs", views: 7_000_000, title: "clip #shorts" }),
      pick({ videoId: "b", channelId: "UCb", views: 1_000_000 }),
    ];
    const { picked, rejectedCounts, rejected } = await choosePicks(pool, NOW);
    expect(picked.map((v) => v.videoId)).toEqual(["a1", "b"]);
    expect(rejectedCounts).toEqual({ same_channel: 1, short: 1 });
    expect(rejected.map((r) => r.id)).toEqual(["a2", "s"]);
  });

  it("stops at five", async () => {
    const pool = Array.from({ length: 9 }, (_, i) =>
      pick({ videoId: `v${i}`, channelId: `UC${i}`, views: (10 - i) * 1_000_000 })
    );
    const { picked } = await choosePicks(pool, NOW);
    expect(picked.map((v) => v.videoId)).toEqual(["v0", "v1", "v2", "v3", "v4"]);
  });
});
