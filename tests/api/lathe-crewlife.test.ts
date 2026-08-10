/**
 * Tests for lib/lathe/crewlife.ts — who works the Lathe, and what they claim.
 *
 * The Lathe is a foundry that showed four figures standing still under a HUD
 * reading "forge heat 80%". Filling it is easy; filling it honestly is the
 * whole job, and it is easier here than in Arclight to get wrong, because this
 * world has no registry count to lean on. So the tests that matter are the
 * ones that pin what each body is allowed to mean:
 *
 *   1. The crew is exactly the build log. One body per real commit — the same
 *      claim the terraces already make — never scaled, padded, or floored at
 *      some minimum that would make a world nobody has shipped to look busy.
 *   2. Haulage is exactly forge heat, which decays on its own from the last
 *      commit. A forge that has gone cold has an empty ramp.
 *   3. Neither can borrow from the other. Shipping more commits never
 *      manufactures haulage; a hot forge never invents a crew member.
 *
 * Plus the geometry contract, which is what stops the honest numbers from
 * being rendered somewhere absurd: crew walk on ground that exists, the rim
 * road never treads on a ledger row, and the ramp is continuous so nobody
 * teleports down the quarry.
 */

import { describe, expect, it } from "vitest";
import { buildCrewLife, treadRadius, MAX_HAULERS, RAMP_ROUTE } from "@/lib/lathe/crewlife";
import { sampleRoute } from "@/lib/worlds/routes";
import {
  GROUND_RADIUS,
  RIM_RADIUS,
  RING_STEP,
  SPARK_INNER,
  TREAD_FRACTION,
  ringRadius,
  terraceHeightAt,
} from "@/lib/lathe/workshop";

describe("the crew — what the bodies are allowed to claim", () => {
  it("puts exactly one crew member on the ground per real commit", () => {
    const life = buildCrewLife({ commits: 12, heat: 0 });
    expect(life.commits).toBe(12);
    expect(life.walkers.filter((w) => !w.hauler)).toHaveLength(12);
  });

  it("empties the quarry when there is no build log at all", () => {
    const life = buildCrewLife({ commits: 0, heat: 0 });
    expect(life.walkers).toHaveLength(0);
  });

  it("keeps the crew on shift when the forge has gone stone cold", () => {
    // A world nobody has shipped to in a month still has the terraces those
    // commits cut. The crew is BUILT, not BUSY.
    const life = buildCrewLife({ commits: 12, heat: 0 });
    expect(life.walkers.filter((w) => !w.hauler)).toHaveLength(12);
    expect(life.haulers).toBe(0);
  });

  it("runs haul skips in proportion to real forge heat", () => {
    const cold = buildCrewLife({ commits: 12, heat: 0 });
    const warm = buildCrewLife({ commits: 12, heat: 0.5 });
    const hot = buildCrewLife({ commits: 12, heat: 1 });
    expect(cold.haulers).toBe(0);
    expect(hot.haulers).toBe(MAX_HAULERS);
    expect(warm.haulers).toBeGreaterThan(cold.haulers);
    expect(warm.haulers).toBeLessThan(hot.haulers);
  });

  it("never lets heat manufacture a crew member", () => {
    const idle = buildCrewLife({ commits: 4, heat: 0 });
    const blazing = buildCrewLife({ commits: 4, heat: 1 });
    expect(idle.walkers.filter((w) => !w.hauler)).toHaveLength(4);
    expect(blazing.walkers.filter((w) => !w.hauler)).toHaveLength(4);
  });

  it("never lets the build log manufacture a haul skip", () => {
    const few = buildCrewLife({ commits: 1, heat: 0 });
    const many = buildCrewLife({ commits: 200, heat: 0 });
    expect(few.haulers).toBe(0);
    expect(many.haulers).toBe(0);
  });

  it("puts every hauler on the ramp and never a crew member", () => {
    const life = buildCrewLife({ commits: 12, heat: 1 });
    for (const w of life.walkers) {
      expect(w.hauler).toBe(w.route === RAMP_ROUTE);
    }
  });

  it("clamps nonsense inputs rather than rendering them", () => {
    const life = buildCrewLife({ commits: -5, heat: 4 });
    expect(life.walkers.filter((w) => !w.hauler)).toHaveLength(0);
    expect(life.haulers).toBe(MAX_HAULERS);
  });

  it("is deterministic, so a re-render does not reshuffle the shift", () => {
    const a = buildCrewLife({ commits: 12, heat: 0.8 });
    const b = buildCrewLife({ commits: 12, heat: 0.8 });
    expect(a.walkers).toEqual(b.walkers);
  });
});

describe("where the shift can walk", () => {
  it("stands every route on ground that exists", () => {
    const life = buildCrewLife({ commits: 12, heat: 1 });
    for (const route of life.routes) {
      for (const [x, z] of route.pts) {
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(GROUND_RADIUS);
        expect(Number.isFinite(terraceHeightAt(x, z))).toBe(true);
      }
    }
  });

  it("keeps a terrace loop on its own flat tread, not out on the riser", () => {
    // The tread is the walkable strip; the rest of each band is the slope down
    // to the terrace inside it. A loop drifting onto the riser would put the
    // crew on a hillside.
    for (const band of [1, 5, 9]) {
      const r = treadRadius(band);
      expect(r).toBeGreaterThanOrEqual(ringRadius(band));
      expect(r).toBeLessThanOrEqual(ringRadius(band) + RING_STEP * TREAD_FRACTION);
      // Flat: two points on the same loop are at the same elevation.
      expect(terraceHeightAt(r, 0)).toBeCloseTo(terraceHeightAt(0, r), 6);
    }
  });

  it("runs the rim road outside the terraces and inside the ledger sparks", () => {
    const life = buildCrewLife({ commits: 12, heat: 0 });
    for (const [x, z] of life.routes[2].pts) {
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThan(RIM_RADIUS);
      // Sparks are real ledger rows out on the annulus. Walking the crew
      // through them would bury someone's filing under a body.
      expect(r).toBeLessThan(SPARK_INNER);
    }
  });

  it("descends the ramp continuously — no step a skip could fall through", () => {
    const life = buildCrewLife({ commits: 0, heat: 1 });
    const ramp = life.routes[RAMP_ROUTE];
    let prev = sampleRoute(ramp, 0);
    let prevY = terraceHeightAt(prev.x, prev.z);
    for (let d = 1; d <= ramp.length; d += 1) {
      const s = sampleRoute(ramp, d);
      const y = terraceHeightAt(s.x, s.z);
      expect(Math.abs(y - prevY)).toBeLessThan(1.5);
      prev = s;
      prevY = y;
    }
  });

  it("reaches from the rim down to the pit, so the ramp is actually a ramp", () => {
    const ramp = buildCrewLife({ commits: 0, heat: 1 }).routes[RAMP_ROUTE];
    const start = ramp.pts[0];
    const end = ramp.pts[ramp.pts.length - 1];
    expect(terraceHeightAt(start[0], start[1])).toBeCloseTo(0, 1);
    expect(terraceHeightAt(end[0], end[1])).toBeLessThan(-40);
  });

  it("closes every working loop, so nobody walks off the end of a terrace", () => {
    const life = buildCrewLife({ commits: 12, heat: 0 });
    for (let i = 0; i < RAMP_ROUTE; i++) {
      const r = life.routes[i];
      expect(r.loop).toBe(true);
      expect(r.pts[0]).toEqual(r.pts[r.pts.length - 1]);
    }
    // The ramp is the exception on purpose: a skip goes down and comes back up.
    expect(life.routes[RAMP_ROUTE].loop).toBe(false);
  });

  it("actually walks — every body covers ground at its own speed", () => {
    // The renderer drives each body from `sampleRoute(route, offset + t*speed)`,
    // so this is the motion contract itself rather than a proxy for it. Worth
    // pinning analytically: the visual check (diff two frames, watch the crew's
    // lamps move) is confounded by the camera's own auto-rotation, and only
    // separating those told us the 12.7px shift was walking and not the orbit.
    const life = buildCrewLife({ commits: 12, heat: 1 });
    for (const w of life.walkers) {
      const route = life.routes[w.route];
      // Sampled from several starts: a skip sitting exactly on the ramp's
      // turnaround is momentarily still, and that is correct behaviour.
      const best = Math.max(
        ...[0, 0.3, 0.6].map((k) => {
          const d = w.offset + k * route.length;
          const a = sampleRoute(route, d);
          const b = sampleRoute(route, d + w.speed);
          return Math.hypot(b.x - a.x, b.z - a.z);
        })
      );
      expect(best).toBeGreaterThan(w.speed * 0.5);
    }
  });

  it("runs haul skips faster than the crew — they are carrying, not strolling", () => {
    const life = buildCrewLife({ commits: 12, heat: 1 });
    const crew = life.walkers.filter((w) => !w.hauler).map((w) => w.speed);
    const haul = life.walkers.filter((w) => w.hauler).map((w) => w.speed);
    expect(Math.min(...haul)).toBeGreaterThan(Math.max(...crew));
  });

  it("samples continuously along a loop, including across the wrap", () => {
    const loop = buildCrewLife({ commits: 12, heat: 0 }).routes[1];
    for (const d of [0, loop.length * 0.5, loop.length - 0.01]) {
      const a = sampleRoute(loop, d);
      const b = sampleRoute(loop, d + 0.01);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.5);
    }
  });
});
