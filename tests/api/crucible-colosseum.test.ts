import { describe, expect, it } from "vitest";
import {
  ARENA_FLOOR_RADIUS,
  PLINTH_SLOTS,
  RING_INNER,
  RING_OUTER,
  STOCKS,
  buildEmberField,
  plinthSlots,
  polar,
} from "@/lib/crucible/colosseum";

// The Crucible's massing layer, pinned like Arclight's cityplan/skyline and
// Meridian's skyline: the colosseum ring is fixed forever, plinth slots and
// ember-field placement are deterministic, and live data only ever drives
// which plinths are occupied and how the ember field shimmers — never layout.

describe("colosseum geometry", () => {
  it("keeps the Arena Floor strictly inside the Champion Ring", () => {
    expect(ARENA_FLOOR_RADIUS).toBeLessThan(RING_INNER);
  });

  it("keeps the Champion Ring band well-ordered", () => {
    expect(RING_OUTER).toBeGreaterThan(RING_INNER);
  });

  it("places the Stocks pit outside the Champion Ring entirely", () => {
    // The pit's nearest edge to the origin must clear the ring's outer radius.
    const nearestEdge = STOCKS.z - STOCKS.d / 2;
    expect(nearestEdge).toBeGreaterThan(RING_OUTER);
  });

  it("polar(0, angle) is always the origin regardless of angle", () => {
    const [x0, z0] = polar(0, 0);
    expect(Math.hypot(x0, z0)).toBe(0);
    const [x1, z1] = polar(0, 233);
    expect(Math.hypot(x1, z1)).toBe(0);
  });
});

describe("plinth slots", () => {
  it("produces exactly PLINTH_SLOTS positions, evenly spaced", () => {
    const slots = plinthSlots();
    expect(slots.length).toBe(PLINTH_SLOTS);
    const angles = slots.map((s) => s.angle).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(360 / PLINTH_SLOTS, 5);
    }
  });

  it("places every slot inside the Champion Ring band", () => {
    for (const slot of plinthSlots()) {
      const r = Math.hypot(slot.x, slot.z);
      expect(r).toBeGreaterThanOrEqual(RING_INNER);
      expect(r).toBeLessThanOrEqual(RING_OUTER);
    }
  });

  it("is deterministic and stable across calls", () => {
    const a = plinthSlots();
    const b = plinthSlots();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("ember field", () => {
  it("is deterministic for a fixed seed", () => {
    const a = buildEmberField(0x1234);
    const b = buildEmberField(0x1234);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("places every mound beyond the Champion Ring's outer edge", () => {
    for (const m of buildEmberField()) {
      const r = Math.hypot(m.x, m.z);
      expect(r).toBeGreaterThan(RING_OUTER);
    }
  });

  it("gives every mound a positive scale and a phase within a full turn", () => {
    for (const m of buildEmberField()) {
      expect(m.scale).toBeGreaterThan(0);
      expect(m.heightScale).toBeGreaterThan(0);
      expect(m.phase).toBeGreaterThanOrEqual(0);
      expect(m.phase).toBeLessThan(Math.PI * 2);
    }
  });
});
