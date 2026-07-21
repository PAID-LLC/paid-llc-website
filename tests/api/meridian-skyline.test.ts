import { describe, expect, it } from "vitest";
import { WARDS } from "@/lib/meridian/engine";
import {
  RING_INNER,
  RING_OUTER,
  WARD_ANGLE_DEG,
  WARD_INNER,
  WARD_OUTER,
  buildWardKit,
  obeliskHeight,
  polar,
  ringColor,
  ringLushness,
  spireBoost,
  structureScale,
  wardAnchor,
  wardTour,
} from "@/lib/meridian/skyline";

// Meridian's massing layer, pinned like Arclight's skyline and Palimpsest's
// terrain: the radial wheel is fixed forever, ward kits are deterministic,
// and live data only ever drives height/color, never layout.

describe("meridian skyline geometry", () => {
  it("pins all six wards at distinct, evenly-spaced angles", () => {
    const angles = WARDS.map((w) => WARD_ANGLE_DEG[w]);
    expect(new Set(angles).size).toBe(6);
    const sorted = [...angles].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBe(60);
    }
  });

  it("places every ward anchor inside the ward radius band", () => {
    for (const ward of WARDS) {
      const [x, z] = wardAnchor(ward);
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThanOrEqual(WARD_INNER);
      expect(r).toBeLessThanOrEqual(WARD_OUTER);
    }
  });

  it("wardTour visits all six wards in the fixed WARDS order", () => {
    const tour = wardTour();
    expect(tour.map((t) => t.ward)).toEqual(WARDS);
  });

  it("polar(0, angle) is always the origin regardless of angle", () => {
    const [x0, z0] = polar(0, 0);
    expect(Math.hypot(x0, z0)).toBe(0);
    const [x1, z1] = polar(0, 137);
    expect(Math.hypot(x1, z1)).toBe(0);
  });
});

describe("ward building kits", () => {
  it("are deterministic for a fixed seed", () => {
    const a = buildWardKit("spire_row", 77);
    const b = buildWardKit("spire_row", 77);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("place every building within the ward's radius band and angular wedge", () => {
    for (const ward of WARDS) {
      const kit = buildWardKit(ward);
      expect(kit.length).toBeGreaterThan(0);
      const centerAngle = WARD_ANGLE_DEG[ward];
      for (const b of kit) {
        const r = Math.hypot(b.x, b.z);
        expect(r).toBeGreaterThanOrEqual(WARD_INNER - 0.01);
        expect(r).toBeLessThanOrEqual(WARD_OUTER + 0.01);
        const angle = (Math.atan2(b.z, b.x) * 180) / Math.PI;
        let delta = angle - centerAngle;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        expect(Math.abs(delta)).toBeLessThanOrEqual(30); // half-spread + fp slop
      }
    }
  });

  it("gives every building a positive footprint and height", () => {
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        expect(b.w).toBeGreaterThan(0);
        expect(b.d).toBeGreaterThan(0);
        expect(b.baseH).toBeGreaterThan(0);
      }
    }
  });
});

describe("live-data-driven scaling (never layout)", () => {
  it("structureScale grows monotonically with level", () => {
    expect(structureScale(1)).toBeLessThan(structureScale(2));
    expect(structureScale(2)).toBeLessThan(structureScale(3));
  });

  it("spireBoost is monotonic in the prosperity index", () => {
    expect(spireBoost(0)).toBeLessThan(spireBoost(50));
    expect(spireBoost(50)).toBeLessThan(spireBoost(100));
  });

  it("obeliskHeight is monotonic in the prosperity index and clamps outside 0-100", () => {
    expect(obeliskHeight(0)).toBeLessThan(obeliskHeight(50));
    expect(obeliskHeight(50)).toBeLessThan(obeliskHeight(100));
    expect(obeliskHeight(100)).toBe(obeliskHeight(150));
    expect(obeliskHeight(0)).toBe(obeliskHeight(-50));
  });

  it("ringLushness runs 0..1 across the index range", () => {
    expect(ringLushness(0)).toBe(0);
    expect(ringLushness(100)).toBe(1);
    expect(ringLushness(50)).toBeCloseTo(0.5, 5);
  });

  it("ringColor is a valid hex at both extremes and differs between them", () => {
    const bust = ringColor(0);
    const boom = ringColor(100);
    expect(bust).toMatch(/^#[0-9a-f]{6}$/);
    expect(boom).toMatch(/^#[0-9a-f]{6}$/);
    expect(bust).not.toBe(boom);
  });
});

describe("frame constants", () => {
  it("keeps the Green Ring strictly outside the wards", () => {
    expect(RING_INNER).toBeGreaterThanOrEqual(WARD_OUTER);
    expect(RING_OUTER).toBeGreaterThan(RING_INNER);
  });
});
