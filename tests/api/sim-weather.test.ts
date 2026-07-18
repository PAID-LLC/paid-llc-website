import { describe, expect, it } from "vitest";
import {
  ACT_BLOCKS, SIM_SEED, STORYTELLER_FROM_TICK, WEATHER_KINDS,
  stormFront, weatherFor, hashStr,
} from "@/lib/sim-field";

// Storyteller weather (RimWorld pattern, dynamic-agent-worlds reference map
// 2026-07-18): acts run calm → building → crisis → aftermath. These tests pin
// the drama-curve semantics AND the historical contract — ticks before the
// cutover must keep producing the founding era's exact weather, because the
// chronicle recorded it and the legends derive Stormborn from it.

// The founding era's original formula, copied verbatim as the historical pin.
function lat2(ix: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function legacyWeather(tick: number): string {
  const block = Math.floor(Math.max(0, tick) / 5);
  const r = lat2(block, 7, SIM_SEED + 977);
  if (r < 0.40) return "clear";
  if (r < 0.62) return "fog bank";
  if (r < 0.82) return "data-rain";
  if (r < 0.95) return "static storm";
  return "solar flush";
}

describe("weatherFor: the historical contract", () => {
  it("keeps every pre-cutover tick exactly as the founding era recorded it", () => {
    for (let t = 0; t < STORYTELLER_FROM_TICK; t++) {
      expect(weatherFor(t)).toBe(legacyWeather(t));
    }
  });

  it("stays deterministic and within the known kinds", () => {
    for (let t = 0; t < 3000; t += 7) {
      expect(weatherFor(t)).toBe(weatherFor(t));
      expect(WEATHER_KINDS).toContain(weatherFor(t));
    }
  });
});

describe("stormFront: the act structure", () => {
  it("reads calm for the whole pre-storyteller era", () => {
    expect(stormFront(0)).toBe("calm");
    expect(stormFront(STORYTELLER_FROM_TICK - 1)).toBe("calm");
  });

  it("walks calm → building → crisis → aftermath across one act", () => {
    const actStart = STORYTELLER_FROM_TICK; // cutover sits on an act boundary
    const phases = Array.from({ length: ACT_BLOCKS }, (_, b) => stormFront(actStart + b * 5));
    expect(phases.slice(0, 5).every((p) => p === "calm")).toBe(true);
    expect(phases.slice(5, 9).every((p) => p === "building")).toBe(true);
    expect(phases.slice(9, 11).every((p) => p === "crisis")).toBe(true);
    expect(phases[11]).toBe("aftermath");
  });
});

describe("weatherFor: the drama curve", () => {
  // Sample many post-cutover acts and count storms/flushes per phase.
  function phaseShare(phase: string, kind: string): number {
    let inPhase = 0;
    let hits = 0;
    for (let t = STORYTELLER_FROM_TICK; t < STORYTELLER_FROM_TICK + 5 * ACT_BLOCKS * 400; t += 5) {
      if (stormFront(t) !== phase) continue;
      inPhase++;
      if (weatherFor(t) === kind) hits++;
    }
    return hits / Math.max(1, inPhase);
  }

  it("never storms in the calm phase", () => {
    expect(phaseShare("calm", "static storm")).toBe(0);
  });

  it("clusters storms at the crisis and relief right after", () => {
    expect(phaseShare("crisis", "static storm")).toBeGreaterThan(phaseShare("building", "static storm"));
    expect(phaseShare("crisis", "static storm")).toBeGreaterThan(0.25);
    expect(phaseShare("aftermath", "solar flush")).toBeGreaterThan(phaseShare("calm", "solar flush"));
    expect(phaseShare("aftermath", "solar flush")).toBeGreaterThan(0.3);
  });

  it("lets mild acts pass without a single storm", () => {
    // Scan acts for at least one whose whole span never storms — the
    // one-act-in-three that never breaks.
    let quietActExists = false;
    for (let act = 1; act < 60 && !quietActExists; act++) {
      const start = act * ACT_BLOCKS * 5;
      if (start < STORYTELLER_FROM_TICK) continue;
      let stormy = false;
      for (let b = 0; b < ACT_BLOCKS; b++) {
        if (weatherFor(start + b * 5) === "static storm") stormy = true;
      }
      if (!stormy) quietActExists = true;
    }
    expect(quietActExists).toBe(true);
  });
});

// Keep the import "used" even if the suite above is filtered — hashStr is the
// seed's provenance and pins that SIM_SEED itself never drifts.
describe("SIM_SEED", () => {
  it("is still the hash of the run name", () => {
    expect(SIM_SEED).toBe(hashStr("substrate-run-01"));
  });
});
