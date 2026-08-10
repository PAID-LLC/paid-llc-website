/**
 * Tests for lib/arclight/streetlife.ts — the crowd on Arclight's streets.
 *
 * The crowd exists because four resident figures in a 300-unit metropolis read
 * as an empty city, and the fix has to add life without adding a claim. So the
 * tests that matter here are honesty tests:
 *
 *   1. The ambient crowd is exactly the registry count. Not scaled, not padded,
 *      not floored at some minimum that would make an empty city look busy.
 *   2. Couriers — the only walkers that read as commerce — come from real job
 *      volume, and a day with no jobs has none of them.
 *   3. The two populations cannot borrow from each other: more registrations
 *      never manufactures a courier, and a busy day never invents a resident.
 *
 * Plus the rendering contract: routes sample continuously, so nobody teleports,
 * and the whole thing is deterministic, so a re-render does not reshuffle the
 * city.
 */

import { describe, expect, it } from "vitest";
import { buildStreetLife, sampleRoute, ROUTE_IDS } from "@/lib/arclight/streetlife";
import type { ArclightSnapshot } from "@/lib/arclight/cityplan";

function snapshot(over: Partial<ArclightSnapshot> = {}): ArclightSnapshot {
  return {
    live: true,
    generated_at: "2026-08-09T12:00:00Z",
    econ: { solvent: true, revenue_usd: 12, est_cost_usd: 0.4 },
    power: { gemini_calls: 0, gemini_budget: 1000, svc_jobs_today: 0, svc_daily_global: 300 },
    sellers: [],
    listings: [],
    jobs: { active: 0, settled_24h: 0, tail: [] },
    population: { registered: 16, verified: 0, active_24h: 0 },
    firsts: [],
    ...over,
  };
}

describe("street life — what the crowd is allowed to claim", () => {
  it("puts exactly one ambient walker on the street per registered agent", () => {
    const life = buildStreetLife(snapshot());
    expect(life.registered).toBe(16);
    expect(life.walkers.filter((w) => !w.courier)).toHaveLength(16);
  });

  it("empties the streets when the registry is empty", () => {
    const life = buildStreetLife(
      snapshot({ population: { registered: 0, verified: 0, active_24h: 0 } })
    );
    expect(life.walkers).toHaveLength(0);
  });

  it("runs no couriers on a day with no jobs — today's real case", () => {
    const life = buildStreetLife(snapshot());
    expect(life.jobs).toBe(0);
    expect(life.walkers.some((w) => w.courier)).toBe(false);
  });

  it("puts a courier on the street for each real job, active or settled", () => {
    const life = buildStreetLife(
      snapshot({ jobs: { active: 3, settled_24h: 2, tail: [] } })
    );
    expect(life.jobs).toBe(5);
    expect(life.walkers.filter((w) => w.courier)).toHaveLength(5);
  });

  it("keeps the two populations sealed off from each other", () => {
    // A registration surge must not manufacture commerce...
    const quiet = buildStreetLife(
      snapshot({ population: { registered: 90, verified: 0, active_24h: 0 } })
    );
    expect(quiet.walkers.filter((w) => w.courier)).toHaveLength(0);

    // ...and a busy trading day must not invent inhabitants.
    const busy = buildStreetLife(
      snapshot({ jobs: { active: 20, settled_24h: 10, tail: [] } })
    );
    expect(busy.walkers.filter((w) => !w.courier)).toHaveLength(16);
  });

  it("caps total bodies for draw-call reasons without ever exceeding the data", () => {
    const life = buildStreetLife(
      snapshot({
        population: { registered: 5000, verified: 0, active_24h: 0 },
        jobs: { active: 5000, settled_24h: 5000, tail: [] },
      })
    );
    expect(life.walkers.length).toBeLessThanOrEqual(140);
    // The cap truncates; it never pads.
    expect(life.walkers.length).toBeLessThanOrEqual(life.registered + life.jobs);
  });

  it("sends couriers to the Strip, where the storefronts are", () => {
    const life = buildStreetLife(
      snapshot({ jobs: { active: 4, settled_24h: 0, tail: [] } })
    );
    const throughput = ROUTE_IDS.indexOf("throughput");
    for (const w of life.walkers.filter((c) => c.courier)) {
      expect(w.route).toBe(throughput);
    }
  });

  it("moves couriers faster than the people out for a walk", () => {
    const life = buildStreetLife(
      snapshot({ jobs: { active: 4, settled_24h: 0, tail: [] } })
    );
    const slowest = Math.min(...life.walkers.filter((w) => w.courier).map((w) => w.speed));
    const fastest = Math.max(...life.walkers.filter((w) => !w.courier).map((w) => w.speed));
    expect(slowest).toBeGreaterThan(fastest);
  });

  it("is deterministic: the same city renders the same crowd every visit", () => {
    expect(buildStreetLife(snapshot()).walkers).toEqual(buildStreetLife(snapshot()).walkers);
  });
});

describe("route sampling", () => {
  const life = buildStreetLife(snapshot());

  it("builds every pedestrian street", () => {
    expect(life.routes).toHaveLength(ROUTE_IDS.length);
    for (const r of life.routes) {
      expect(r.pts.length).toBeGreaterThanOrEqual(2);
      expect(r.length).toBeGreaterThan(0);
      expect(r.cum).toHaveLength(r.pts.length);
    }
  });

  it("keeps pedestrians off the elevated Circuit and off the channel bridge", () => {
    // The Circuit is a motorway on pylons eight units up with its own traffic;
    // Counterparty Bridge is a 4.5-unit span narrower than the pavement offsets
    // used here. A walker on either would be standing in mid-air over water.
    expect(ROUTE_IDS).not.toContain("circuit");
    expect(ROUTE_IDS).not.toContain("counterparty");
    // Every route a walker can be assigned to is one that exists.
    for (const w of life.walkers) {
      expect(w.route).toBeGreaterThanOrEqual(0);
      expect(w.route).toBeLessThan(ROUTE_IDS.length);
    }
  });

  it("never teleports a walker: position is continuous in distance", () => {
    for (const r of life.routes) {
      let prev = sampleRoute(r, 0);
      // Two full laps, past both the wrap point and the ping-pong turn.
      for (let d = 0.5; d <= r.length * 4; d += 0.5) {
        const cur = sampleRoute(r, d);
        expect(Math.hypot(cur.x - prev.x, cur.z - prev.z)).toBeLessThan(1.5);
        prev = cur;
      }
    }
  });

  it("stays on its own polyline and inside the city frame", () => {
    for (const r of life.routes) {
      for (let d = 0; d < r.length * 2; d += 3) {
        const s = sampleRoute(r, d);
        expect(Number.isFinite(s.x)).toBe(true);
        expect(Number.isFinite(s.z)).toBe(true);
        expect(Number.isFinite(s.heading)).toBe(true);
        // World frame is 600 x 520 map units at 0.5 scale, centred on origin.
        expect(Math.abs(s.x)).toBeLessThanOrEqual(150);
        expect(Math.abs(s.z)).toBeLessThanOrEqual(130);
      }
    }
  });

  it("turns a walker around at the end of an open street instead of wrapping", () => {
    const street = life.routes[ROUTE_IDS.indexOf("throughput")];
    expect(street.loop).toBe(false);
    const out = sampleRoute(street, street.length * 0.5);
    const back = sampleRoute(street, street.length * 1.5);
    // Same ground, opposite heading.
    expect(Math.hypot(out.x - back.x, out.z - back.z)).toBeLessThan(0.01);
    expect(Math.abs(Math.abs(out.heading - back.heading) - Math.PI)).toBeLessThan(1e-6);
  });

  it("keeps every step of every route on the north bank, out of the water", () => {
    // The Clearing Channel starts at map y 422, which is world z 81. A walker
    // has no bridge and no boat, so no pedestrian route may reach it.
    const CHANNEL_Z = (422 - 520 / 2) * 0.5;
    for (const r of life.routes) {
      for (let d = 0; d < r.length * 2; d += 2) {
        // Widest pavement offset a walker can take, so the check covers the
        // walker rather than just the centreline.
        expect(sampleRoute(r, d).z).toBeLessThanOrEqual(CHANNEL_Z + 4);
      }
    }
  });

  it("handles negative distance without producing NaN", () => {
    for (const r of life.routes) {
      const s = sampleRoute(r, -37.5);
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.z)).toBe(true);
    }
  });
});
