/**
 * Tests for the analysis pass (lib/comments/analyze.ts).
 *
 * Why this file exists: analyzeVideo is the retention boundary of the whole
 * feature. A thousand comments go in; what comes out is the object that gets
 * written to comment_videos.analysis and kept indefinitely.
 *
 * The load-bearing test here is "leaks no comment text or author identity". The
 * 30-day YouTube retention rule is satisfied by keeping stored API data down to
 * six featured comments per video that the refresh step walks. If an author name
 * or a comment quote ever reaches the analysis blob, that data is stored outside
 * the refresh path and quietly ages past the limit with nothing to catch it.
 * That test is the thing standing between this design and that failure.
 */

import { describe, it, expect } from "vitest";
import { analyzeVideo, themesFrom, emojiLeaderboard, velocityBuckets } from "@/lib/comments/analyze";
import type { CommentInput, ChannelInfo } from "@/lib/comments/types";

const VIDEO = {
  videoId: "dQw4w9WgXcQ",
  title: "Orchestra Plays Live At Sunrise",
  publishedAt: "2026-09-10T00:00:00Z",
};

const PHRASES = [
  "the strings section absolutely carried this performance",
  "this was terrible and a complete waste of an hour",
  "camera work here is stunning, whoever shot this deserves credit",
  "boring, I turned it off after five minutes",
  "the camera work at sunrise made me emotional honestly",
  "genuinely one of the best live performances I have seen",
  "audio mixing is rough but the playing is excellent",
  "nobody: the conductor at 4:02: absolutely feral",
];

function fixture(count = 200): CommentInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `comment-id-${i}`,
    text: PHRASES[i % PHRASES.length],
    authorDisplay: `Person Number ${i}`,
    authorChannelId: `UCauthor${i}`,
    authorAvatarUrl: "",
    likeCount: i % 37,
    replyCount: 0,
    publishedAt: new Date(Date.parse(VIDEO.publishedAt) + i * 600_000).toISOString(),
  }));
}

const NO_CHANNELS = new Map<string, ChannelInfo>();

describe("analyzeVideo — the numbers the page prints", () => {
  const { analysis } = analyzeVideo(VIDEO, fixture(), NO_CHANNELS);

  it("counts every comment it was given", () => {
    expect(analysis.analyzed).toBe(200);
  });

  it("produces sentiment shares that sum to 1", () => {
    const sum = analysis.positiveShare + analysis.neutralShare + analysis.negativeShare;
    expect(sum).toBeCloseTo(1, 9);
  });

  it("produces a 10-bin histogram whose counts sum to the comment total", () => {
    expect(analysis.histogram).toHaveLength(10);
    expect(analysis.histogram.reduce((a, b) => a + b, 0)).toBe(200);
  });

  it("produces 24 velocity buckets", () => {
    expect(analysis.velocity).toHaveLength(24);
    expect(analysis.busiestHour).toBeGreaterThanOrEqual(0);
    expect(analysis.busiestHour).toBeLessThan(24);
  });

  it("computes an English ratio", () => {
    expect(analysis.englishRatio).toBeGreaterThan(0.5);
  });

  it("reports likes distribution for the underrated framing", () => {
    expect(analysis.maxLikes).toBeGreaterThanOrEqual(analysis.medianLikes);
  });

  it("handles an empty section without producing NaN", () => {
    const empty = analyzeVideo(VIDEO, [], NO_CHANNELS).analysis;
    expect(empty.analyzed).toBe(0);
    expect(Number.isNaN(empty.meanSentiment)).toBe(false);
    expect(empty.positiveShare).toBe(0);
  });
});

describe("analyzeVideo — THE RETENTION INVARIANT", () => {
  it("leaks no comment text, display name, or channel id into the stored analysis", () => {
    const comments = fixture();
    const { analysis } = analyzeVideo(VIDEO, comments, NO_CHANNELS);
    const serialized = JSON.stringify(analysis);

    for (const c of comments) {
      expect(serialized).not.toContain(c.text);
      expect(serialized).not.toContain(c.authorDisplay);
      expect(serialized).not.toContain(c.authorChannelId);
      expect(serialized).not.toContain(c.id);
    }
  });

  it("stores no per-comment automation score", () => {
    const { analysis } = analyzeVideo(VIDEO, fixture(), NO_CHANNELS);
    // Only the aggregate survives. Anything shaped like a per-comment list of
    // scores would mean identity could be re-joined to accusation later.
    expect(analysis.automation).toHaveProperty("shareLikely");
    expect(analysis.automation).not.toHaveProperty("scores");
    expect(analysis.automation).not.toHaveProperty("comments");
  });
});

describe("analyzeVideo — shortlists handed to Gemini", () => {
  it("returns both lists, bounded", () => {
    const { top, candidates } = analyzeVideo(VIDEO, fixture(), NO_CHANNELS);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(30);
    expect(candidates.length).toBeLessThanOrEqual(25);
  });
});

describe("themesFrom", () => {
  it("excludes stopwords", () => {
    const themes = themesFrom(fixture());
    expect(themes).not.toContain("this");
    expect(themes).not.toContain("the");
    expect(themes).not.toContain("was");
  });

  it("excludes words already in the title, which would tell the reader nothing", () => {
    const themes = themesFrom(fixture(), VIDEO.title);
    expect(themes).not.toContain("orchestra");
    expect(themes).not.toContain("sunrise");
  });

  it("surfaces what the section is actually discussing", () => {
    const themes = themesFrom(fixture());
    expect(themes.join(" ")).toMatch(/camera|performance|work/);
  });

  it("returns an empty list for an empty section", () => {
    expect(themesFrom([])).toEqual([]);
  });
});

describe("emojiLeaderboard", () => {
  it("ranks by frequency", () => {
    const result = emojiLeaderboard([
      { text: "🔥🔥🔥" },
      { text: "🔥 nice" },
      { text: "😭" },
    ]);
    expect(result[0].char).toBe("🔥");
    expect(result[0].count).toBe(4);
  });
});

describe("velocityBuckets", () => {
  it("places comments in the hour they were posted", () => {
    const buckets = velocityBuckets(
      [
        { publishedAt: "2026-09-10T00:30:00Z" },
        { publishedAt: "2026-09-10T01:10:00Z" },
        { publishedAt: "2026-09-10T01:50:00Z" },
      ],
      VIDEO.publishedAt
    );
    expect(buckets[0]).toBe(1);
    expect(buckets[1]).toBe(2);
  });

  it("collapses anything past 24 hours into the final bucket", () => {
    const buckets = velocityBuckets([{ publishedAt: "2026-09-20T00:00:00Z" }], VIDEO.publishedAt);
    expect(buckets[23]).toBe(1);
  });

  it("returns zeros rather than throwing on an unparseable date", () => {
    expect(velocityBuckets([{ publishedAt: "nonsense" }], "also nonsense")).toHaveLength(24);
  });
});
