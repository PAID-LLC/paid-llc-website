/**
 * Tests for lib/pit/geometry.ts — the tiered bowl, as a shape.
 *
 * Moved here from the Lathe's own suite on 2026-08-10 when the bowl moved to
 * lib/pit and became the Crucible's arena. Nothing in these tests knows what a
 * tier MEANS, which is the point: this file pins a shape, and worlds decide
 * separately what they compile onto it.
 */

import { describe, expect, it } from "vitest";
import {
  GROUND_RADIUS,
  PIT_DROP,
  PIT_FLOOR,
  PLANT_INNER,
  PLANT_OUTER,
  RIM_RADIUS,
  TIERS,
  TIER_BASE_RADIUS,
  TIER_DROP,
  TIER_STEP,
  lavaLevel,
  lavaRadius,
  pitHeightAt,
  pitProfile,
  rimPlant,
  tierElevation,
  tierRadius,
} from "@/lib/pit/geometry";

describe("terrace elevation", () => {
  it("puts the outermost ring level with the rim and the oldest ring deepest", () => {
    expect(tierElevation(TIERS - 1)).toBeCloseTo(0, 10);
    expect(tierElevation(0)).toBeCloseTo(-(TIERS - 1) * TIER_DROP, 6);
  });

  it("drops exactly one step per ring inward", () => {
    for (let i = 1; i < TIERS; i++) {
      expect(tierElevation(i) - tierElevation(i - 1)).toBeCloseTo(TIER_DROP, 6);
    }
  });

  it("keeps the whole plant belt out on the flat rim", () => {
    // Anything beyond RIM_RADIUS stands on level ground, which is what lets a
    // renderer place the plant at y=0 without consulting the height field.
    expect(PLANT_INNER).toBeGreaterThan(RIM_RADIUS);
    for (const r of [PLANT_INNER, (PLANT_INNER + PLANT_OUTER) / 2, PLANT_OUTER]) {
      expect(pitHeightAt(r, 0)).toBe(0);
    }
  });
});

describe("pitHeightAt", () => {
  it("is flat at and beyond the rim, all the way to the ground edge", () => {
    expect(pitHeightAt(RIM_RADIUS, 0)).toBe(0);
    expect(pitHeightAt(GROUND_RADIUS, 0)).toBe(0);
    expect(pitHeightAt(0, -GROUND_RADIUS)).toBe(0);
  });

  it("bottoms out at the pit floor in the middle", () => {
    expect(pitHeightAt(0, 0)).toBeCloseTo(PIT_FLOOR, 6);
    expect(PIT_FLOOR).toBeCloseTo(tierElevation(0) - PIT_DROP, 6);
  });

  it("is radially symmetric — the quarry is a revolution", () => {
    for (const r of [4, 12, 33, 67, 104]) {
      const heights = [0, 0.7, 1.9, 3.3, 5.1].map((a) =>
        pitHeightAt(Math.cos(a) * r, Math.sin(a) * r)
      );
      for (const h of heights) expect(h).toBeCloseTo(heights[0], 6);
    }
  });

  it("never rises going inward", () => {
    let prev = pitHeightAt(GROUND_RADIUS, 0);
    for (let r = GROUND_RADIUS; r >= 0; r -= 0.25) {
      const h = pitHeightAt(r, 0);
      expect(h, `rose at r=${r}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = h;
    }
  });

  it("is continuous everywhere — no step a walking figure could pop through", () => {
    // A resident crossing a riser must ramp down it. The largest legal change
    // over a quarter unit is well under a full terrace step.
    let prev = pitHeightAt(0, 0);
    for (let r = 0; r <= GROUND_RADIUS; r += 0.25) {
      const h = pitHeightAt(r, 0);
      expect(Math.abs(h - prev), `jumped at r=${r}`).toBeLessThan(TIER_DROP * 0.5);
      prev = h;
    }
  });

  it("stands the crew's whole spread on real terraces, not all on the floor", () => {
    // lib/inhabitants/placement.ts maps the roam disc onto radius 78. If that
    // spread only ever sampled the pit, widening it in placement.ts would have
    // been pointless.
    const depths = [10, 25, 45, 62, 78].map((r) => pitHeightAt(r, 0));
    expect(new Set(depths.map((d) => d.toFixed(2))).size).toBe(depths.length);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(TIER_DROP * 5);
  });
});

describe("pitProfile", () => {
  it("runs from the pit floor out to the ground edge, monotonically outward", () => {
    const profile = pitProfile();
    expect(profile[0][0]).toBe(0);
    expect(profile[0][1]).toBeCloseTo(PIT_FLOOR, 6);
    expect(profile[profile.length - 1]).toEqual([GROUND_RADIUS, 0]);
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i][0], `radius went backwards at ${i}`).toBeGreaterThan(profile[i - 1][0]);
      expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1] - 1e-9);
    }
  });

  it("agrees with the height field it is revolved from", () => {
    for (const [r, y] of pitProfile()) {
      expect(pitHeightAt(r, 0)).toBeCloseTo(y, 6);
    }
  });

  it("stays cheap enough to be one mesh", () => {
    // Revolved at 144 segments, so the vertex count is profile.length * 145.
    // A few hundred points is a detailed canyon; a few thousand is a mistake.
    expect(pitProfile().length).toBeLessThan(200);
    expect(pitProfile().length).toBeGreaterThan(TIERS * 4);
  });
});

// ── The melt ─────────────────────────────────────────────────────────────────
// The pool used to sit at a fixed offset above the pit floor, which on this
// bowl is six units across inside a four-hundred-unit world. It is a level now,
// keyed to real forge heat, and these pin the two things that could go wrong:
// lava outside the rock that holds it, and a cold forge deleting the world's
// only warm light.

describe("lavaLevel", () => {
  it("rises with forge heat and never leaves the pit", () => {
    const cold = lavaLevel(0);
    const warm = lavaLevel(0.5);
    const hot = lavaLevel(1);
    expect(cold).toBeLessThan(warm);
    expect(warm).toBeLessThan(hot);
    expect(cold).toBeGreaterThan(PIT_FLOOR);
    expect(hot).toBeLessThan(0);
  });

  it("banks the furnace rather than emptying it when the forge goes cold", () => {
    // Forge heat decays continuously from the last commit, so a quiet fortnight
    // reaches heat 0 on its own. If that drained the pit, the world's only warm
    // light would vanish and idle would render as broken.
    expect(lavaLevel(0)).toBeGreaterThan(PIT_FLOOR);
    expect(lavaRadius(lavaLevel(0))).toBeGreaterThan(0);
  });

  it("clamps heat outside 0..1 rather than flooding the quarry", () => {
    expect(lavaLevel(-3)).toBe(lavaLevel(0));
    expect(lavaLevel(9)).toBe(lavaLevel(1));
  });
});

describe("lavaRadius", () => {
  it("keeps the melt surface inside the bowl that holds it, at every heat", () => {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      const y = lavaLevel(h);
      const r = lavaRadius(y);
      // The ground at the melt's edge is at or below the melt: lava cannot be
      // sitting on top of rock that rises above it.
      expect(pitHeightAt(r, 0)).toBeLessThanOrEqual(y + 1e-6);
      // And one step further out, the rock has risen above the surface — so the
      // radius really is the shoreline and not just some radius inside it.
      expect(pitHeightAt(r + 0.5, 0)).toBeGreaterThan(y);
    }
  });

  it("grows monotonically as the melt rises", () => {
    let prev = -1;
    for (let h = 0; h <= 1.0001; h += 0.1) {
      const r = lavaRadius(lavaLevel(h));
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it("is large enough at working heat to light the world it is in", () => {
    // The defect this replaced: a 6-unit pool in a 440-unit-wide world. At the
    // heat a shipping week produces, the melt has to be visible.
    expect(lavaRadius(lavaLevel(0.8))).toBeGreaterThan(20);
  });
});

// ── The foundry town ─────────────────────────────────────────────────────────

describe("rimPlant", () => {
  const town = rimPlant();

  it("is deterministic, so the skyline does not reshuffle between visits", () => {
    expect(rimPlant()).toEqual(town);
  });

  it("stands entirely on the flat rim, outside the terraces", () => {
    for (const p of town) {
      const r = Math.hypot(p.x, p.z);
      expect(r).toBeGreaterThanOrEqual(PLANT_INNER - 1e-9);
      expect(r).toBeLessThanOrEqual(PLANT_OUTER + 1e-9);
      expect(r).toBeGreaterThan(RIM_RADIUS);
      expect(pitHeightAt(p.x, p.z)).toBe(0);
    }
  });

  it("clears the spark annulus, so no ledger row is buried by scenery", () => {
    for (const p of town) {
      // Half the footprint diagonal is the worst case for a rotated box.
      const reach = Math.hypot(p.w, p.d) / 2;
      expect(Math.hypot(p.x, p.z) - reach).toBeGreaterThan(PLANT_INNER - 2);
    }
  });

  it("stays inside the world", () => {
    for (const p of town) {
      expect(Math.hypot(p.x, p.z) + Math.hypot(p.w, p.d) / 2).toBeLessThan(GROUND_RADIUS);
    }
  });

  it("has a skyline — not a ring of sheds", () => {
    // The defect this replaced: 34 boxes averaging 7 units tall on a rim 109
    // units out, which from any camera that frames the quarry is a texture.
    const tallest = Math.max(...town.map((p) => p.h));
    const tall = town.filter((p) => p.h > 30).length;
    expect(tallest).toBeGreaterThan(55);
    expect(tall).toBeGreaterThan(12);
    // Silos carry the height range the furnace houses used to, or removing the
    // boxes would have flattened the platform to a ring of thin flues.
    expect(Math.max(...town.filter((p) => p.kind === "silo").map((p) => p.h))).toBeGreaterThan(30);
  });

  it("is cylinders only — no square or rectangular structures on the platform", () => {
    // Travis's call after seeing the first pass. Pinned rather than left to the
    // renderer: a box kind reappearing here would silently put rectangles back
    // on the rim even if the renderer only knows how to draw cylinders.
    const kinds = new Set(town.map((p) => p.kind));
    expect(kinds).toEqual(new Set(["stack", "silo"]));
    // Round means square in plan: width and depth are the same diameter.
    for (const p of town) expect(p.w).toBeCloseTo(p.d, 9);
  });

  it("kept the piece count when the boxes went, rather than thinning the rim", () => {
    // Removing two of four kinds could have emptied ~60% of the platform. The
    // slots are redistributed to stacks and silos instead.
    expect(town.length).toBeGreaterThan(70);
  });

  it("faces the hearth: denser and taller on the side the work is on", () => {
    // Every working town has a side that faces the work, and a perfectly even
    // ring reads as a fence. The hearth sits at +z.
    const near = town.filter((p) => p.z > 0);
    const far = town.filter((p) => p.z <= 0);
    expect(near.length).toBeGreaterThan(far.length);
    const mean = (xs: typeof town) => xs.reduce((s, p) => s + p.h, 0) / xs.length;
    expect(mean(near)).toBeGreaterThan(mean(far));
  });

  it("stays cheap enough to instance in four draw calls", () => {
    expect(town.length).toBeLessThan(140);
  });
});
