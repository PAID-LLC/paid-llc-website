import { describe, expect, it } from "vitest";
import {
  CIVIC_SCALE,
  CIVIC_WINDOW_HOURS,
  EMPTY_COUNTS,
  IDLE_PENALTY,
  civicNet,
  civicSummary,
  civicTarget,
  wardVigour,
  type CivicCounts,
} from "@/lib/meridian/signals";
import { WARDS } from "@/lib/meridian/engine";

// The regression these guard is the one that killed Meridian for 277 ticks: an
// economic signal that was structurally incapable of being anything but zero.
// Every assertion below is about MOVEMENT — that ordinary conditions, good
// conditions and bad conditions produce genuinely different readings.

const window = (over: Partial<CivicCounts>): CivicCounts => ({ ...EMPTY_COUNTS, ...over });

// The observed rate in production: ~7.4 governance events per 6-hour window,
// of which roughly 5.2 votes, 1.1 ballots, 1.1 rejections, 0.04 enactments.
const TYPICAL = window({ votesCast: 5, ballotsOpened: 1, rejected: 1 });
const ENACTING = window({ votesCast: 5, ballotsOpened: 1, enacted: 1 });
const SILENT = window({});

describe("civic signal moves", () => {
  it("does not read zero on an ordinary window", () => {
    // The whole failure in one assertion. The old signal was exactly 0.0 here.
    expect(civicNet(TYPICAL)).not.toBe(0);
  });

  it("separates deadlock, silence and agreement", () => {
    expect(civicNet(ENACTING)).toBeGreaterThan(civicNet(TYPICAL));
    expect(civicNet(TYPICAL)).toBeLessThan(0);
    expect(civicNet(SILENT)).toBeLessThan(0);
  });

  it("makes a full rejection cycle net negative", () => {
    // The bug simulation caught: at the first weighting, a ballot plus its
    // votes outweighed the rejection, so the assembly THROWING SOMETHING OUT
    // scored positive and the city could only ever climb.
    const rejectionCycle = window({ ballotsOpened: 1, votesCast: 5, rejected: 1 });
    expect(civicNet(rejectionCycle)).toBeLessThan(0);
  });

  it("makes an enactment cycle strongly positive", () => {
    const enactCycle = window({ ballotsOpened: 1, votesCast: 5, enacted: 1 });
    expect(civicNet(enactCycle)).toBeGreaterThan(8);
  });

  it("treats silence as stagnation rather than as average", () => {
    // A polity with no business before it is not a healthy one, and must not
    // read the same as a working city.
    expect(civicNet(SILENT)).toBe(IDLE_PENALTY);
    expect(civicTarget(IDLE_PENALTY)).toBeLessThan(50);
  });

  it("prices a real sale as a boom", () => {
    expect(civicTarget(civicNet(window({ sales: 1 })))).toBeGreaterThanOrEqual(70);
  });
});

describe("civic target", () => {
  it("is monotonic and clamped", () => {
    expect(civicTarget(0)).toBe(50);
    expect(civicTarget(1)).toBeGreaterThan(civicTarget(0));
    expect(civicTarget(-1)).toBeLessThan(civicTarget(0));
    expect(civicTarget(999)).toBe(100);
    expect(civicTarget(-999)).toBe(0);
  });

  it("puts typical and enacting windows in different bands", () => {
    // Not merely different numbers — different acts, which is what unlocks the
    // decay, rift and bond machinery that never once fired in production.
    expect(civicTarget(civicNet(TYPICAL))).toBeLessThan(40); // correction or worse
    expect(civicTarget(civicNet(ENACTING))).toBeGreaterThanOrEqual(70); // boom
  });

  it("keeps the scale off the old dollar-denominated one", () => {
    // PROSPERITY_SCALE was 200, tuned for a signal in dollars. Reusing it on a
    // signal in civic points would peg the index to 0 or 100 permanently.
    expect(CIVIC_SCALE).toBeLessThan(50);
    expect(CIVIC_WINDOW_HOURS).toBeGreaterThan(0);
  });
});

describe("civic summary", () => {
  it("names its sources so the city can show its working", () => {
    const s = civicSummary(window({ enacted: 1, rejected: 2, votesCast: 9 }));
    expect(s).toContain("1 enacted");
    expect(s).toContain("2 rejected");
    expect(s).toContain("9 votes");
  });

  it("says so plainly when nothing happened", () => {
    expect(civicSummary(SILENT)).toBe("no business before the assembly");
  });
});

describe("ward vigour", () => {
  it("covers every ward", () => {
    const v = wardVigour(TYPICAL);
    for (const w of WARDS) expect(v[w]).toBeGreaterThan(0);
  });

  it("is a bounded multiplier around 1", () => {
    for (const c of [SILENT, TYPICAL, ENACTING, window({ votesCast: 500, enacted: 40, sales: 9 })]) {
      for (const w of WARDS) {
        expect(wardVigour(c)[w]).toBeGreaterThanOrEqual(1);
        expect(wardVigour(c)[w]).toBeLessThanOrEqual(1.45);
      }
    }
  });

  it("routes different activity to different wards", () => {
    // The point of the whole thing: six identical wedges is the least
    // interesting plan a city can have, so the wards must be able to disagree.
    const finance = wardVigour(window({ enacted: 3, sales: 2 }));
    const records = wardVigour(window({ votesCast: 60 }));
    expect(finance.spire_row).toBeGreaterThan(finance.archive);
    expect(records.archive).toBeGreaterThan(records.spire_row);
  });

  it("is flat when nothing is happening anywhere", () => {
    const v = wardVigour(SILENT);
    for (const w of WARDS) expect(v[w]).toBeCloseTo(1, 6);
  });
});
