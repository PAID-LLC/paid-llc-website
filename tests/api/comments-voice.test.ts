/**
 * Tests for the house-voice checks (lib/comments/voice.ts) and the daily
 * question (lib/comments/like-test.ts).
 *
 * The voice half exists because the model does not drift randomly, it drifts to
 * a formula, and nobody rereads yesterday's teaser. Every string asserted below
 * is real published output from editions 1 and 2, which is what makes these
 * regression tests rather than opinions.
 *
 * The like-test half locks the one property that makes the question fair: all
 * three comments come from the same video, so the reader is judging comments
 * rather than audience sizes.
 */

import { describe, it, expect } from "vitest";
import { machineTell, readsHuman, STOCK_MOOD_OPENER } from "@/lib/comments/voice";
import { buildLikeTest } from "@/lib/comments/like-test";
import type { EditionBundle, FeaturedRow, VideoRow } from "@/lib/comments/types";

describe("machineTell — the sentences that actually published", () => {
  it("catches both teasers written before the check existed", () => {
    expect(
      machineTell("Find out why five videos and nearly four thousand comments just produced some surprisingly human results.")
    ).toBe("curiosity-gap");
    expect(
      machineTell("See why a strange camera angle sparked thousands of mostly human comments today.")
    ).toBe("curiosity-gap");
  });

  it("catches the why lines that explained the joke instead of the video", () => {
    expect(machineTell("Comparing the new iPhone camera layout to a kitchen appliance is a spot-on critique.")).toBe("spot-on");
    expect(machineTell("The inflationary renaming of Jerry Does Not Rig Everything is a brilliant twist.")).toBe("brilliant-twist");
    expect(machineTell("It perfectly captures the genuine internet terror of the Duolingo owl.")).toBe("perfectly-captures");
    expect(machineTell("It hilariously reframes a serious project into a gaming reference.")).toBe("adverb-appraisal");
    expect(machineTell("The user adds a hilarious internal monologue questioning the logic.")).toBe("the-user");
  });

  it("catches the word that turned up in four of ten mood lines", () => {
    expect(machineTell("Viewers are cracking up at the chaotic energy of the creators.")).toBe("chaotic");
  });

  it("passes a line that says something concrete", () => {
    // What the fixed prompt asks for: a fact, not an appraisal.
    expect(readsHuman("Price is the only character in the trailer with visible eyebrows.")).toBe(true);
    expect(
      readsHuman("Somebody decided the new iPhone camera looks like a stove burner, and nobody liked the comment.")
    ).toBe(true);
    expect(readsHuman("Half the section is arguing about the ads and the other half about the defense.")).toBe(true);
  });

  it("flags the stock mood opener without banning the words outright", () => {
    expect(STOCK_MOOD_OPENER.test("Viewers are cracking up over Jerry destroying the phone.")).toBe(true);
    expect(STOCK_MOOD_OPENER.test("Fans are losing their minds over Mads Mikkelsen.")).toBe(true);
    // Not an opener, so it survives: the ban is on starting every line the same way.
    expect(STOCK_MOOD_OPENER.test("Half the room thinks viewers are being unfair to the defense.")).toBe(false);
  });
});

// ── The like test ────────────────────────────────────────────────────────────

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: "vid1",
    first_edition: "2026-09-20",
    rank: 0,
    status: "analyzed",
    skip_reason: null,
    title: "A Video",
    channel_id: "UCc",
    channel_title: "A Channel",
    thumbnail_url: null,
    duration_s: 600,
    published_at: "2026-09-19T12:00:00Z",
    stats: {},
    summary: null,
    analysis: {},
    gemini: {},
    ...over,
  };
}

function feat(over: Partial<FeaturedRow> = {}): FeaturedRow {
  return {
    comment_id: "c1",
    video_id: "vid1",
    role: "top",
    position: 0,
    author_display: "Alex",
    author_channel_id: "UCa",
    text: "something",
    like_count: 1000,
    published_at: "2026-09-19T14:00:00Z",
    why: null,
    removed_at: null,
    ...over,
  };
}

function bundle(featured: FeaturedRow[], videos = [video()]): EditionBundle {
  return {
    edition: {
      edition_date: "2026-09-20",
      edition_no: 2,
      region: "US",
      status: "published",
      headline: "h",
      teaser: null,
      video_ids: videos.map((v) => v.video_id),
      hero_comment_id: null,
      stats: {},
      published_at: "2026-09-20T12:00:00Z",
    },
    videos,
    featured,
  };
}

const FAIR = [
  feat({ comment_id: "top1", role: "top", position: 0, like_count: 39000 }),
  feat({ comment_id: "top2", role: "top", position: 1, like_count: 19000 }),
  feat({ comment_id: "fun", role: "funniest", position: 0, like_count: 0 }),
];

describe("buildLikeTest — the daily question", () => {
  it("takes all three comments from one video, so the question is about comments", () => {
    const t = buildLikeTest(bundle(FAIR))!;
    expect(t).not.toBeNull();
    expect(t.choices).toHaveLength(3);
    expect(t.videoId).toBe("vid1");
    expect(t.choices.map((c) => c.commentId).sort()).toEqual(["fun", "top1", "top2"]);
  });

  it("points the answer at the most-liked comment wherever the shuffle put it", () => {
    const t = buildLikeTest(bundle(FAIR))!;
    expect(t.choices[t.answer].commentId).toBe("top1");
    expect(t.choices[t.answer].likes).toBe(39000);
  });

  it("shuffles the same way every time, so a re-render never moves the answer", () => {
    const a = buildLikeTest(bundle(FAIR))!;
    const b = buildLikeTest(bundle(FAIR))!;
    expect(a.choices.map((c) => c.commentId)).toEqual(b.choices.map((c) => c.commentId));
    expect(a.answer).toBe(b.answer);
  });

  it("refuses a question where the top two are not close enough to be a guess", () => {
    const lopsided = [
      feat({ comment_id: "top1", role: "top", position: 0, like_count: 39000 }),
      feat({ comment_id: "top2", role: "top", position: 1, like_count: 40 }),
      feat({ comment_id: "fun", role: "funniest", position: 0, like_count: 0 }),
    ];
    expect(buildLikeTest(bundle(lopsided))).toBeNull();
  });

  it("refuses when the underrated pick is not actually underrated", () => {
    const flat = [
      feat({ comment_id: "top1", role: "top", position: 0, like_count: 900 }),
      feat({ comment_id: "top2", role: "top", position: 1, like_count: 800 }),
      feat({ comment_id: "fun", role: "funniest", position: 0, like_count: 700 }),
    ];
    expect(buildLikeTest(bundle(flat))).toBeNull();
  });

  it("skips a video whose comment was removed upstream and tries the next one", () => {
    const videos = [video({ video_id: "gone" }), video({ video_id: "ok" })];
    const featured = [
      feat({ comment_id: "g1", video_id: "gone", role: "top", position: 0, text: null }),
      feat({ comment_id: "g2", video_id: "gone", role: "top", position: 1 }),
      feat({ comment_id: "g3", video_id: "gone", role: "funniest", position: 0, like_count: 0 }),
      ...FAIR.map((f) => ({ ...f, video_id: "ok" })),
    ];
    const t = buildLikeTest(bundle(featured, videos));
    expect(t?.videoId).toBe("ok");
  });

  it("returns null rather than a bad question when nothing qualifies", () => {
    expect(buildLikeTest(bundle([]))).toBeNull();
    expect(buildLikeTest(bundle([feat({ role: "funniest", like_count: 0 })]))).toBeNull();
  });
});
