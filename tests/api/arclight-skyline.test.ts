import { describe, expect, it } from "vitest";
import { CIRCUIT, FRAME } from "@/lib/arclight/cityplan";
import {
  WORLD_SCALE,
  buildSkyline,
  circuitPath,
  circuitPointAt,
  lotBlocked,
  toWorld,
} from "@/lib/arclight/skyline";

// The 3D read follows the same contract as the map: hand-authored macro
// geography, seeded micro detail, nothing random between visits. These tests
// pin the world-unit mapping, the lot grid's respect for reserved ground, and
// the circuit path math the traffic runs on.

describe("arclight skyline", () => {
  it("pins the map→world transform", () => {
    expect(toWorld(FRAME.w / 2, FRAME.h / 2)).toEqual([0, 0]);
    expect(toWorld(550, 263)).toEqual([125, 1.5]); // the Mint
    expect(toWorld(0, 0)).toEqual([-150, -130]);
  });

  it("builds a real city: a stable lot grid with bounded windows", () => {
    const a = buildSkyline();
    const b = buildSkyline();
    // Cached singleton — and structurally identical on repeat compiles.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.lots.length).toBeGreaterThan(60);
    expect(a.windows.length).toBeGreaterThan(300);
    expect(a.windows.length).toBeLessThanOrEqual(2400);
    for (const w of a.windows) {
      expect(w.threshold).toBeGreaterThanOrEqual(0);
      expect(w.threshold).toBeLessThan(1);
      expect([0, 1, 2]).toContain(w.palette);
    }
  });

  it("keeps every lot off reserved ground (roads, landmarks, sites)", () => {
    const { lots } = buildSkyline();
    for (const l of lots) {
      const mx = l.x / WORLD_SCALE + FRAME.w / 2;
      const my = l.z / WORLD_SCALE + FRAME.h / 2;
      expect(lotBlocked(mx, my)).toBe(false);
    }
  });

  it("computes the circuit loop the traffic rides", () => {
    const path = circuitPath();
    expect(path.pts.length).toBe(CIRCUIT.length);
    // Axis-aligned loop perimeter: 1380 map units → 690 world units.
    expect(path.total).toBe(690);
    const start = circuitPointAt(path, 0);
    expect([start.x, start.z]).toEqual(toWorld(CIRCUIT[0][0], CIRCUIT[0][1]));
    // Any point on the loop must sit on an axis-aligned segment.
    for (const t of [0.13, 0.37, 0.52, 0.78, 0.94]) {
      const p = circuitPointAt(path, t);
      const onAxis = path.pts.some(
        ([px, pz]) => Math.abs(p.x - px) < 1e-9 || Math.abs(p.z - pz) < 1e-9
      );
      expect(onAxis).toBe(true);
    }
    // Direction vectors are unit-length.
    const mid = circuitPointAt(path, 0.4);
    expect(Math.hypot(mid.dx, mid.dz)).toBeCloseTo(1, 9);
  });
});
