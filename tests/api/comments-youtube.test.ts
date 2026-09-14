/**
 * Tests for the YouTube Data API client (lib/comments/youtube.ts).
 *
 * Why this file exists: quota is the binding constraint on this feature (10,000
 * units a day, not toppable up without a written compliance audit), and nothing
 * about spending it is visible at runtime until it is gone. These tests pin the
 * two things that would burn it silently: paginating past the end of a comment
 * section, and batching ids in anything other than 50s.
 *
 * The commentsDisabled mapping matters for a different reason. That 403 is the
 * single most common reason a trending video cannot be used, and it has to
 * arrive as a typed "skip this one" rather than a generic failure, or the step
 * machine cannot tell it apart from an outage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCommentThreads,
  fetchChannels,
  fetchMostPopular,
  fetchCommentsById,
  parseVideoId,
  parseIsoDuration,
  bestThumbnail,
  YouTubeError,
} from "@/lib/comments/youtube";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-yt-key";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function apiError(status: number, reason: string) {
  return new Response(JSON.stringify({ error: { errors: [{ reason }], message: reason } }), { status });
}

function thread(id: string, likeCount = 0) {
  return {
    snippet: {
      topLevelComment: {
        id,
        snippet: {
          textOriginal: `comment ${id}`,
          authorDisplayName: `Author ${id}`,
          authorChannelId: { value: `UC${id}` },
          likeCount,
          publishedAt: "2026-09-12T00:00:00Z",
        },
      },
      totalReplyCount: 0,
    },
  };
}

/** Captures every non-Supabase request so quota accounting can be asserted. */
function stubFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("supabase")) return new Response("true", { status: 200 });
      calls.push(url);
      return handler(url);
    })
  );
  return calls;
}

describe("fetchCommentThreads — pagination", () => {
  it("stops as soon as a page returns no nextPageToken", () => {
    const calls = stubFetch(() => ok({ items: [thread("a")] })); // no token
    return fetchCommentThreads("vid123", 10).then((out) => {
      expect(calls).toHaveLength(1);
      expect(out).toHaveLength(1);
    });
  });

  it("stops at maxPages even when more pages exist", async () => {
    const calls = stubFetch((url) => {
      const page = (url.match(/pageToken=(\d+)/) ?? [])[1] ?? "0";
      return ok({ items: [thread(`c${page}`)], nextPageToken: String(Number(page) + 1) });
    });
    await fetchCommentThreads("vid123", 3);
    expect(calls).toHaveLength(3);
  });

  it("requests plain text, not HTML, so nothing needs sanitizing downstream", async () => {
    const calls = stubFetch(() => ok({ items: [] }));
    await fetchCommentThreads("vid123", 1);
    expect(calls[0]).toContain("textFormat=plainText");
  });

  it("deduplicates ids repeated across pages", async () => {
    let page = 0;
    stubFetch(() => {
      page++;
      return ok({ items: [thread("same")], nextPageToken: page < 3 ? "next" : undefined });
    });
    const out = await fetchCommentThreads("vid123", 3);
    expect(out).toHaveLength(1);
  });
});

describe("fetchCommentThreads — errors that mean different things", () => {
  it("maps commentsDisabled to a typed skip reason", async () => {
    stubFetch(() => apiError(403, "commentsDisabled"));
    await expect(fetchCommentThreads("vid123")).rejects.toMatchObject({ kind: "comments_disabled" });
  });

  it("maps quotaExceeded to its own kind, so it is never retried as a blip", async () => {
    stubFetch(() => apiError(403, "quotaExceeded"));
    await expect(fetchCommentThreads("vid123")).rejects.toMatchObject({ kind: "quota_exceeded" });
  });

  it("throws no_key rather than calling out without one", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const calls = stubFetch(() => ok({}));
    await expect(fetchCommentThreads("vid123")).rejects.toBeInstanceOf(YouTubeError);
    expect(calls).toHaveLength(0);
  });
});

describe("fetchChannels — batching is the quota story", () => {
  it("sends exactly one request per 50 ids", async () => {
    const ids = Array.from({ length: 900 }, (_, i) => `UC${i}`);
    const calls = stubFetch(() => ok({ items: [] }));
    await fetchChannels(ids);
    expect(calls).toHaveLength(18); // 900 / 50
  });

  it("deduplicates ids before batching", async () => {
    const calls = stubFetch(() => ok({ items: [] }));
    await fetchChannels(Array.from({ length: 200 }, () => "UCsame"));
    expect(calls).toHaveLength(1);
  });

  it("skips the call entirely when there is nothing to look up", async () => {
    const calls = stubFetch(() => ok({ items: [] }));
    await fetchChannels([]);
    expect(calls).toHaveLength(0);
  });

  it("reads hidden subscriber counts as unknown rather than zero", async () => {
    stubFetch(() =>
      ok({
        items: [
          {
            id: "UChidden",
            snippet: { title: "X", publishedAt: "2020-01-01T00:00:00Z", thumbnails: {} },
            statistics: { hiddenSubscriberCount: true, videoCount: "3" },
          },
        ],
      })
    );
    const map = await fetchChannels(["UChidden"]);
    expect(map.get("UChidden")?.subscriberCount).toBeNull();
    expect(map.get("UChidden")?.hiddenSubs).toBe(true);
  });
});

describe("fetchMostPopular — the disabled-vs-empty distinction", () => {
  it("reports a missing commentCount as -1, not as zero comments", async () => {
    // An absent statistics.commentCount is how the API signals that comments are
    // off. Reading it as 0 would let a disabled video through the pick rules as
    // merely unpopular, and the video step would then fail on it.
    stubFetch(() =>
      ok({
        items: [
          {
            id: "vidoff",
            snippet: { title: "T", channelId: "UC", channelTitle: "C", publishedAt: "2026-09-13T00:00:00Z", thumbnails: {} },
            statistics: { viewCount: "1000" },
            contentDetails: { duration: "PT10M" },
          },
        ],
      })
    );
    const [pick] = await fetchMostPopular("US", 5);
    expect(pick.comments).toBe(-1);
  });
});

describe("fetchCommentsById — the retention read path", () => {
  it("omits ids that no longer exist, which is how deletions are detected", async () => {
    stubFetch(() =>
      ok({
        items: [
          { id: "alive", snippet: { textOriginal: "still here", authorDisplayName: "A", likeCount: 3, publishedAt: "2026-08-01T00:00:00Z" } },
        ],
      })
    );
    const map = await fetchCommentsById(["alive", "deleted"]);
    expect(map.has("alive")).toBe(true);
    expect(map.has("deleted")).toBe(false);
  });
});

describe("parseVideoId", () => {
  it("accepts the forms a person might paste", () => {
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects anything else", () => {
    expect(parseVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoId("not a url")).toBeNull();
    expect(parseVideoId("")).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  it("parses the shapes YouTube returns", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
  });

  it("returns 0 for missing or unparseable input", () => {
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration("garbage")).toBe(0);
  });
});

describe("bestThumbnail", () => {
  it("prefers the largest available", () => {
    expect(bestThumbnail({ default: { url: "d" }, maxres: { url: "m" } })).toBe("m");
    expect(bestThumbnail({ default: { url: "d" }, high: { url: "h" } })).toBe("h");
  });

  it("returns an empty string when there is nothing", () => {
    expect(bestThumbnail(undefined)).toBe("");
  });
});
