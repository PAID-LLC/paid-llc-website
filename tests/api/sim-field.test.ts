/**
 * Tests for lib/sim-field.ts — Substrate's deterministic world math.
 *
 * The tick engine (server) and the territory canvas (client) both call these
 * functions and must never disagree about where anything is or what the
 * weather was on a given tick. These tests lock that determinism plus the
 * invariants the engine leans on (sites inside roaming range, discovery
 * radii that cannot overlap two sites, clock arithmetic).
 */

import { describe, it, expect } from "vitest";
import {
  ROAM_RADIUS, DISCOVERY_RADIUS, SEASONS, TICKS_PER_DAY, WEATHER_KINDS,
  anomalySites, isConvergence, seasonFor, terrainHeight, weatherFor, worldDay,
} from "@/lib/sim-field";

describe("anomalySites", () => {
  const sites = anomalySites();

  it("returns ten sites with unique keys", () => {
    expect(sites).toHaveLength(10);
    expect(new Set(sites.map((s) => s.key)).size).toBe(10);
  });

  it("is deterministic across calls (server and client must agree)", () => {
    expect(anomalySites()).toEqual(sites);
  });

  it("places every site inside roaming range and outside the founding ring", () => {
    for (const s of sites) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeLessThanOrEqual(ROAM_RADIUS);
      expect(r).toBeGreaterThan(30); // spawn ring is at ~24 units
    }
  });

  it("keeps discovery radii from overlapping two sites", () => {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        const d = Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z);
        expect(d).toBeGreaterThan(DISCOVERY_RADIUS * 2);
      }
    }
  });
});

describe("world clock", () => {
  it("advances one day per TICKS_PER_DAY ticks", () => {
    expect(worldDay(0)).toBe(1);
    expect(worldDay(TICKS_PER_DAY - 1)).toBe(1);
    expect(worldDay(TICKS_PER_DAY)).toBe(2);
    expect(worldDay(TICKS_PER_DAY * 12)).toBe(13);
  });

  it("rotates seasons every six world days and stays in the catalog", () => {
    expect(seasonFor(0)).toBe(SEASONS[0]);
    expect(seasonFor(6 * TICKS_PER_DAY)).toBe(SEASONS[1]);
    expect(seasonFor(24 * TICKS_PER_DAY)).toBe(SEASONS[0]); // full cycle
    for (let t = 0; t < 2000; t += 37) {
      expect(SEASONS).toContain(seasonFor(t));
    }
  });

  it("calls a convergence exactly every 48 ticks, never at tick 0", () => {
    expect(isConvergence(0)).toBe(false);
    expect(isConvergence(48)).toBe(true);
    expect(isConvergence(49)).toBe(false);
    expect(isConvergence(96)).toBe(true);
  });
});

describe("weatherFor", () => {
  it("is deterministic and always in the catalog", () => {
    for (let t = 0; t < 500; t++) {
      const w = weatherFor(t);
      expect(WEATHER_KINDS).toContain(w);
      expect(weatherFor(t)).toBe(w);
    }
  });

  it("holds one regime per five-tick block", () => {
    for (let block = 0; block < 60; block++) {
      const w = weatherFor(block * 5);
      for (let i = 1; i < 5; i++) {
        expect(weatherFor(block * 5 + i)).toBe(w);
      }
    }
  });

  it("produces every regime eventually (no dead branches)", () => {
    const seen = new Set<string>();
    for (let t = 0; t < 5000; t += 5) seen.add(weatherFor(t));
    expect(seen.size).toBe(WEATHER_KINDS.length);
  });
});

describe("terrainHeight", () => {
  it("is deterministic (canvas and engine stand on the same ground)", () => {
    for (const [x, z] of [[0, 0], [40, -60], [-110, 25], [77, 77]] as const) {
      expect(terrainHeight(x, z)).toBe(terrainHeight(x, z));
    }
  });

  it("keeps the Mast ground level", () => {
    expect(Math.abs(terrainHeight(0, 0))).toBeLessThan(1);
    expect(Math.abs(terrainHeight(3, -3))).toBeLessThan(1.5);
  });
});
