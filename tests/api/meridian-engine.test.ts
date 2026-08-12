import { describe, expect, it } from "vitest";
import {
  MERIDIAN_DECAY_TICKS,
  bandFor,
  clamp01to100,
  decayThreshold,
  easeIndex,
  meridianDecayCandidate,
  nextActState,
  nextNetEma,
  prosperityTarget,
  stakeDelta,
  type ActHysteresisState,
  type MeridianStructureRow,
} from "@/lib/meridian/engine";

// Meridian's market-cycle math, pinned like Substrate's decay math: the
// prosperity index is a pure function of the real economic signal, act
// transitions require sustained evidence (hysteresis), and decay only ever
// bites the single most-overdue ward.

describe("meridian prosperity math", () => {
  it("clamps to 0-100", () => {
    expect(clamp01to100(-5)).toBe(0);
    expect(clamp01to100(150)).toBe(100);
    expect(clamp01to100(42)).toBe(42);
  });

  it("smooths net with an exponential moving average", () => {
    const ema1 = nextNetEma(0, 1);
    const ema2 = nextNetEma(ema1, 1);
    // A repeated positive signal should climb monotonically toward it.
    expect(ema2).toBeGreaterThan(ema1);
    expect(ema2).toBeLessThan(1);
  });

  it("prosperityTarget is monotonic in netEma and centered at 50", () => {
    expect(prosperityTarget(0)).toBe(50);
    expect(prosperityTarget(1)).toBeGreaterThan(prosperityTarget(0));
    expect(prosperityTarget(-1)).toBeLessThan(prosperityTarget(0));
    expect(prosperityTarget(10)).toBe(100); // saturates
    expect(prosperityTarget(-10)).toBe(0);
  });

  it("easeIndex moves toward the target without overshooting", () => {
    const eased = easeIndex(50, 80);
    expect(eased).toBeGreaterThan(50);
    expect(eased).toBeLessThan(80);
  });

  it("bandFor maps index to the four acts at the documented boundaries", () => {
    expect(bandFor(100)).toBe("boom");
    expect(bandFor(70)).toBe("boom");
    expect(bandFor(69)).toBe("stable");
    expect(bandFor(40)).toBe("stable");
    expect(bandFor(39)).toBe("correction");
    expect(bandFor(20)).toBe("correction");
    expect(bandFor(19)).toBe("bust");
    expect(bandFor(0)).toBe("bust");
  });
});

describe("act hysteresis", () => {
  it("does not change the act on a single tick crossing a boundary", () => {
    const r = nextActState({ act: "stable", pendingAct: null, pendingTicks: 0 }, 75);
    expect(r.actChanged).toBe(false);
    expect(r.act).toBe("stable");
    expect(r.pendingAct).toBe("boom");
    expect(r.pendingTicks).toBe(1);
  });

  it("commits the act change only after ACT_HOLD_TICKS consecutive ticks", () => {
    let state: ActHysteresisState = { act: "stable", pendingAct: null, pendingTicks: 0 };
    let changed = false;
    for (let i = 0; i < 6; i++) {
      const r = nextActState(state, 75);
      state = { act: r.act, pendingAct: r.pendingAct, pendingTicks: r.pendingTicks };
      changed = r.actChanged;
      if (changed) break;
    }
    expect(changed).toBe(true);
    expect(state.act).toBe("boom");
  });

  it("resets the pending counter if the band reverts before it commits", () => {
    const first = nextActState({ act: "stable", pendingAct: null, pendingTicks: 0 }, 75);
    const reverted = nextActState(
      { act: first.act, pendingAct: first.pendingAct, pendingTicks: first.pendingTicks },
      50
    );
    expect(reverted.act).toBe("stable");
    expect(reverted.pendingAct).toBeNull();
    expect(reverted.pendingTicks).toBe(0);
  });

  it("never reports a change when the band already matches the current act", () => {
    const r = nextActState({ act: "boom", pendingAct: null, pendingTicks: 0 }, 85);
    expect(r.actChanged).toBe(false);
    expect(r.act).toBe("boom");
  });
});

describe("stake drift", () => {
  const fixedRand = () => 0.5; // noise term becomes exactly 0

  it("is deterministic for a fixed rand() stream", () => {
    const boom = stakeDelta("boom", 1, fixedRand, 50);
    const bust = stakeDelta("bust", 1, fixedRand, 50);
    expect(boom).toBeGreaterThan(0);
    expect(bust).toBeLessThan(0);
    expect(stakeDelta("boom", 1, fixedRand, 50)).toBe(boom);
  });

  it("scales with volatility", () => {
    const low = stakeDelta("boom", 0.5, fixedRand, 50);
    const high = stakeDelta("boom", 1.5, fixedRand, 50);
    expect(high).toBeGreaterThan(low);
  });

  // The property the old constant-drift model lacked, and the reason it pinned
  // every citizen against a boundary within a day of any sustained act.
  it("reverts toward the act's level instead of drifting without bound", () => {
    // Already rich in a boom: the pull is downward, not further up.
    expect(stakeDelta("boom", 1, fixedRand, 95)).toBeLessThan(0);
    // Already poor in a bust: the pull is upward.
    expect(stakeDelta("bust", 1, fixedRand, 5)).toBeGreaterThan(0);
    // And it weakens as the citizen approaches the level.
    const far = stakeDelta("boom", 1, fixedRand, 40);
    const near = stakeDelta("boom", 1, fixedRand, 78);
    expect(far).toBeGreaterThan(near);
  });

  it("holds a sustained act at a finite level rather than a boundary", () => {
    for (const act of ["boom", "stable", "correction", "bust"] as const) {
      let stake = 50;
      for (let i = 0; i < 4000; i++) stake += stakeDelta(act, 1, fixedRand, stake);
      // Never parked on 0 or 100, which is exactly what used to happen.
      expect(stake).toBeGreaterThan(2);
      expect(stake).toBeLessThan(98);
    }
  });
});

describe("decay", () => {
  it("halves the threshold during a bust", () => {
    expect(decayThreshold("bust")).toBe(MERIDIAN_DECAY_TICKS / 2);
    expect(decayThreshold("boom")).toBe(MERIDIAN_DECAY_TICKS);
    expect(decayThreshold("stable")).toBe(MERIDIAN_DECAY_TICKS);
    expect(decayThreshold("correction")).toBe(MERIDIAN_DECAY_TICKS);
  });

  const mk = (id: number, level: 1 | 2 | 3, tended_tick: number): MeridianStructureRow => ({
    id, ward_kind: "spire_row", level, tended_tick, created_at: new Date().toISOString(),
  });

  it("picks the single most-overdue eligible structure", () => {
    const structures = [mk(1, 2, 0), mk(2, 2, 100), mk(3, 1, 0)];
    const pick = meridianDecayCandidate(structures, 200, "bust");
    // threshold in bust = 84; id 1 is 200 ticks overdue, id 2 is 100 ticks
    // overdue, id 3 is level 1 (floor, never decays further).
    expect(pick?.id).toBe(1);
  });

  it("returns null when nothing has crossed the threshold", () => {
    const structures = [mk(1, 2, 190)];
    expect(meridianDecayCandidate(structures, 200, "boom")).toBeNull(); // 10 < 168
  });

  it("never selects a level-1 structure (the floor)", () => {
    const structures = [mk(1, 1, 0)];
    expect(meridianDecayCandidate(structures, 10_000, "bust")).toBeNull();
  });
});
