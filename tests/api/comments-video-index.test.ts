/**
 * Tests for the video index (listAnalyzedVideos in lib/comments/store.ts).
 *
 * Why this file exists: this one query now backs three surfaces at once. It
 * fills /comments/videos, it puts the day's titles on every archive row, and it
 * supplies every video permalink in the sitemap. A regression here is not one
 * broken page, it is the whole back catalogue becoming unfindable and
 * uncrawlable at the same time, which is exactly the failure this index was
 * built to prevent.
 *
 * Two things in particular are worth locking. The query must stay NARROW,
 * because selecting whole rows would put a kilobyte of histogram into a list of
 * titles, five times a day forever. And the JSONB values have to survive
 * PostgREST, which returns a number for one arrow and a string for two.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listAnalyzedVideos } from "@/lib/comments/store";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stub(body: unknown, status = 200): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(body), { status });
    })
  );
  return calls;
}

const ROW = {
  video_id: "yLFRQaQT0qM",
  title: "Call of Duty: Modern Warfare 4 | Campaign Trailer",
  channel_title: "Call of Duty",
  first_edition: "2026-09-19",
  rank: 0,
  views: 64416295,
  analyzed: 1000,
};

describe("listAnalyzedVideos", () => {
  it("asks only for the columns a list of titles needs", async () => {
    const calls = stub([ROW]);
    await listAnalyzedVideos(10);

    const url = calls[0];
    expect(url).toContain("comment_videos");
    expect(url).toContain("status=eq.analyzed");
    // The heavy columns must never enter the payload.
    expect(url).toMatch(/select=[^&]*video_id/);
    expect(url).not.toMatch(/select=[^&]*analysis,/);
    expect(url).not.toMatch(/select=[^&]*gemini/);
    expect(url).not.toContain("select=*");
    // Newest edition first, and within a day the edition's own running order.
    expect(url).toContain("order=first_edition.desc,rank.asc");
    expect(url).toContain("limit=10");
  });

  it("returns numbers whether PostgREST sends numbers or strings", async () => {
    stub([ROW, { ...ROW, video_id: "b", views: "12345", analyzed: "900", rank: "3" }]);
    const rows = await listAnalyzedVideos();

    expect(rows[0].views).toBe(64416295);
    expect(rows[0].analyzed).toBe(1000);
    expect(rows[1].views).toBe(12345);
    expect(rows[1].analyzed).toBe(900);
    expect(rows[1].rank).toBe(3);
  });

  it("survives a row whose JSON paths are missing rather than dropping the video", async () => {
    // A skipped-then-analyzed video, or one stored before a field existed.
    stub([{ video_id: "x", title: "T", channel_title: "C", first_edition: "2026-09-19" }]);
    const rows = await listAnalyzedVideos();

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("T");
    expect(rows[0].views).toBeNull();
    expect(rows[0].analyzed).toBeNull();
    expect(rows[0].rank).toBeNull();
  });

  it("returns an empty list rather than throwing when Supabase is unreachable", async () => {
    stub({ message: "nope" }, 500);
    await expect(listAnalyzedVideos()).resolves.toEqual([]);
  });

  it("returns an empty list when Supabase is not configured at all", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    const calls = stub([ROW]);
    await expect(listAnalyzedVideos()).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
