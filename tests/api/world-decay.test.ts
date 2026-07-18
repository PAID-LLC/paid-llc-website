import { describe, expect, it } from "vitest";
import { decayCandidate, WORLD_DECAY_DAYS, type WorldStructure } from "@/lib/world";
import { simDecayCandidate, SIM_DECAY_TICKS, type SimStructure } from "@/lib/simworld";

// Decay sinks (world-decay spec v1): both candidate walks are pure functions,
// so the gating, floors, thresholds, and selection order are pinned here —
// these are the rules that keep decay a metabolism instead of a purge.

const DAY_MS = 86_400_000;

function ws(over: Partial<WorldStructure>): WorldStructure {
  return {
    id: 1, kind: "spire", size: "medium", plot: "N", inscription: null,
    built_by: "IQ-Node", proposal_id: 1,
    created_at: new Date(0).toISOString(),
    ...over,
  };
}

describe("decayCandidate (Genesis)", () => {
  const now = 100 * DAY_MS;

  it("is blind to rows without the tended key (migration not run)", () => {
    expect(decayCandidate([ws({ level: 3 })], now)).toBeNull();
  });

  it("never weathers the level-1 floor", () => {
    const s = ws({ level: 1, tended_at: new Date(0).toISOString() });
    expect(decayCandidate([s], now)).toBeNull();
  });

  it("fires only past the untended window", () => {
    const fresh = ws({ level: 3, tended_at: new Date(now - (WORLD_DECAY_DAYS - 1) * DAY_MS).toISOString() });
    const stale = ws({ level: 3, tended_at: new Date(now - (WORLD_DECAY_DAYS + 1) * DAY_MS).toISOString() });
    expect(decayCandidate([fresh], now)).toBeNull();
    expect(decayCandidate([stale], now)).toBe(stale);
  });

  it("picks the single most-overdue structure", () => {
    const older = ws({ id: 1, plot: "N", level: 2, tended_at: new Date(now - 20 * DAY_MS).toISOString() });
    const newer = ws({ id: 2, plot: "NE", level: 3, tended_at: new Date(now - 10 * DAY_MS).toISOString() });
    expect(decayCandidate([newer, older], now)).toBe(older);
  });

  it("floors the clock at the build stamp, so a default tended_at cannot backdate", () => {
    // tended_at epoch-zero but built yesterday: effectively tended yesterday.
    const s = ws({ level: 3, tended_at: new Date(0).toISOString(), created_at: new Date(now - DAY_MS).toISOString() });
    expect(decayCandidate([s], now)).toBeNull();
  });
});

function ss(over: Partial<SimStructure>): SimStructure {
  return {
    id: 1, kind: "cairn", x: 0, z: 0, built_by: "Stack", tick: 0,
    created_at: new Date(0).toISOString(),
    ...over,
  };
}

describe("simDecayCandidate (Substrate)", () => {
  it("is blind to rows without the tended key (migration not run)", () => {
    expect(simDecayCandidate([ss({ level: 3 })], 1000, true)).toBeNull();
  });

  it("never weathers the level-1 floor, and skips local unsaved rows", () => {
    expect(simDecayCandidate([ss({ level: 1, tended_tick: 0 })], 1000, true)).toBeNull();
    expect(simDecayCandidate([ss({ id: -1, level: 3, tended_tick: 0 })], 1000, true)).toBeNull();
  });

  it("vulnerable works weather only under a storm before the 2x backstop", () => {
    const s = ss({ level: 3, tended_tick: 0 });
    const tick = SIM_DECAY_TICKS + 10; // vulnerable, inside the storm-only band
    expect(simDecayCandidate([s], tick, false)).toBeNull();
    expect(simDecayCandidate([s], tick, true)).toBe(s);
  });

  it("the 2x backstop fires even in fair weather", () => {
    const s = ss({ level: 2, tended_tick: 0 });
    expect(simDecayCandidate([s], SIM_DECAY_TICKS * 2 + 1, false)).toBe(s);
  });

  it("tending restarts the clock; the build tick floors it", () => {
    const tended = ss({ level: 3, tended_tick: SIM_DECAY_TICKS });
    expect(simDecayCandidate([tended], SIM_DECAY_TICKS + 10, true)).toBeNull();
    // tended_tick 0 (column default) on a late build: the build tick governs.
    const late = ss({ level: 3, tended_tick: 0, tick: 500 });
    expect(simDecayCandidate([late], 510, true)).toBeNull();
  });

  it("picks the single most-overdue structure", () => {
    const older = ss({ id: 1, level: 2, tended_tick: 0 });
    const newer = ss({ id: 2, level: 3, tended_tick: 200 });
    expect(simDecayCandidate([older, newer], SIM_DECAY_TICKS * 3, true)).toBe(older);
  });
});
