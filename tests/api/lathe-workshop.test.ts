import { describe, expect, it } from "vitest";
import {
  GROUND_RADIUS,
  RING_BASE_RADIUS,
  RING_STEP,
  SPARK_INNER,
  SPARK_OUTER,
  ringRadius,
  sparkPosition,
} from "@/lib/lathe/workshop";

// The Lathe's massing layer, pinned like the Crucible's colosseum and
// Arclight's cityplan/skyline: the geometry is fixed forever, live data only
// ever decides what's drawn where, never the layout itself.

describe("workshop geometry", () => {
  it("keeps the spark annulus strictly outside the ring band's plausible extent", () => {
    expect(SPARK_INNER).toBeGreaterThan(RING_BASE_RADIUS);
    expect(SPARK_OUTER).toBeGreaterThan(SPARK_INNER);
  });

  it("keeps the spark annulus well within the ground radius", () => {
    expect(SPARK_OUTER).toBeLessThan(GROUND_RADIUS);
  });

  it("ringRadius grows linearly from the base radius by RING_STEP per index", () => {
    expect(ringRadius(0)).toBe(RING_BASE_RADIUS);
    expect(ringRadius(1)).toBe(RING_BASE_RADIUS + RING_STEP);
    expect(ringRadius(5)).toBe(RING_BASE_RADIUS + RING_STEP * 5);
  });
});

describe("sparkPosition", () => {
  it("is deterministic for a fixed id", () => {
    const a = sparkPosition(42);
    const b = sparkPosition(42);
    expect(a).toEqual(b);
  });

  it("gives different ids different positions", () => {
    const a = sparkPosition(1);
    const b = sparkPosition(2);
    expect(a).not.toEqual(b);
  });

  it("lands within the spark annulus bounds regardless of id", () => {
    for (const id of [1, 2, 3, 100, 9999, "abc", "lathe-42"]) {
      const { x, z } = sparkPosition(id);
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThanOrEqual(SPARK_INNER - 0.01);
      expect(r).toBeLessThanOrEqual(SPARK_OUTER + 0.01);
    }
  });

  it("treats a numeric id and its string form as the same position (same template input)", () => {
    expect(sparkPosition(42)).toEqual(sparkPosition("42"));
  });
});
