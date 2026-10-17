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
 *   2. The ranking is velocity since upload (views and comments), not lifetime totals.
 *   3. The noise a wider pool lets in (Shorts, foreign-language uploads with no
 *      language metadata, stale videos, one channel filling the page) is filtered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCandidatePool, POOL_CATEGORIES, YouTubeError } from "@/lib/comments/youtube";
import {
  rejectReason,
  rankByVelocity,
  rankScore,
  viewsPerHour,
  choosePicks,
  nearDuplicateTitle,
} from "@/lib/comments/edition";
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
    expect(rankScore(pick({ publishedAt: "" }), NOW)).toBe(0);
  });

  it("puts a slower video with a live comment section ahead of a view-bomb with a thin one", () => {
    // Same age, so this is the comment-velocity term and not the age penalty.
    // 8M views / 500 comments versus 3M views / 8,000 comments, both 24h old.
    const quiet = pick({ videoId: "quiet", views: 8_000_000, comments: 500 });
    const chatty = pick({ videoId: "chatty", views: 3_000_000, comments: 8_000 });
    expect(rankByVelocity([quiet, chatty], NOW).map((v) => v.videoId)).toEqual(["chatty", "quiet"]);
  });

  it("penalizes a front-loaded video once it is past a day and a half", () => {
    const fresh = pick({
      videoId: "fresh",
      views: 1_200_000,
      comments: 1_200,
      publishedAt: "2026-09-19T00:00:00Z",
    });
    const stale = pick({
      videoId: "stale",
      views: 6_000_000,
      comments: 6_000,
      publishedAt: "2026-09-17T00:00:00Z",
    });
    // Identical views/hour and comments/hour. The 60-hour upload sorts second.
    expect(rankScore(stale, NOW)).toBeLessThan(rankScore(fresh, NOW));
    expect(rankByVelocity([stale, fresh], NOW).map((v) => v.videoId)).toEqual(["fresh", "stale"]);
  });
});

describe("rejectReason — the noise a wider pool lets in", () => {
  it("rejects Shorts by tag, since Shorts now run to three minutes", () => {
    expect(rejectReason(pick({ title: "Wait for it #shorts", durationS: 150 }), NONE, NOW)).toBe("short");
  });

  it("rejects a title made only of hashtags, but not a one-word title", () => {
    // Regression, first pooled run 2026-09-19: "#hoyoverse" over a reposted movie montage.
    expect(rejectReason(pick({ title: "#hoyoverse" }), NONE, NOW)).toBe("hashtag_title");
    expect(rejectReason(pick({ title: "#aesthetic #foryou 🔥" }), NONE, NOW)).toBe("hashtag_title");
    expect(rejectReason(pick({ title: "Wolverine" }), NONE, NOW)).toBeNull();
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

  it("rejects the dead id called out on the thumbnail note, and videos YouTube says are not watchable", () => {
    expect(rejectReason(pick({ videoId: "BFc2W5OF3BM" }), NONE, NOW)).toBe("unavailable");
    expect(rejectReason(pick({ privacyStatus: "private" }), NONE, NOW)).toBe("unavailable");
    expect(rejectReason(pick({ uploadStatus: "deleted" }), NONE, NOW)).toBe("unavailable");
    expect(rejectReason(pick({ regionBlocked: true }), NONE, NOW)).toBe("unavailable");
  });

  it("rejects a huge view count with too few comments to be a column", () => {
    // Narnia trailer, 2026-10-14: 12M views, about 300 comments.
    expect(rejectReason(pick({ views: 12_000_000, comments: 300 }), NONE, NOW)).toBe("too_few_comments");
    // Clears the count, still quieter than one comment per 20,000 views.
    expect(rejectReason(pick({ views: 20_000_000, comments: 500 }), NONE, NOW)).toBe("thin_discussion");
  });

  it("rejects a subtitled upload whose title is Latin script, and a description in another script", () => {
    // Edition of 2026-10-16, ranked second. The old "[Eng Sub]" rule did not match "(Sub)".
    expect(
      rejectReason(pick({ title: "Mitti De Baway Ep 08 (Sub) 15 Oct 26 | Green TV" }), NONE, NOW)
    ).toBe("not_english");
    expect(rejectReason(pick({ title: "Nashtar Episode 09 Digitally Presented" }), NONE, NOW)).toBe("not_english");
    expect(rejectReason(pick({ title: "A Punjabi hit", description: "ਇ".repeat(80) }), NONE, NOW)).toBe("not_english");
  });

  it("rejects #sportsshorts and a short clip with a small section, and keeps a short trailer with a real one", () => {
    expect(
      rejectReason(
        pick({ title: "Hitting balls #sportsshorts", durationS: 600, comments: 5_000, views: 4_000_000 }),
        NONE,
        NOW
      )
    ).toBe("short");
    expect(rejectReason(pick({ durationS: 90, comments: 500, views: 2_000_000 }), NONE, NOW)).toBe("short");
    // GTA VI launch trailer shape: 91 seconds, a full comment section.
    expect(rejectReason(pick({ durationS: 91, comments: 20_000, views: 26_000_000 }), NONE, NOW)).toBeNull();
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

  it("stops at five and holds two backups", async () => {
    const pool = Array.from({ length: 9 }, (_, i) =>
      pick({ videoId: `v${i}`, channelId: `UC${i}`, views: (10 - i) * 1_000_000 })
    );
    const { picked, reserves, relaxed } = await choosePicks(pool, NOW, []);
    expect(picked.map((v) => v.videoId)).toEqual(["v0", "v1", "v2", "v3", "v4"]);
    expect(reserves.map((v) => v.videoId)).toEqual(["v5", "v6"]);
    expect(relaxed).toBe(false);
  });

  it("keeps a channel that already ran this week out of the five", async () => {
    // Enough other videos to fill the edition, so the cooldown is not relaxed.
    const pool = [
      pick({ videoId: "again", channelId: "UCa", views: 9_000_000 }),
      ...Array.from({ length: 5 }, (_, i) =>
        pick({ videoId: `o${i}`, channelId: `UCo${i}`, views: (5 - i) * 1_000_000 })
      ),
    ];
    const { picked, rejectedCounts, relaxed } = await choosePicks(pool, NOW, [
      { channel_id: "UCa", title: "Yesterday's completely different video" },
    ]);
    expect(picked.map((v) => v.videoId)).toEqual(["o0", "o1", "o2", "o3", "o4"]);
    expect(rejectedCounts.recent_channel).toBe(1);
    expect(relaxed).toBe(false);
  });

  it("takes at most two videos from one category, then relaxes if the edition would be short", async () => {
    const pool = [
      pick({ videoId: "s1", channelId: "UCs1", categoryId: "17", views: 9_000_000 }),
      pick({ videoId: "s2", channelId: "UCs2", categoryId: "17", views: 8_000_000 }),
      pick({ videoId: "n1", channelId: "UCn1", categoryId: "25", views: 7_000_000 }),
      pick({ videoId: "g1", channelId: "UCg1", categoryId: "20", views: 6_000_000 }),
      pick({ videoId: "c1", channelId: "UCc1", categoryId: "23", views: 5_000_000 }),
      pick({ videoId: "s3", channelId: "UCs3", categoryId: "17", views: 4_000_000 }),
    ];
    const { picked } = await choosePicks(pool, NOW, []);
    expect(picked.map((v) => v.videoId)).toEqual(["s1", "s2", "n1", "g1", "c1"]);

    const sportsOnly = Array.from({ length: 4 }, (_, i) =>
      pick({ videoId: `s${i}`, channelId: `UCs${i}`, categoryId: "17", views: (8 - i) * 1_000_000 })
    );
    const relaxed = await choosePicks(sportsOnly, NOW, []);
    expect(relaxed.relaxed).toBe(true);
    expect(relaxed.picked.map((v) => v.videoId)).toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("drops a near-duplicate title inside the edition and against a recent one", async () => {
    expect(
      nearDuplicateTitle("BRAVES vs. DODGERS: NLDS Full Game 2 Highlights", [
        "DODGERS vs. BRAVES: NLDS Full Game 3 Highlights",
      ])
    ).toBe(true);
    const pool = [
      pick({ videoId: "a", channelId: "UCa", title: "Eat Everything In A Grocery Store Challenge", views: 9_000_000 }),
      pick({ videoId: "b", channelId: "UCb", title: "Eat Everything In A Grocery Store Rematch", views: 8_000_000 }),
      pick({ videoId: "c", channelId: "UCc", title: "A completely different subject today", views: 1_000_000 }),
    ];
    const { picked, rejectedCounts } = await choosePicks(pool, NOW, []);
    expect(picked.map((v) => v.videoId)).toEqual(["a", "c"]);
    expect(rejectedCounts.near_duplicate).toBe(1);
  });
});
