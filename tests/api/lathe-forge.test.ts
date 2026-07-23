import { describe, expect, it } from "vitest";
import {
  activityLevel,
  buildRings,
  classifyCommit,
  forgeHeat,
  freshestSpark,
  hoursSinceLastBuild,
  mostForged,
  seasonFor,
  streakStats,
  type BuildLogEntry,
  type LedgerEntry,
} from "@/lib/lathe/forge";
import { MAX_RINGS, ringRadius } from "@/lib/lathe/workshop";

// The Lathe's compile-time math, pinned like the Crucible's arena math and
// Meridian's market-cycle math: commit classification is a pure first-word
// match, forge heat is a pure function of hours-since-last-build (no ticks
// to persist), and the streak/ledger stats are deterministic replays over
// BUILD_LOG and innovation_ledger rows.

describe("classifyCommit", () => {
  it("matches 'ship' as the first word, case-insensitively, punctuation stripped", () => {
    expect(classifyCommit("Ship: Meridian, third world")).toBe("ship");
    expect(classifyCommit("ship something small")).toBe("ship");
    expect(classifyCommit("SHIP! new world")).toBe("ship");
  });

  it("matches 'fix' as the first word only", () => {
    expect(classifyCommit("Fix bug in the loader")).toBe("fix");
    expect(classifyCommit("fix: chunk dedup")).toBe("fix");
  });

  it("does not classify a mid-sentence mention as ship or fix", () => {
    expect(classifyCommit("The fix for the bug landed")).toBe("other");
    expect(classifyCommit("This commit finally fixes the race")).toBe("other");
    expect(classifyCommit("Merge: pull request #12")).toBe("other");
    expect(classifyCommit("Temp: diagnostic pass")).toBe("other");
  });
});

describe("buildRings", () => {
  const log: BuildLogEntry[] = Array.from({ length: 15 }, (_, i) => ({
    sha: `sha${i}`,
    date: `2026-07-${String(10 + i).padStart(2, "0")}`,
    subject: i % 3 === 0 ? `Ship: world ${i}` : i % 3 === 1 ? `Fix: bug ${i}` : `Merge: pr ${i}`,
  }));

  it("orders rings oldest-first (BUILD_LOG arrives newest-first)", () => {
    const rings = buildRings(log.slice(0, 3), 0);
    // log[0] is newest per BUILD_LOG convention; ring 0 should be log[2] (oldest of the three).
    expect(rings[0].sha).toBe("sha2");
    expect(rings[rings.length - 1].sha).toBe("sha0");
  });

  it("assigns strictly increasing radius outward from the center", () => {
    const rings = buildRings(log.slice(0, 5), 0);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].radius).toBeGreaterThan(rings[i - 1].radius);
      expect(rings[i].radius).toBe(ringRadius(i));
    }
  });

  it("caps at MAX_RINGS even when given more rows", () => {
    const rings = buildRings(log, 0);
    expect(rings.length).toBe(MAX_RINGS);
  });

  it("only the newest (outermost) ring ever glows", () => {
    const rings = buildRings(log.slice(0, 4), 0.8);
    for (let i = 0; i < rings.length - 1; i++) expect(rings[i].gleam).toBe(0);
    expect(rings[rings.length - 1].gleam).toBe(0.8);
  });

  it("returns an empty array for an empty log", () => {
    expect(buildRings([], 0.5)).toEqual([]);
  });
});

describe("forgeHeat", () => {
  it("is ~1 at zero hours and decays toward 0", () => {
    expect(forgeHeat(0)).toBeCloseTo(1, 5);
    expect(forgeHeat(1000)).toBeLessThan(0.01);
  });

  it("decays to 1/e at the HALF_LIFE_HOURS boundary (72h) — an e-folding constant, matching the Crucible's heatIndex convention", () => {
    expect(forgeHeat(72)).toBeCloseTo(Math.exp(-1), 5);
  });

  it("is monotonically decreasing in hours", () => {
    expect(forgeHeat(10)).toBeGreaterThan(forgeHeat(50));
    expect(forgeHeat(50)).toBeGreaterThan(forgeHeat(150));
  });

  it("treats null/invalid input as fully cold", () => {
    expect(forgeHeat(null)).toBe(0);
    expect(forgeHeat(NaN)).toBe(0);
  });

  it("clamps negative hours (clock skew) to fully hot", () => {
    expect(forgeHeat(-5)).toBe(1);
  });
});

describe("hoursSinceLastBuild", () => {
  it("computes hours from a date string assuming noon UTC", () => {
    const now = Date.parse("2026-07-23T12:00:00Z");
    expect(hoursSinceLastBuild("2026-07-22", now)).toBeCloseTo(24, 5);
  });

  it("returns null when there is no date", () => {
    expect(hoursSinceLastBuild(undefined, Date.now())).toBeNull();
  });
});

describe("iteration-forge weather reuse", () => {
  it("is 0 at zero evaluations and 'calm skies'", () => {
    expect(activityLevel(0)).toBe(0);
    expect(seasonFor(0)).toBe("calm skies");
  });

  it("crosses into each named band at the documented thresholds", () => {
    expect(seasonFor(0.24)).toBe("calm skies");
    expect(seasonFor(0.25)).toBe("gathering storms");
    expect(seasonFor(0.54)).toBe("gathering storms");
    expect(seasonFor(0.55)).toBe("storm season");
    expect(seasonFor(0.8)).toBe("maelstrom");
  });

  it("saturates at 1 well before the cap is reached many times over", () => {
    expect(activityLevel(1000)).toBeLessThanOrEqual(1);
  });
});

describe("streakStats", () => {
  it("handles an empty list", () => {
    const s = streakStats([]);
    expect(s.longestStreakDays).toBe(0);
    expect(s.biggestReforgeDate).toBeNull();
  });

  it("handles a single date", () => {
    const s = streakStats(["2026-07-20"]);
    expect(s.longestStreakDays).toBe(1);
    expect(s.biggestReforgeDate).toBe("2026-07-20");
    expect(s.quietestStretchDays).toBe(0);
  });

  it("finds the busiest single day (Biggest Reforge)", () => {
    const s = streakStats(["2026-07-20", "2026-07-20", "2026-07-20", "2026-07-21"]);
    expect(s.biggestReforgeDate).toBe("2026-07-20");
    expect(s.biggestReforgeCount).toBe(3);
  });

  it("finds the longest consecutive-day streak", () => {
    const s = streakStats(["2026-07-18", "2026-07-19", "2026-07-20", "2026-07-25"]);
    expect(s.longestStreakDays).toBe(3);
  });

  it("finds the quietest stretch between two commits", () => {
    const s = streakStats(["2026-07-10", "2026-07-15"]);
    expect(s.quietestStretchDays).toBe(4);
  });
});

describe("ledger stats", () => {
  const entries: LedgerEntry[] = [
    { id: 1, agent_name: "Alpha", model_class: "x", title: "First idea", description: "d", category: "SEP", created_at: "2026-07-20T10:00:00Z" },
    { id: 2, agent_name: "Beta", model_class: "x", title: "Second idea", description: "d", category: "concept", created_at: "2026-07-21T10:00:00Z" },
    { id: 3, agent_name: "Alpha", model_class: "x", title: "Third idea", description: "d", category: "tool-request", created_at: "2026-07-22T10:00:00Z" },
  ];

  it("mostForged picks the agent with the most rows", () => {
    expect(mostForged(entries)?.agent_name).toBe("Alpha");
    expect(mostForged(entries)?.count).toBe(2);
  });

  it("freshestSpark picks the most recent row regardless of input order", () => {
    const shuffled = [entries[1], entries[2], entries[0]];
    expect(freshestSpark(shuffled)?.id).toBe(3);
  });

  it("both return null on an empty list", () => {
    expect(mostForged([])).toBeNull();
    expect(freshestSpark([])).toBeNull();
  });
});
