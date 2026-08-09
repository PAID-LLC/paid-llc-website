import { describe, expect, it } from "vitest";
import {
  GROUND_RADIUS,
  MAX_RINGS,
  PIT_DROP,
  PIT_FLOOR,
  RIM_RADIUS,
  RING_BASE_RADIUS,
  RING_STEP,
  SPARK_INNER,
  SPARK_OUTER,
  TERRACE_STEP,
  ringRadius,
  sparkPosition,
  terraceElevation,
  terraceHeightAt,
  terraceProfile,
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

// ── The quarry profile ───────────────────────────────────────────────────────
// Added with the 2026-08-09 rebuild. The height field is shared by the terrain
// mesh, everything standing on it, and the residents walking it, so the
// properties that matter are continuity (nothing pops) and monotonicity (the
// canyon only ever gets deeper toward the middle). A discontinuity here would
// show up as figures teleporting a full terrace, which is the exact failure the
// sloped riser exists to prevent.

describe("terrace elevation", () => {
  it("puts the outermost ring level with the rim and the oldest ring deepest", () => {
    expect(terraceElevation(MAX_RINGS - 1)).toBeCloseTo(0, 10);
    expect(terraceElevation(0)).toBeCloseTo(-(MAX_RINGS - 1) * TERRACE_STEP, 6);
  });

  it("drops exactly one step per ring inward", () => {
    for (let i = 1; i < MAX_RINGS; i++) {
      expect(terraceElevation(i) - terraceElevation(i - 1)).toBeCloseTo(TERRACE_STEP, 6);
    }
  });

  it("keeps the spark annulus out on the flat rim, where sparkPosition put it", () => {
    // The rebuild must not move a single ledger row. Every spark sits at y=0.
    expect(SPARK_INNER).toBeGreaterThan(RIM_RADIUS);
    for (const id of [1, 7, 42, 999, "abc"]) {
      const { x, z } = sparkPosition(id);
      expect(terraceHeightAt(x, z)).toBe(0);
    }
  });
});

describe("terraceHeightAt", () => {
  it("is flat at and beyond the rim, all the way to the ground edge", () => {
    expect(terraceHeightAt(RIM_RADIUS, 0)).toBe(0);
    expect(terraceHeightAt(GROUND_RADIUS, 0)).toBe(0);
    expect(terraceHeightAt(0, -GROUND_RADIUS)).toBe(0);
  });

  it("bottoms out at the pit floor in the middle", () => {
    expect(terraceHeightAt(0, 0)).toBeCloseTo(PIT_FLOOR, 6);
    expect(PIT_FLOOR).toBeCloseTo(terraceElevation(0) - PIT_DROP, 6);
  });

  it("is radially symmetric — the quarry is a revolution", () => {
    for (const r of [4, 12, 33, 67, 104]) {
      const heights = [0, 0.7, 1.9, 3.3, 5.1].map((a) =>
        terraceHeightAt(Math.cos(a) * r, Math.sin(a) * r)
      );
      for (const h of heights) expect(h).toBeCloseTo(heights[0], 6);
    }
  });

  it("never rises going inward", () => {
    let prev = terraceHeightAt(GROUND_RADIUS, 0);
    for (let r = GROUND_RADIUS; r >= 0; r -= 0.25) {
      const h = terraceHeightAt(r, 0);
      expect(h, `rose at r=${r}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = h;
    }
  });

  it("is continuous everywhere — no step a walking figure could pop through", () => {
    // A resident crossing a riser must ramp down it. The largest legal change
    // over a quarter unit is well under a full terrace step.
    let prev = terraceHeightAt(0, 0);
    for (let r = 0; r <= GROUND_RADIUS; r += 0.25) {
      const h = terraceHeightAt(r, 0);
      expect(Math.abs(h - prev), `jumped at r=${r}`).toBeLessThan(TERRACE_STEP * 0.5);
      prev = h;
    }
  });

  it("stands the crew's whole spread on real terraces, not all on the floor", () => {
    // lib/inhabitants/placement.ts maps the roam disc onto radius 78. If that
    // spread only ever sampled the pit, widening it in placement.ts would have
    // been pointless.
    const depths = [10, 25, 45, 62, 78].map((r) => terraceHeightAt(r, 0));
    expect(new Set(depths.map((d) => d.toFixed(2))).size).toBe(depths.length);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(TERRACE_STEP * 5);
  });
});

describe("terraceProfile", () => {
  it("runs from the pit floor out to the ground edge, monotonically outward", () => {
    const profile = terraceProfile();
    expect(profile[0][0]).toBe(0);
    expect(profile[0][1]).toBeCloseTo(PIT_FLOOR, 6);
    expect(profile[profile.length - 1]).toEqual([GROUND_RADIUS, 0]);
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i][0], `radius went backwards at ${i}`).toBeGreaterThan(profile[i - 1][0]);
      expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1] - 1e-9);
    }
  });

  it("agrees with the height field it is revolved from", () => {
    for (const [r, y] of terraceProfile()) {
      expect(terraceHeightAt(r, 0)).toBeCloseTo(y, 6);
    }
  });

  it("stays cheap enough to be one mesh", () => {
    // Revolved at 144 segments, so the vertex count is profile.length * 145.
    // A few hundred points is a detailed canyon; a few thousand is a mistake.
    expect(terraceProfile().length).toBeLessThan(200);
    expect(terraceProfile().length).toBeGreaterThan(MAX_RINGS * 4);
  });
});
