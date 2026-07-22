import { describe, expect, it } from "vitest";
import {
  DEFENSE_WINDOW_HOURS,
  WIN_STREAK_QUALIFY,
  buildArenaPlan,
  decayStage,
  heatIndex,
  hoursSinceLastDuel,
  hottestWindow,
  replayReigns,
  statueGlow,
  statueHeight,
  type ChampionRow,
  type DuelRow,
} from "@/lib/crucible/arena";

// The Crucible's compile-time math, pinned like Meridian's market-cycle math:
// grandeur and glow are pure monotonic functions of streak/Elo, decay is a
// pure function of wall-clock hours since a champion's last duel (no ticks
// to persist), and the reign replay is a single deterministic pass over duel
// history that feeds both the live plinth order and the legends superlatives.

function duel(
  winner: string,
  loser: string,
  hoursFromBase: number,
  base: number,
  stake = 10
): DuelRow {
  const at = new Date(base + hoursFromBase * 3_600_000).toISOString();
  return {
    challenger: winner,
    defender: loser,
    winner,
    loser,
    duel_started_at: at,
    created_at: at,
    stake_credits: stake,
  };
}

describe("statue grandeur", () => {
  it("statueHeight is monotonic in win_streak and caps at 20", () => {
    expect(statueHeight(3)).toBeLessThan(statueHeight(10));
    expect(statueHeight(20)).toBe(statueHeight(30));
  });

  it("statueGlow is monotonic in Elo and clamps 0..1", () => {
    expect(statueGlow(1000)).toBe(0);
    expect(statueGlow(1500)).toBe(1);
    expect(statueGlow(2000)).toBe(1);
    expect(statueGlow(1250)).toBeGreaterThan(statueGlow(1100));
  });
});

describe("decay stage boundaries", () => {
  it("maps hours-since-last-duel to the documented stage boundaries", () => {
    expect(decayStage(11)).toBe(0);
    expect(decayStage(12)).toBe(1);
    expect(decayStage(23.9)).toBe(1);
    expect(decayStage(24)).toBe(2);
    expect(decayStage(35.9)).toBe(2);
    expect(decayStage(36)).toBe(3);
    expect(decayStage(47.9)).toBe(3);
    expect(decayStage(DEFENSE_WINDOW_HOURS)).toBe(4);
    expect(decayStage(200)).toBe(4);
  });

  it("treats no evidence of any duel as full decay", () => {
    expect(decayStage(null)).toBe(4);
  });
});

describe("hoursSinceLastDuel", () => {
  const base = Date.parse("2026-07-01T00:00:00Z");
  const duels = [duel("Ada", "Bo", 0, base), duel("Ada", "Cy", 10, base)];

  it("finds the most recent duel involving the agent, regardless of role", () => {
    const now = base + 20 * 3_600_000;
    expect(hoursSinceLastDuel("Ada", duels, now)).toBeCloseTo(10, 5);
    expect(hoursSinceLastDuel("Bo", duels, now)).toBeCloseTo(20, 5);
  });

  it("returns null for an agent with no duels in the window", () => {
    expect(hoursSinceLastDuel("Nobody", duels, base)).toBeNull();
  });
});

describe("heatIndex", () => {
  const base = Date.parse("2026-07-01T00:00:00Z");

  it("is 0 for no duels", () => {
    expect(heatIndex([], base)).toBe(0);
  });

  it("is higher when the same count of duels happened more recently", () => {
    const recent = Array.from({ length: 5 }, (_, i) => duel("A", "B", i, base));
    const stale = Array.from({ length: 5 }, (_, i) => duel("A", "B", i - 500, base));
    const now = base;
    expect(heatIndex(recent, now)).toBeGreaterThan(heatIndex(stale, now));
  });

  it("stays within 0..1", () => {
    const many = Array.from({ length: 200 }, (_, i) => duel("A", "B", -i * 0.1, base));
    expect(heatIndex(many, base)).toBeLessThanOrEqual(1);
    expect(heatIndex(many, base)).toBeGreaterThan(0);
  });
});

describe("replayReigns", () => {
  const base = Date.parse("2026-07-01T00:00:00Z");
  // Ada: three straight wins (qualifies at duel 3), a fourth win (longest
  // streak 4), then a loss to Bo 3 hours after qualifying — the fall.
  const duels: DuelRow[] = [
    duel("Ada", "X", 0, base),
    duel("Ada", "Y", 1, base),
    duel("Ada", "Z", 2, base), // qualifies here
    duel("Ada", "W", 3, base),
    duel("Bo", "Ada", 5, base), // falls here — 3h after qualifying
  ];

  it("counts reigns, tracks longest streak, and finds the fastest fall", () => {
    const { records } = replayReigns(duels);
    const ada = records.get("Ada");
    expect(ada?.reigns).toBe(1);
    expect(ada?.longestStreak).toBe(4);
    expect(ada?.fastestFallHours).toBeCloseTo(3, 5);
  });

  it("tallies total stake across every duel the agent appears in", () => {
    const { records } = replayReigns(duels);
    expect(records.get("Ada")?.totalStake).toBe(50); // 5 duels x 10 credits
  });

  it("has no currentReignStart for an agent whose streak already broke", () => {
    const { currentReignStart } = replayReigns(duels);
    expect(currentReignStart.has("Ada")).toBe(false);
  });

  it("keeps a currentReignStart for an agent still on a qualifying streak", () => {
    const ongoing = duels.slice(0, 4); // stop before the loss
    const { currentReignStart } = replayReigns(ongoing);
    expect(currentReignStart.get("Ada")).toBe(duels[2].duel_started_at);
  });
});

describe("hottestWindow", () => {
  it("finds the busiest window by raw count", () => {
    const base = Date.parse("2026-07-01T00:00:00Z");
    const hour = 3_600_000;
    const burst = [base, base + hour, base + 2 * hour, base + 3 * hour];
    const quiet = [base + 500 * hour];
    const times = [...burst, ...quiet].sort((a, b) => a - b);
    const result = hottestWindow(times, 72);
    expect(result.count).toBe(4);
    expect(result.windowStart).toBe(burst[0]);
  });

  it("returns count 0 for an empty history", () => {
    expect(hottestWindow([], 72).count).toBe(0);
  });
});

describe("buildArenaPlan", () => {
  const base = Date.parse("2026-07-01T00:00:00Z");

  it("assigns plinths in current-reign order, oldest first", () => {
    const champions: ChampionRow[] = [
      { agent_name: "Newer", elo: 1100, win_streak: 3 },
      { agent_name: "Older", elo: 1300, win_streak: 5 },
    ];
    // Older qualified first (t=0..2), Newer qualified later (t=10..12).
    const duelsAsc: DuelRow[] = [
      duel("Older", "X", 0, base),
      duel("Older", "Y", 1, base),
      duel("Older", "Z", 2, base),
      duel("Older", "W", 3, base),
      duel("Older", "V", 4, base),
      duel("Newer", "X", 10, base),
      duel("Newer", "Y", 11, base),
      duel("Newer", "Z", 12, base),
    ];
    const duelsDesc = [...duelsAsc].reverse();
    const now = base + 13 * 3_600_000; // just after both qualified, no decay
    const plan = buildArenaPlan(champions, duelsDesc, duelsAsc, now);
    const older = plan.active.find((c) => c.agent_name === "Older");
    const newer = plan.active.find((c) => c.agent_name === "Newer");
    expect(older?.plinth_index).toBe(0);
    expect(newer?.plinth_index).toBe(1);
  });

  it("moves a champion who has fully decayed into the fallen list", () => {
    const champions: ChampionRow[] = [{ agent_name: "Ghost", elo: 1200, win_streak: 3 }];
    const duelsAsc: DuelRow[] = [
      duel("Ghost", "X", 0, base),
      duel("Ghost", "Y", 1, base),
      duel("Ghost", "Z", 2, base),
    ];
    const duelsDesc = [...duelsAsc].reverse();
    const now = base + (2 + DEFENSE_WINDOW_HOURS + 1) * 3_600_000; // well past the window
    const plan = buildArenaPlan(champions, duelsDesc, duelsAsc, now);
    expect(plan.active.length).toBe(0);
    expect(plan.fallen.some((f) => f.agent_name === "Ghost")).toBe(true);
  });

  it("caps literal plinths at the given capacity, leaving the rest without one", () => {
    const champions: ChampionRow[] = Array.from({ length: 3 }, (_, i) => ({
      agent_name: `C${i}`,
      elo: 1200,
      win_streak: WIN_STREAK_QUALIFY,
    }));
    const duelsAsc: DuelRow[] = champions.flatMap((c, i) => [
      duel(c.agent_name, "X", i * 10, base),
      duel(c.agent_name, "Y", i * 10 + 1, base),
      duel(c.agent_name, "Z", i * 10 + 2, base),
    ]);
    const duelsDesc = [...duelsAsc].reverse();
    const now = base + 25 * 3_600_000;
    const plan = buildArenaPlan(champions, duelsDesc, duelsAsc, now, 2);
    const capped = plan.active.filter((c) => c.plinth_index === null);
    expect(capped.length).toBe(1);
  });
});
