/**
 * The quality report over the editions of 2026-10-03 through 2026-10-16.
 *
 * The fixture is the public pages as they rendered: views per hour, comments
 * read, duration, title, channel. It is the before-measurement for the picker
 * change. The assertions lock both that measurement and which of those cards
 * the new hard gate would turn away. Repeat channels are counted, not rejected
 * here: cooldown only means something once the rest of that morning's pool is
 * in the room, and the fixture is the five that won, not the 450 that competed.
 */

import { describe, it, expect } from "vitest";
import editions from "../fixtures/comment-editions-2026-10.json";
import { replayReject, scoreRun, type QualityEdition, type QualityVideo } from "@/lib/comments/quality";

const RUN = editions as QualityEdition[];

function find(id: string): QualityVideo {
  for (const e of RUN) {
    const v = e.videos.find((x) => x.videoId === id);
    if (v) return v;
  }
  throw new Error(`missing ${id}`);
}

describe("2026-10-03 to 2026-10-16 editions", () => {
  const run = scoreRun(RUN);

  it("covers fourteen editions and sixty-nine videos, with no duplicate ids and no dead links", () => {
    expect(run.editions).toBe(14);
    expect(run.videos).toBe(69);
    expect(run.duplicateIds).toEqual([]);
    expect(run.deadLinks).toEqual([]);
    // Views/hour as the cards rendered them, rounded. Median of 69.
    expect(run.medianViewsPerHour).toBe(176_000);
    // Comments read, capped at 1,000. The median hit the cap; 27 sections did not.
    expect(run.medianCommentsRead).toBe(1000);
    expect(run.uncapped).toBe(27);
  });

  it("shows the same channels taking a slot several days running", () => {
    expect(run.channelCounts.slice(0, 5)).toEqual([
      { channel: "His Story", editions: 6 },
      { channel: "IShowSpeed", editions: 4 },
      { channel: "Jimmy Kimmel Live", editions: 4 },
      { channel: "MLB", editions: 4 },
      { channel: "Serena Neel", editions: 4 },
    ]);
  });

  it("turns away the thin, short, and subtitled picks and keeps the ones with a real section", () => {
    expect(replayReject(find("dgV7wo5hcqE"))).toBe("not_english");
    expect(replayReject(find("LPztP1mrKkw"))).toBe("too_few_comments");
    expect(replayReject(find("ZkKdJiCDlPo"))).toBe("too_few_comments");
    expect(replayReject(find("gDJ-ini7fF0"))).toBe("too_few_comments");
    expect(replayReject(find("MqRa6X31lUk"))).toBe("too_few_comments");
    expect(replayReject(find("qIZUB1UMCGA"))).toBe("short");
    expect(replayReject(find("7tpS7wLMKd8"))).toBe("short");
    expect(replayReject(find("BuPuFP-XrJ4"))).toBe("short");
    // Capped at 1,000 comments read, so the true total is larger. A short
    // trailer and a 66M-view upload both stay; density is not judged off the cap.
    expect(replayReject(find("rz1B4B2yBZY"))).toBeNull();
    expect(replayReject(find("plN7JMbadRg"))).toBeNull();

    const rules = run.wouldReject.reduce<Record<string, number>>((acc, r) => {
      acc[r.rule] = (acc[r.rule] ?? 0) + 1;
      return acc;
    }, {});
    expect(run.wouldReject).toHaveLength(13);
    expect(rules).toEqual({ too_few_comments: 7, short: 5, not_english: 1 });
  });

  it("counts a known-dead id as a dead link", () => {
    const dead: QualityVideo = {
      ...find("plN7JMbadRg"),
      videoId: "BFc2W5OF3BM",
      available: false,
    };
    expect(replayReject(dead)).toBe("unavailable");
    const scored = scoreRun([
      { editionDate: "2026-09-21", editionNo: null, videos: [dead], skipped: [] },
    ]);
    expect(scored.deadLinks).toEqual(["BFc2W5OF3BM"]);
  });
});
