/**
 * Tests for edition aggregation and headlines (lib/comments/headline.ts).
 *
 * Why this file exists: the headline is the one line of the publication that
 * cannot be wrong, and it is generated rather than written. Templating it means
 * it can only say what the day's numbers support, but only if the aggregation
 * feeding it is right — in particular that skipped videos contribute nothing and
 * that shares are weighted by comment volume rather than averaged per video.
 *
 * The per-video average is the tempting bug: it would let a 200-comment video
 * swing the day's figure as hard as a 4,000-comment one, and the headline would
 * then confidently state something false about the day.
 */

import { describe, it, expect } from "vitest";
import { aggregateEdition, buildHeadline, pickTemplate } from "@/lib/comments/headline";
import type { VideoRow, EditionStats } from "@/lib/comments/types";

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: `v${Math.random().toString(36).slice(2, 8)}`,
    first_edition: "2026-09-14",
    rank: 0,
    status: "analyzed",
    skip_reason: null,
    title: "A Video",
    channel_id: "UCchannel",
    channel_title: "Some Channel",
    thumbnail_url: null,
    duration_s: 600,
    published_at: "2026-09-13T00:00:00Z",
    stats: {},
    summary: "It is a video.",
    analysis: {
      analyzed: 1000,
      positiveShare: 0.6,
      neutralShare: 0.3,
      negativeShare: 0.1,
      automation: { shareLikely: 0.08, shareSuspicious: 0.05, signals: {}, confidence: "high", uniqueAuthors: 900, channelsResolved: 900 },
      emoji: [],
      velocity: new Array(24).fill(10),
      ytUnits: 27,
    },
    gemini: { video: { in: 35000, out: 200, ms: 12000 } },
    ...over,
  };
}

function stats(over: Partial<EditionStats> = {}): EditionStats {
  return {
    videosPicked: 5,
    videosAnalyzed: 5,
    videosSkipped: 0,
    commentsAnalyzed: 4812,
    positiveShare: 0.62,
    neutralShare: 0.29,
    negativeShare: 0.09,
    automationShare: 0.09,
    mostPositive: "vpos",
    mostNegative: "vneg",
    mostAutomated: "vbot",
    topEmoji: [],
    busiestHour: 3,
    ytUnits: 135,
    geminiIn: 175000,
    geminiOut: 1200,
    ...over,
  };
}

const noChannel = () => null;

describe("aggregateEdition", () => {
  it("weights shares by comment volume, not per video", () => {
    // A 4,000-comment section at 90% positive and a 200-comment one at 10%.
    // Averaging per video gives 50%; weighting by comments gives ~86%.
    const agg = aggregateEdition([
      video({ analysis: { ...video().analysis, analyzed: 4000, positiveShare: 0.9, neutralShare: 0.05, negativeShare: 0.05 } }),
      video({ analysis: { ...video().analysis, analyzed: 200, positiveShare: 0.1, neutralShare: 0.3, negativeShare: 0.6 } }),
    ]);
    expect(agg.positiveShare).toBeGreaterThan(0.8);
    expect(agg.commentsAnalyzed).toBe(4200);
  });

  it("excludes skipped videos from every sum but counts them", () => {
    const agg = aggregateEdition([
      video({ analysis: { ...video().analysis, analyzed: 1000 } }),
      video({ status: "skipped", skip_reason: "comments_disabled", analysis: {} }),
    ]);
    expect(agg.commentsAnalyzed).toBe(1000);
    expect(agg.videosAnalyzed).toBe(1);
    expect(agg.videosSkipped).toBe(1);
    expect(agg.videosPicked).toBe(2);
  });

  it("totals quota and token usage across the edition", () => {
    const agg = aggregateEdition([video(), video()]);
    expect(agg.ytUnits).toBe(54);
    expect(agg.geminiIn).toBe(70000);
  });

  it("returns zeros rather than NaN when nothing was analyzed", () => {
    const agg = aggregateEdition([video({ status: "skipped", analysis: {} })]);
    expect(agg.commentsAnalyzed).toBe(0);
    expect(Number.isNaN(agg.positiveShare)).toBe(false);
  });

  it("identifies the day's extremes for the headline to name", () => {
    const grim = video({ video_id: "grim", analysis: { ...video().analysis, negativeShare: 0.8, positiveShare: 0.1 } });
    const agg = aggregateEdition([video(), grim]);
    expect(agg.mostNegative).toBe("grim");
  });
});

describe("pickTemplate — which story the numbers tell", () => {
  it("leads with the thin case when few videos survived", () => {
    expect(pickTemplate(stats({ videosAnalyzed: 2 }))).toBe("thin");
  });

  it("leads with negativity when the room turned", () => {
    expect(pickTemplate(stats({ negativeShare: 0.41 }))).toBe("negative");
  });

  it("leads with automation when bots dominated", () => {
    expect(pickTemplate(stats({ automationShare: 0.25 }))).toBe("automated");
  });

  it("leads with warmth on a good day", () => {
    expect(pickTemplate(stats({ positiveShare: 0.8 }))).toBe("lovefest");
  });

  it("falls back to the default summary", () => {
    expect(pickTemplate(stats())).toBe("default");
  });
});

describe("buildHeadline", () => {
  it("states the day's real numbers", () => {
    const line = buildHeadline(stats(), noChannel);
    expect(line).toContain("4.8k");
    expect(line).toContain("62%");
  });

  it("names the channel when one is available", () => {
    const line = buildHeadline(stats({ negativeShare: 0.41 }), () => "Some Channel");
    expect(line).toContain("Some Channel");
  });

  it("stays grammatical when no channel can be resolved", () => {
    const line = buildHeadline(stats({ negativeShare: 0.41 }), noChannel);
    expect(line).not.toContain("null");
    expect(line).not.toContain("undefined");
    expect(line.endsWith(".")).toBe(true);
  });

  it("reads correctly with a single surviving video", () => {
    const line = buildHeadline(stats({ videosAnalyzed: 1, commentsAnalyzed: 340 }), noChannel);
    expect(line).toContain("One video made the cut");
    expect(line).not.toContain("videos made");
  });

  it("never emits an em dash, which is a standing rule for published copy", () => {
    for (const s of [stats(), stats({ videosAnalyzed: 2 }), stats({ negativeShare: 0.5 }), stats({ automationShare: 0.3 }), stats({ positiveShare: 0.9 })]) {
      expect(buildHeadline(s, () => "Channel")).not.toMatch(/[—–]/);
    }
  });
});
