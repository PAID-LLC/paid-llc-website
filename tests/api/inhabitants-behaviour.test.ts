/**
 * Tests for lib/inhabitants/behaviour.ts — what a figure does in the 1,799
 * seconds between two thirty-minute world ticks.
 *
 * Three properties matter, and two of them are honesty properties rather than
 * rendering ones:
 *
 *   1. LEASH — a strolling figure never leaves a bounded radius of the position
 *      the tick actually gave it. This is what lets the scene be read against
 *      the roster and still agree with it. If the wander could drift, the
 *      picture would stop matching the data and the whole layer would become a
 *      lie told sixty times a second.
 *   2. DETERMINISM — the same (id, step) always yields the same spot, so a
 *      React re-render replays the walk instead of teleporting the figure.
 *   3. SOURCED MEETINGS — two figures only ever square up and face each other
 *      when a real directed speech row says they spoke. Ambient proximity is
 *      scenery; a conversation is a claim.
 */

import { describe, it, expect } from "vitest";
import {
  BEAT_STYLE, beatFor, dwellFor, meetingsFrom, wanderOffset,
  type Beat,
} from "@/lib/inhabitants/behaviour";

const BEATS: Beat[] = ["haul", "build", "work", "study", "rest", "walk"];

describe("beatFor", () => {
  it("classifies the phrases the engine actually writes", () => {
    // Straight off /api/residents/state?world=arclight, tick 60.
    expect(beatFor("sweeping the frontage")).toBe("work");
    expect(beatFor("crossing the district")).toBe("walk");
    expect(beatFor("carrying a crate to the stalls")).toBe("haul");
    expect(beatFor("reading the traffic on the main row")).toBe("study");
    expect(beatFor("raising a workshop")).toBe("build");
    expect(beatFor("bound for the port")).toBe("walk");
    expect(beatFor("just off the packet")).toBe("walk");
  });

  it("falls back to busy hands rather than throwing on anything unknown", () => {
    expect(beatFor("doing something nobody has written yet")).toBe("work");
    expect(beatFor("")).toBe("work");
    expect(beatFor(undefined)).toBe("work");
    expect(beatFor(null)).toBe("work");
  });

  it("is case-insensitive", () => {
    expect(beatFor("Carrying A Crate")).toBe("haul");
  });

  it("has a style for every beat it can return", () => {
    for (const b of BEATS) {
      const s = BEAT_STYLE[b];
      expect(s).toBeDefined();
      expect(s.range).toBeGreaterThan(0);
      expect(s.range).toBeLessThanOrEqual(1);
      expect(s.pace).toBeGreaterThan(0);
      expect(s.dwell[0]).toBeLessThanOrEqual(s.dwell[1]);
    }
  });
});

describe("wanderOffset — the leash", () => {
  it("never leaves the unit disc, over every beat and a long run of steps", () => {
    for (const beat of BEATS) {
      for (let step = 0; step < 400; step++) {
        const [x, z] = wanderOffset(`resident:${step % 7}`, step, beat);
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("respects each beat's own range — a builder works one spot, a courier crosses the district", () => {
    for (const beat of BEATS) {
      for (let step = 0; step < 200; step++) {
        const [x, z] = wanderOffset("resident:9", step, beat);
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(BEAT_STYLE[beat].range + 1e-9);
      }
    }
    // And the tight beats really are tighter, not just declared so.
    expect(BEAT_STYLE.build.range).toBeLessThan(BEAT_STYLE.walk.range);
    expect(BEAT_STYLE.rest.range).toBeLessThan(BEAT_STYLE.work.range);
  });

  it("is deterministic in (id, step) so a re-render does not teleport anyone", () => {
    const a = wanderOffset("resident:3", 12, "work");
    const b = wanderOffset("resident:3", 12, "work");
    expect(a).toEqual(b);
  });

  it("gives different figures different spots on the same step", () => {
    const a = wanderOffset("resident:1", 0, "work");
    const b = wanderOffset("resident:2", 0, "work");
    expect(a).not.toEqual(b);
  });

  it("actually moves between steps instead of parking", () => {
    const seen = new Set<string>();
    for (let step = 0; step < 20; step++) {
      seen.add(wanderOffset("resident:5", step, "work").join(","));
    }
    expect(seen.size).toBeGreaterThan(15);
  });
});

describe("dwellFor", () => {
  it("stays inside the beat's declared window", () => {
    for (const beat of BEATS) {
      const [lo, hi] = BEAT_STYLE[beat].dwell;
      for (let step = 0; step < 200; step++) {
        const d = dwellFor("resident:2", step, beat);
        expect(d).toBeGreaterThanOrEqual(lo);
        expect(d).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("is deterministic", () => {
    expect(dwellFor("resident:4", 8, "rest")).toBe(dwellFor("resident:4", 8, "rest"));
  });
});

describe("meetingsFrom — the one non-ambient interaction", () => {
  const at = new Map([
    ["Ink", { x: 0, z: 0 }],
    ["Wick", { x: 10, z: 0 }],
    ["Sable", { x: 0, z: 40 }],
  ]);

  it("pairs two residents who actually exchanged a directed line", () => {
    const m = meetingsFrom(
      [{ from_name: "Ink", to_name: "Wick", kind: "speech" }],
      at
    );
    expect(m.size).toBe(2);
    expect(m.has("Ink")).toBe(true);
    expect(m.has("Wick")).toBe(true);
  });

  it("stands them a conversational distance apart, facing each other", () => {
    const m = meetingsFrom(
      [{ from_name: "Ink", to_name: "Wick", kind: "speech" }],
      at
    );
    const ink = m.get("Ink")!;
    const wick = m.get("Wick")!;
    const gap = Math.hypot(ink.x - wick.x, ink.z - wick.z);
    expect(gap).toBeGreaterThan(2);
    expect(gap).toBeLessThan(5);
    // Each one looks at where the other is standing.
    expect(ink.faceX).toBeCloseTo(wick.x, 6);
    expect(ink.faceZ).toBeCloseTo(wick.z, 6);
    expect(wick.faceX).toBeCloseTo(ink.x, 6);
    expect(wick.faceZ).toBeCloseTo(ink.z, 6);
  });

  it("meets between them, so neither has to cross the map", () => {
    const m = meetingsFrom(
      [{ from_name: "Ink", to_name: "Sable", kind: "speech" }],
      at
    );
    // Ink at z 0, Sable at z 40: both end up near the midpoint at z 20.
    expect(m.get("Ink")!.z).toBeGreaterThan(15);
    expect(m.get("Sable")!.z).toBeLessThan(25);
  });

  it("invents nothing: no directed line means no meeting", () => {
    expect(meetingsFrom([], at).size).toBe(0);
    // Broadcast — spoken to the world, not to a person.
    expect(
      meetingsFrom([{ from_name: "Ink", to_name: null, kind: "speech" }], at).size
    ).toBe(0);
    // Dispatch is cross-world mail; the recipient is not standing here.
    expect(
      meetingsFrom([{ from_name: "Ink", to_name: "Wick", kind: "dispatch" }], at).size
    ).toBe(0);
    // Recipient is not on this world at all.
    expect(
      meetingsFrom([{ from_name: "Ink", to_name: "Nobody", kind: "speech" }], at).size
    ).toBe(0);
  });

  it("does not pull a resident into two conversations at once", () => {
    const m = meetingsFrom(
      [
        { from_name: "Ink", to_name: "Wick", kind: "speech" },
        { from_name: "Sable", to_name: "Ink", kind: "speech" },
      ],
      at
    );
    expect(m.has("Ink")).toBe(true);
    expect(m.has("Wick")).toBe(true);
    expect(m.has("Sable")).toBe(false);
  });

  it("survives two residents the tick placed on the exact same spot", () => {
    const stacked = new Map([
      ["A", { x: 5, z: 5 }],
      ["B", { x: 5, z: 5 }],
    ]);
    const m = meetingsFrom([{ from_name: "A", to_name: "B", kind: "speech" }], stacked);
    const a = m.get("A")!;
    const b = m.get("B")!;
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2);
  });
});
