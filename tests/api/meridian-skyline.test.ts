import { describe, expect, it } from "vitest";
import { WARDS } from "@/lib/meridian/engine";
import { PLACEMENT } from "@/lib/inhabitants/placement";
import {
  FIGURE_HEIGHT,
  GROUND_RADIUS,
  RING_INNER,
  RING_OUTER,
  ROT_JITTER,
  WARD_ANGLE_DEG,
  WARD_INNER,
  WARD_OUTER,
  buildGreenRingKit,
  buildWardKit,
  obeliskHeight,
  polar,
  ringColor,
  ringLushness,
  spireBoost,
  structureScale,
  treeHeight,
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

  it("paves ground out past the tree ring", () => {
    expect(GROUND_RADIUS).toBeGreaterThan(RING_OUTER);
  });
});

// ── Body scale ───────────────────────────────────────────────────────────────
//
// The regression this suite exists for. Meridian shipped as an aerial diagram
// with nothing human-sized in the frame, so its massing was free to mean
// anything; the inhabitants pass later put body-scale figures on the ground and
// settled the question without anyone re-checking the buildings. The result
// stood for three weeks: the Atelier and Archive wards were SHORTER THAN THE
// PEOPLE WALKING THROUGH THEM, and Spire Row's "glass towers" were 2.2 units
// wide at up to 11.8:1.
//
// Flat colour hid all of it. An untextured box has no scale cues at all, which
// is exactly why three passes went by without anyone noticing — it took adding
// a facade grid to make the error visible. These assertions are the cheap way
// to never need that again.

describe("massing against body scale", () => {
  it("pins FIGURE_HEIGHT to the placement entry it describes", () => {
    // If someone retunes Meridian's figure scale, this fails and forces them to
    // look at the buildings too, which is the whole point.
    expect(PLACEMENT.meridian.figure).toBeCloseTo(0.85, 5);
    expect(FIGURE_HEIGHT).toBeCloseTo(4.43 * PLACEMENT.meridian.figure, 5);
  });

  it("makes every building meaningfully taller than a person", () => {
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        // Two body-heights is the floor for something you can walk into.
        expect(b.baseH / FIGURE_HEIGHT).toBeGreaterThan(2);
      }
    }
  });

  it("keeps Spire Row the tallest ward and the Atelier the shortest", () => {
    const tallest = (w: (typeof WARDS)[number]) =>
      Math.max(...buildWardKit(w).map((b) => b.baseH));
    const spire = tallest("spire_row");
    for (const ward of WARDS) {
      if (ward !== "spire_row") expect(tallest(ward)).toBeLessThan(spire);
    }
  });

  it("gives no building a pencil aspect ratio", () => {
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        expect(b.baseH / Math.min(b.w, b.d)).toBeLessThan(7);
      }
    }
  });

  it("keeps the Agora obelisk competitive with the towers it centres", () => {
    // The obelisk is the city's prosperity gauge. If the banks out-top it at
    // boom, the gauge stops reading as civic and starts reading as decoration.
    const spireBoom =
      Math.max(...buildWardKit("spire_row").map((b) => b.baseH)) *
      structureScale(3) *
      spireBoost(100);
    expect(obeliskHeight(100)).toBeGreaterThan(spireBoom * 0.6);
    expect(obeliskHeight(0)).toBeGreaterThan(FIGURE_HEIGHT * 4);
  });

  it("grows trees to real trees rather than shrubs", () => {
    const heights = buildGreenRingKit().map((t) => treeHeight(t) / FIGURE_HEIGHT);
    // A floor of 2x on the smallest, not on every tree: a belt with no small
    // trees in it is a colonnade. What this is actually guarding against is the
    // old ring, where the TALLEST tree was under 4 units and the whole belt read
    // as undergrowth.
    expect(Math.min(...heights)).toBeGreaterThan(2);
    expect(Math.max(...heights)).toBeGreaterThan(5);
  });
});

// ── Constraints the surface layer imposes on the massing layer ───────────────

describe("triplanar compatibility", () => {
  it("keeps every facade within the blend tolerance of a world axis", () => {
    // Shared materials sample triplanar in WORLD space, blending three
    // projections by normal^4. A facade turned 45° draws two of them at 50/50
    // and visibly ghosts. Inside ROT_JITTER of an axis the blend is under 4%.
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        // A box has 4-fold symmetry, so only the offset within a quarter turn
        // matters. Fold to [-45°, 45°] and it must be inside the jitter.
        const q = Math.PI / 2;
        let off = ((b.rotY % q) + q) % q;
        if (off > q / 2) off -= q;
        expect(Math.abs(off)).toBeLessThanOrEqual(ROT_JITTER + 1e-9);
      }
    }
  });
});

// ── Footprints, not just centre points ───────────────────────────────────────

describe("ward footprints", () => {
  it("keeps a rotated building's whole footprint inside the radius band", () => {
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        const r = Math.hypot(b.x, b.z);
        const reach = Math.hypot(b.w, b.d) / 2;
        expect(r - reach).toBeGreaterThanOrEqual(WARD_INNER - 0.01);
        expect(r + reach).toBeLessThanOrEqual(WARD_OUTER + 0.01);
      }
    }
  });

  it("never lets a corner cross into the neighbouring ward", () => {
    for (const ward of WARDS) {
      for (const b of buildWardKit(ward)) {
        const r = Math.hypot(b.x, b.z);
        const reach = Math.hypot(b.w, b.d) / 2;
        let delta = (Math.atan2(b.z, b.x) * 180) / Math.PI - WARD_ANGLE_DEG[ward];
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        const corner =
          Math.abs(delta) + (Math.asin(Math.min(1, reach / r)) * 180) / Math.PI;
        expect(corner).toBeLessThanOrEqual(30);
      }
    }
  });

  it("caches per seed, not per ward", () => {
    // Keying by ward alone let the first caller with a non-default seed poison
    // every later caller, which made the determinism test order-dependent.
    const seeded = buildWardKit("atelier", 4242);
    const dflt = buildWardKit("atelier");
    expect(JSON.stringify(seeded)).not.toBe(JSON.stringify(dflt));
    expect(JSON.stringify(buildWardKit("atelier", 4242))).toBe(JSON.stringify(seeded));
  });
});
