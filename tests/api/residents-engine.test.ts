/**
 * Tests for lib/residents/engine.ts — the world-residents tick core.
 *
 * The engine gives the five compiler worlds (Arclight, the Crucible,
 * Palimpsest, the Lathe, Waypoint) inhabitants who move and build. Two
 * properties matter enough to lock down:
 *
 *   1. DETERMINISM — the same (world, resident, tick) must always resolve to
 *      the same action, so a tick is reproducible and the scene never jitters
 *      between two clients reading the same row.
 *   2. CONTAINMENT — residents never leave the roam disc, and building stops
 *      at the cap so a long-running world stays legible.
 *
 * The honesty contract (residents never write to real business tables) is
 * enforced by inspection rather than a unit test: the engine imports no
 * module that can reach arena_duels, sales_ledger or agent_service_jobs.
 */

import { describe, it, expect } from "vitest";
import {
  actorsForTick, chooseAction, clampToRoam,
  type ResidentRow,
} from "@/lib/residents/engine";
import {
  ACTORS_PER_TICK, MAX_BUILDS_PER_WORLD, NEXT_GOALS, RESIDENT_WORLDS,
  ROAM_RADIUS, WORLD_CONFIG, isResidentWorld,
} from "@/lib/residents/cast";

function resident(over: Partial<ResidentRow> = {}): ResidentRow {
  return {
    id: 1, world: "arclight", name: "Sable", epithet: "the Courier",
    archetype: "courier", color: "#fff",
    drives: { industry: 4, curiosity: 3, order: 2, vigor: 4 },
    x: 0, z: 0, energy: 100, mood: "steady", activity: "arriving",
    goal: "Run six deliveries", goal_kind: "tend", goal_progress: 0, goal_target: 6,
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe("clampToRoam", () => {
  it("leaves points inside the disc untouched", () => {
    const p = clampToRoam(10, -12);
    expect(p.x).toBe(10);
    expect(p.z).toBe(-12);
  });

  it("pulls points outside the disc back onto its edge", () => {
    const p = clampToRoam(500, 500);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(ROAM_RADIUS, 6);
  });

  it("never returns a point beyond the roam radius, from any bearing", () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const p = clampToRoam(Math.cos(rad) * 9999, Math.sin(rad) * 9999);
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(ROAM_RADIUS + 1e-9);
    }
  });

  it("handles the origin without dividing by zero", () => {
    const p = clampToRoam(0, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  });
});

describe("chooseAction", () => {
  it("is deterministic for the same resident and tick", () => {
    const r = resident();
    for (let tick = 0; tick < 50; tick++) {
      expect(chooseAction(r, tick, false)).toBe(chooseAction(r, tick, false));
    }
  });

  it("rests when energy is spent, whatever the drives say", () => {
    const r = resident({ energy: 5, drives: { industry: 9, curiosity: 9, order: 9, vigor: 9 } });
    for (let tick = 0; tick < 20; tick++) {
      expect(chooseAction(r, tick, false)).toBe("rest");
    }
  });

  it("never returns build once the world has hit its build cap", () => {
    const r = resident({ goal_kind: "build", drives: { industry: 9, curiosity: 1, order: 1, vigor: 1 } });
    for (let tick = 0; tick < 200; tick++) {
      expect(chooseAction(r, tick, true)).not.toBe("build");
    }
  });

  it("still produces a legal action when every drive is zero", () => {
    const r = resident({ drives: { industry: 0, curiosity: 0, order: 0, vigor: 0 }, goal_kind: "" });
    const legal = ["move", "build", "tend", "study", "rest"];
    for (let tick = 0; tick < 30; tick++) {
      expect(legal).toContain(chooseAction(r, tick, false));
    }
  });

  it("favours the goal's own action often enough to finish goals", () => {
    const r = resident({ goal_kind: "build", drives: { industry: 3, curiosity: 3, order: 3, vigor: 3 } });
    let builds = 0;
    for (let tick = 0; tick < 200; tick++) if (chooseAction(r, tick, false) === "build") builds++;
    // The +5 goal boost should clear a plain even split (200/5 = 40).
    expect(builds).toBeGreaterThan(45);
  });
});

describe("actorsForTick", () => {
  const cast = [
    resident({ id: 1, name: "A" }), resident({ id: 2, name: "B" }),
    resident({ id: 3, name: "C" }), resident({ id: 4, name: "D" }),
  ];

  it("picks exactly ACTORS_PER_TICK residents", () => {
    for (let tick = 0; tick < 12; tick++) {
      expect(actorsForTick(cast, tick)).toHaveLength(ACTORS_PER_TICK);
    }
  });

  it("gives every resident a turn across a full rotation", () => {
    const seen = new Set<string>();
    for (let tick = 0; tick < cast.length; tick++) {
      for (const r of actorsForTick(cast, tick)) seen.add(r.name);
    }
    expect(seen.size).toBe(cast.length);
  });

  it("returns nothing for an empty cast rather than throwing", () => {
    expect(actorsForTick([], 3)).toEqual([]);
  });

  it("never returns more actors than the cast holds", () => {
    expect(actorsForTick([cast[0]], 5)).toHaveLength(1);
  });
});

describe("world configuration", () => {
  it("covers every resident world", () => {
    for (const w of RESIDENT_WORLDS) {
      expect(WORLD_CONFIG[w]).toBeDefined();
      expect(NEXT_GOALS[w]).toBeDefined();
    }
  });

  it("gives every world something to build and something to tend", () => {
    for (const w of RESIDENT_WORLDS) {
      expect(WORLD_CONFIG[w].builds.length).toBeGreaterThan(0);
      expect(WORLD_CONFIG[w].tending.length).toBeGreaterThan(0);
      expect(WORLD_CONFIG[w].studying.length).toBeGreaterThan(0);
      expect(WORLD_CONFIG[w].resting.length).toBeGreaterThan(0);
    }
  });

  it("only offers goals whose kind the engine can actually advance", () => {
    const advanceable = ["build", "tend", "study", "move"];
    for (const w of RESIDENT_WORLDS) {
      for (const g of NEXT_GOALS[w]) {
        expect(advanceable).toContain(g.kind);
        expect(g.target).toBeGreaterThan(0);
      }
    }
  });

  it("recognises exactly the five compiler worlds", () => {
    expect(RESIDENT_WORLDS).toHaveLength(5);
    for (const w of RESIDENT_WORLDS) expect(isResidentWorld(w)).toBe(true);
    // The three worlds that already have their own heartbeat must stay out,
    // or they would get a second, conflicting population.
    for (const w of ["genesis", "substrate", "meridian", "", "GENESIS"]) {
      expect(isResidentWorld(w)).toBe(false);
    }
  });

  it("keeps the build cap above the seeded goal appetite", () => {
    // If the cap were lower than what one rotation of build goals asks for,
    // residents would idle permanently at a full world.
    expect(MAX_BUILDS_PER_WORLD).toBeGreaterThan(8);
  });
});
