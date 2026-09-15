/**
 * Tests for automation scoring (lib/comments/bots.ts).
 *
 * Why this file exists: this module produces a number the site PUBLISHES ("about
 * 14% of this section looked automated"), derived from heuristics with no ground
 * truth, about real people's accounts. Two properties make that publishable, and
 * both are asserted here rather than trusted:
 *
 *   1. No single signal can flag a comment on its own. An ordinary person with a
 *      new account, or a lurker with an auto-assigned handle, must not be
 *      counted as a bot because of that fact alone.
 *   2. summarizeAutomation emits no author identity of any kind. Aggregates are
 *      defensible; naming someone is not.
 *
 * The "channels unavailable" case also matters: a YouTube outage must not turn
 * into a fabricated bot wave on the page.
 */

import { describe, it, expect } from "vitest";
import {
  buildAutomationContext,
  scoreAutomation,
  summarizeAutomation,
  normalizeForHash,
  LIKELY_THRESHOLD,
  CLEAN_THRESHOLD,
} from "@/lib/comments/bots";
import type { CommentInput, ChannelInfo } from "@/lib/comments/types";

const VIDEO_PUBLISHED = "2026-09-10T12:00:00Z";

function comment(over: Partial<CommentInput> = {}): CommentInput {
  return {
    id: `c${Math.random().toString(36).slice(2)}`,
    text: "genuinely one of the best things I have watched this month",
    authorDisplay: "Jamie Torres",
    authorChannelId: `UC${Math.random().toString(36).slice(2, 12)}`,
    authorAvatarUrl: "https://yt3.ggpht.com/abc",
    likeCount: 4,
    replyCount: 0,
    publishedAt: "2026-09-11T09:00:00Z",
    ...over,
  };
}

function channel(over: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: "UCestablished",
    title: "Jamie Torres",
    createdAt: "2019-04-02T00:00:00Z",
    subscriberCount: 212,
    hiddenSubs: false,
    videoCount: 14,
    avatarUrl: "https://yt3.ggpht.com/abc",
    ...over,
  };
}

/** Scores one comment against a context built from the whole set. */
function scoreOne(target: CommentInput, all: CommentInput[], channels = new Map<string, ChannelInfo>()) {
  const ctx = buildAutomationContext(all, channels, VIDEO_PUBLISHED);
  return scoreAutomation(target, ctx);
}

describe("normalizeForHash — what counts as the same comment", () => {
  it("collapses casing, punctuation and emoji so sprinkled variation still matches", () => {
    expect(normalizeForHash("Great video!!! 🔥")).toBe(normalizeForHash("great video 🎉"));
  });

  it("keeps genuinely different text apart", () => {
    expect(normalizeForHash("great video")).not.toBe(normalizeForHash("terrible video"));
  });
});

describe("scoreAutomation — things that should score high", () => {
  it("flags a direct-message scam solicitation", () => {
    const c = comment({ text: "Message me on WhatsApp +1 555 234 9911 for trading signals" });
    expect(scoreOne(c, [c]).score).toBeGreaterThanOrEqual(LIKELY_THRESHOLD);
  });

  it("flags a crypto-profit pitch", () => {
    const c = comment({
      text: "Investing in bitcoin changed my life, my expert mentor made me profit every week",
    });
    expect(scoreOne(c, [c]).score).toBeGreaterThanOrEqual(CLEAN_THRESHOLD);
  });

  it("flags a channel-handoff pitch in either word order", () => {
    // Regression, 2026-09-15. A real pitch arrived through the contact form
    // reading "please contact me on WhatsApp" and scored only 20 of 100: the
    // original pattern only matched "WhatsApp me", not the reversed order,
    // which is the more common phrasing of the two.
    const reversed = comment({
      text: "For a demo or partnership discussion, please contact me on WhatsApp: +1 555 703 8289",
    });
    const forward = comment({ text: "WhatsApp me on +1 555 703 8289 for the demo" });
    for (const c of [reversed, forward]) {
      expect(scoreOne(c, [c]).signals).toContain("scam_phrase");
      expect(scoreOne(c, [c]).score).toBeGreaterThanOrEqual(LIKELY_THRESHOLD);
    }
  });

  it("does not fire on someone legitimately discussing those platforms", () => {
    // The cost of the rule above is false positives on real messages that
    // simply name a messaging app, which must stay clean.
    const genuine = [
      comment({ text: "Do you cover the WhatsApp Business API in any of the guides? We use it for support." }),
      comment({ text: "We moved our team off Telegram last year and it was the right call." }),
    ];
    for (const c of genuine) {
      expect(scoreOne(c, genuine).signals).not.toContain("scam_phrase");
    }
  });

  it("flags identical text posted by three different accounts", () => {
    const text = "this video deserves so many more views than it has right now";
    const ring = [
      comment({ text, authorChannelId: "UCa" }),
      comment({ text, authorChannelId: "UCb" }),
      comment({ text, authorChannelId: "UCc" }),
    ];
    for (const c of ring) {
      expect(scoreOne(c, ring).signals).toContain("dup_text");
    }
  });

  it("does NOT flag one person repeating themselves", () => {
    const text = "this video deserves so many more views than it has right now";
    const same = [
      comment({ text, authorChannelId: "UCsolo" }),
      comment({ text, authorChannelId: "UCsolo" }),
      comment({ text, authorChannelId: "UCsolo" }),
    ];
    expect(scoreOne(same[0], same).signals).not.toContain("dup_text");
  });

  it("flags zero-width characters used to evade filters", () => {
    const c = comment({ text: `free gi​ft ca​rds click now for your reward` });
    expect(scoreOne(c, [c]).signals).toContain("unicode_trick");
  });

  it("flags a brand-new account", () => {
    const c = comment({ authorChannelId: "UCnew" });
    const channels = new Map([["UCnew", channel({ id: "UCnew", createdAt: new Date().toISOString() })]]);
    expect(scoreOne(c, [c], channels).signals).toContain("new_account");
  });
});

describe("scoreAutomation — ordinary people must stay clean", () => {
  it("scores normal comments below the featured-pick threshold", () => {
    const normals = [
      comment({ text: "the drummer absolutely carried this whole performance" }),
      comment({ text: "I did not expect the twist at the end, rewatching now" }),
      comment({ text: "whoever edited this deserves a raise honestly" }),
    ];
    const channels = new Map(normals.map((c) => [c.authorChannelId, channel({ id: c.authorChannelId })]));
    for (const c of normals) {
      expect(scoreOne(c, normals, channels).score).toBeLessThan(CLEAN_THRESHOLD);
    }
  });

  it("does not flag someone on a new account alone", () => {
    // A real person who just made an account is not a bot. This is the property
    // that stops "account age" from being a de facto accusation.
    const c = comment({ authorChannelId: "UCnew", authorDisplay: "Priya Raman" });
    const channels = new Map([["UCnew", channel({ id: "UCnew", createdAt: new Date().toISOString() })]]);
    expect(scoreOne(c, [c], channels).score).toBeLessThan(LIKELY_THRESHOLD);
  });

  it("does not flag an auto-assigned handle alone", () => {
    const c = comment({ authorDisplay: "@user-kd82mq", authorChannelId: "UClurker" });
    const channels = new Map([["UClurker", channel({ id: "UClurker" })]]);
    expect(scoreOne(c, [c], channels).score).toBeLessThan(LIKELY_THRESHOLD);
  });
});

describe("scoreAutomation — a YouTube outage must not fabricate a bot wave", () => {
  it("suppresses the unknown-channel signal when NO channels resolved", () => {
    const c = comment();
    const { signals } = scoreOne(c, [c], new Map());
    expect(signals).not.toContain("unknown_channel");
  });

  it("still fires unknown-channel when other lookups succeeded", () => {
    const c = comment({ authorChannelId: "UCmissing" });
    const channels = new Map([["UCother", channel({ id: "UCother" })]]);
    expect(scoreOne(c, [c], channels).signals).toContain("unknown_channel");
  });
});

describe("summarizeAutomation — the published aggregate", () => {
  const scored = [
    { automation: 80, signals: ["scam_phrase", "url_or_phone"], authorChannelId: "UCa" },
    { automation: 55, signals: ["dup_text"], authorChannelId: "UCb" },
    { automation: 35, signals: ["auto_handle"], authorChannelId: "UCc" },
    { automation: 5, signals: [], authorChannelId: "UCd" },
    { automation: 0, signals: [], authorChannelId: "UCe" },
  ];

  it("reports shares in [0, 1]", () => {
    const s = summarizeAutomation(scored, 5);
    expect(s.shareLikely).toBeCloseTo(2 / 5);
    expect(s.shareSuspicious).toBeCloseTo(1 / 5);
    expect(s.shareLikely + s.shareSuspicious).toBeLessThanOrEqual(1);
  });

  it("counts signals without attributing them", () => {
    const s = summarizeAutomation(scored, 5);
    expect(s.signals.scam_phrase).toBe(1);
    expect(s.signals.dup_text).toBe(1);
  });

  it("LEAKS NO AUTHOR IDENTITY — the property the disclosure depends on", () => {
    const s = summarizeAutomation(scored, 5);
    const serialized = JSON.stringify(s);
    for (const id of ["UCa", "UCb", "UCc", "UCd", "UCe"]) {
      expect(serialized).not.toContain(id);
    }
  });

  it("reports low confidence when channel coverage is poor", () => {
    expect(summarizeAutomation(scored, 0).confidence).toBe("low");
  });

  it("handles an empty section without dividing by zero", () => {
    const s = summarizeAutomation([], 0);
    expect(s.shareLikely).toBe(0);
    expect(s.confidence).toBe("low");
  });
});
