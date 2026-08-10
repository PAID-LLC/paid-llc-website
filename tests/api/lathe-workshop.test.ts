import { describe, expect, it } from "vitest";
import {
  GROUND_RADIUS,
  MAX_RINGS,
  RING_BASE_RADIUS,
  RING_STEP,
  SPARK_INNER,
  SPARK_OUTER,
  columnHeight,
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

// ── The quarry profile ───────────────────────────────────────────────────────
// Added with the 2026-08-09 rebuild. The height field is shared by the terrain
// mesh, everything standing on it, and the residents walking it, so the
// properties that matter are continuity (nothing pops) and monotonicity (the
// canyon only ever gets deeper toward the middle). A discontinuity here would
// show up as figures teleporting a full terrace, which is the exact failure the
// sloped riser exists to prevent.

// ── The colonnade ────────────────────────────────────────────────────────────
// Added 2026-08-10, when the tiered bowl went to the Crucible and the twelve
// commits became twelve standing columns instead of twelve terraces.

describe("columnHeight", () => {
  it("stands the newest commit tallest, so the ring reads as a direction", () => {
    const newest = columnHeight(MAX_RINGS - 1);
    const oldest = columnHeight(0);
    expect(newest).toBeGreaterThan(oldest);
  });

  it("steps evenly, one commit at a time", () => {
    for (let i = 1; i < MAX_RINGS; i++) {
      expect(columnHeight(i) - columnHeight(i - 1)).toBeCloseTo(1.6, 9);
    }
  });

  it("keeps every column standing, even the oldest", () => {
    // A column that reached zero height would delete a real commit from the
    // monument. History here is permanent record; only its warmth fades.
    for (let i = 0; i < MAX_RINGS; i++) expect(columnHeight(i)).toBeGreaterThan(3);
  });

  it("stays clear of the spindle it stands around", () => {
    // The tallest column must not out-top the spindle crown, or the world
    // loses the silhouette it is named for.
    expect(columnHeight(MAX_RINGS - 1)).toBeLessThan(72);
  });
});
