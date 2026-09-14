/**
 * Tests for the step machine (lib/comments/edition.ts).
 *
 * Why this file exists: this is the only stateful part of the feature, it runs
 * unattended at 07:05 every morning, and nobody watches it. Three properties
 * have to hold or the publication quietly breaks:
 *
 *   IDEMPOTENCE. The workflow retries. A pick that ran twice would re-pick the
 *   day's videos and double-spend quota; a publish that ran twice would renumber
 *   the edition.
 *
 *   PARTIAL FAILURE. A video with comments disabled, a Gemini outage, and a
 *   channel-lookup failure are three different things. Only the first should
 *   cost a card. The other two must degrade, because a fail-open budget guard
 *   means a Gemini outage would otherwise blank all five videos at once.
 *
 *   THE 409. Publishing while a video is still processing would ship a partial
 *   edition and mark it final. Better to fail the build loudly.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { editionDateToday, rejectReason, buildFeaturedRows, isStepName } from "@/lib/comments/edition";
import type { VideoPick, ScoredComment, EditorialJson } from "@/lib/comments/types";

afterEach(() => vi.restoreAllMocks());

function pick(over: Partial<VideoPick> = {}): VideoPick {
  return {
    videoId: "dQw4w9WgXcQ",
    title: "A Trending Video",
    description: "",
    channelId: "UCchannel",
    channelTitle: "Some Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/x/maxresdefault.jpg",
    durationS: 600,
    publishedAt: "2026-09-13T00:00:00Z",
    views: 2_000_000,
    likes: 90_000,
    comments: 4200,
    liveBroadcastContent: "none",
    defaultAudioLanguage: "en",
    defaultLanguage: null,
    ...over,
  };
}

const NONE = new Map<string, { status: string; created_at: string }>();
const NOW = Date.parse("2026-09-14T12:00:00Z");

describe("editionDateToday — Central time, not UTC", () => {
  it("is still the previous day at 02:00 UTC, when Central has not rolled over", () => {
    // A morning publication for a Central-time owner. A UTC boundary would
    // publish "tomorrow's" edition during the evening before.
    expect(editionDateToday(new Date("2026-09-15T02:00:00Z"))).toBe("2026-09-14");
  });

  it("has rolled over by midday UTC", () => {
    expect(editionDateToday(new Date("2026-09-15T12:00:00Z"))).toBe("2026-09-15");
  });

  it("returns an ISO date string", () => {
    expect(editionDateToday(new Date("2026-09-15T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("rejectReason — the editorial filter", () => {
  it("accepts a normal trending video", () => {
    expect(rejectReason(pick(), NONE, NOW)).toBeNull();
  });

  it("rejects live broadcasts", () => {
    expect(rejectReason(pick({ liveBroadcastContent: "live" }), NONE, NOW)).toBe("live");
  });

  it("rejects videos with comments disabled, distinctly from quiet ones", () => {
    expect(rejectReason(pick({ comments: -1 }), NONE, NOW)).toBe("comments_disabled");
    expect(rejectReason(pick({ comments: 12 }), NONE, NOW)).toBe("too_few_comments");
  });

  it("rejects Shorts, whose comment sections are reply-shaped", () => {
    expect(rejectReason(pick({ durationS: 45 }), NONE, NOW)).toBe("too_short");
  });

  it("rejects non-English videos, which the lexicon cannot score", () => {
    expect(rejectReason(pick({ defaultAudioLanguage: "es" }), NONE, NOW)).toBe("not_english");
    expect(rejectReason(pick({ defaultAudioLanguage: null, defaultLanguage: "ja" }), NONE, NOW)).toBe("not_english");
  });

  it("accepts en-GB and an unset language", () => {
    expect(rejectReason(pick({ defaultAudioLanguage: "en-GB" }), NONE, NOW)).toBeNull();
    expect(rejectReason(pick({ defaultAudioLanguage: null, defaultLanguage: null }), NONE, NOW)).toBeNull();
  });

  it("never re-analyses a video that already had its day", () => {
    const seen = new Map([["dQw4w9WgXcQ", { status: "analyzed", created_at: "2025-01-01T00:00:00Z" }]]);
    expect(rejectReason(pick(), seen, NOW)).toBe("already_analyzed");
  });

  it("holds a recently skipped video back for a week, then reconsiders it", () => {
    const justSkipped = new Map([["dQw4w9WgXcQ", { status: "skipped", created_at: "2026-09-13T00:00:00Z" }]]);
    expect(rejectReason(pick(), justSkipped, NOW)).toBe("recently_skipped");

    const longAgo = new Map([["dQw4w9WgXcQ", { status: "skipped", created_at: "2026-08-01T00:00:00Z" }]]);
    expect(rejectReason(pick(), longAgo, NOW)).toBeNull();
  });

  it("reports the FIRST failing rule, so the workflow log explains the day", () => {
    const hopeless = pick({ liveBroadcastContent: "live", comments: -1, durationS: 10 });
    expect(rejectReason(hopeless, NONE, NOW)).toBe("live");
  });
});

describe("buildFeaturedRows — the only comment text that gets stored", () => {
  const candidates: ScoredComment[] = Array.from({ length: 5 }, (_, i) => ({
    id: `cand${i}`,
    text: `candidate ${i}`,
    authorDisplay: `Author ${i}`,
    authorChannelId: `UC${i}`,
    authorAvatarUrl: "",
    likeCount: i,
    replyCount: 0,
    publishedAt: "2026-09-12T00:00:00Z",
    sentiment: 0,
    automation: 0,
    signals: [],
    humor: 5 - i,
  }));

  const top: ScoredComment[] = Array.from({ length: 3 }, (_, i) => ({
    ...candidates[0],
    id: `top${i}`,
    text: `top ${i}`,
    likeCount: 1000 - i,
  }));

  const editorial: EditorialJson = {
    vibe: "A vibe.",
    themes: ["a", "b", "c"],
    funniest: { index: 1, why: "The timing." },
    runners_up: [2, 3],
  };

  it("writes exactly six rows: one winner, two runners-up, three most-liked", () => {
    const rows = buildFeaturedRows("vid", editorial, candidates, top);
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.role === "funniest")).toHaveLength(1);
    expect(rows.filter((r) => r.role === "runner_up")).toHaveLength(2);
    expect(rows.filter((r) => r.role === "top")).toHaveLength(3);
  });

  it("attaches the reasoning only to the winner", () => {
    const rows = buildFeaturedRows("vid", editorial, candidates, top);
    expect(rows.find((r) => r.role === "funniest")?.why).toBe("The timing.");
    expect(rows.find((r) => r.role === "runner_up")?.why).toBeNull();
  });

  it("picks the comment the editorial actually named", () => {
    const rows = buildFeaturedRows("vid", editorial, candidates, top);
    expect(rows.find((r) => r.role === "funniest")?.comment_id).toBe("cand1");
  });

  it("never writes the same comment twice under two roles", () => {
    // A candidate can also be in the top list. Two rows with the same primary
    // key would fail the insert and lose the whole video's featured set.
    const overlapping = [...top, candidates[1]];
    const rows = buildFeaturedRows("vid", editorial, candidates, overlapping);
    const ids = rows.map((r) => r.comment_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("survives the fallback's empty-shortlist index without inventing a row", () => {
    const fallback: EditorialJson = { vibe: "v", themes: [], funniest: { index: -1, why: "" }, runners_up: [] };
    const rows = buildFeaturedRows("vid", fallback, [], top);
    expect(rows.filter((r) => r.role === "funniest")).toHaveLength(0);
    expect(rows).toHaveLength(3);
  });

  it("marks every row as freshly refreshed, so the retention clock starts now", () => {
    const rows = buildFeaturedRows("vid", editorial, candidates, top);
    for (const r of rows) {
      expect(r.refreshed_at).toBeTruthy();
      expect(r.removed_at).toBeNull();
    }
  });
});

describe("isStepName", () => {
  it("accepts the four steps and nothing else", () => {
    for (const s of ["pick", "video", "publish", "refresh"]) expect(isStepName(s)).toBe(true);
    for (const s of ["", "PICK", "drop", null, undefined, 5]) expect(isStepName(s)).toBe(false);
  });
});
