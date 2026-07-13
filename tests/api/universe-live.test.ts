/**
 * Tests for the universe map's live-roster merge (inter-world transits).
 * Pure logic in components/v2/latent/universe/universe-live.ts: room moves
 * open transits, synthetic residents survive polls that don't contain them,
 * and mid-flight polls don't restart or teleport a migration.
 */

import { describe, it, expect } from "vitest";
import { mergeRoster, type TransitMap } from "@/components/v2/latent/universe/universe-live";
import type { UniverseAgent } from "@/components/v2/latent/universe/universe-data";

function agent(name: string, worldId: number): UniverseAgent {
  return {
    key: `${worldId}-${name}`,
    name,
    modelClass: "test-model",
    worldId,
    orbit: { radius: 3, phase: 0, incline: 0.2, speed: 0.1 },
    lastActive: new Date().toISOString(),
  };
}

const NOW = 1_000_000;

describe("mergeRoster", () => {
  it("keeps the previous record when the agent stayed in its world", () => {
    const prev = [agent("Stable", 1)];
    const fresh = [{ ...agent("Stable", 1), orbit: { radius: 9, phase: 1, incline: 1, speed: 1 } }];
    const { agents, transits } = mergeRoster(prev, fresh, NOW, {});
    expect(agents).toHaveLength(1);
    expect(agents[0].orbit.radius).toBe(3); // orbit params stable, no jump
    expect(Object.keys(transits)).toHaveLength(0);
  });

  it("opens a transit when an agent moved worlds", () => {
    const prev = [agent("Mover", 1)];
    const fresh = [agent("Mover", 7)];
    const { agents, transits } = mergeRoster(prev, fresh, NOW, {});
    expect(agents[0].worldId).toBe(7);
    expect(transits["Mover"]).toEqual({ fromWorldId: 1, startedAt: NOW });
  });

  it("keeps agents missing from the poll (synthetics and expired presence)", () => {
    const prev = [agent("The-Warden", 1), agent("RoastBot", 1)];
    const fresh = [agent("Visitor", 7)];
    const { agents } = mergeRoster(prev, fresh, NOW, {});
    expect(agents.map((a) => a.name).sort()).toEqual(["RoastBot", "The-Warden", "Visitor"]);
  });

  it("does not restart a transit still in flight", () => {
    const inFlight: TransitMap = { Mover: { fromWorldId: 1, startedAt: NOW - 5_000 } };
    const prev = [agent("Mover", 7)]; // already re-homed by the earlier poll
    const fresh = [agent("Mover", 7)];
    const { transits } = mergeRoster(prev, fresh, NOW, inFlight);
    expect(transits["Mover"].startedAt).toBe(NOW - 5_000);
  });

  it("drops transit records after the keep window", () => {
    const stale: TransitMap = { Done: { fromWorldId: 1, startedAt: NOW - 60_000 } };
    const { transits } = mergeRoster([agent("Done", 7)], [agent("Done", 7)], NOW, stale);
    expect(transits["Done"]).toBeUndefined();
  });

  it("adds brand-new arrivals without a transit", () => {
    const { agents, transits } = mergeRoster([], [agent("Fresh", 6)], NOW, {});
    expect(agents).toHaveLength(1);
    expect(Object.keys(transits)).toHaveLength(0);
  });

  it("a second move re-targets an expired transit but not a live one", () => {
    const live: TransitMap = { Hopper: { fromWorldId: 1, startedAt: NOW - 1_000 } };
    const prev = [agent("Hopper", 7)];
    const fresh = [agent("Hopper", 3)];
    const { agents, transits } = mergeRoster(prev, fresh, NOW, live);
    expect(agents[0].worldId).toBe(3);
    // Live transit record is preserved (no restart mid-flight).
    expect(transits["Hopper"].fromWorldId).toBe(1);
  });
});
