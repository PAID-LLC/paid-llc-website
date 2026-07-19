import { describe, expect, it } from "vitest";
import {
  ARCLIGHT_SEED,
  CIRCUIT,
  DISTRICTS,
  buildCityPlan,
  polyPath,
  type ArclightSnapshot,
} from "@/lib/arclight/cityplan";

// Arclight is a compiler world: the city must be a deterministic function of
// the snapshot, the geography must never move, and blackouts must derive from
// the real cost caps. These tests pin all three contracts.

function snapshot(over: Partial<ArclightSnapshot> = {}): ArclightSnapshot {
  return {
    live: true,
    generated_at: "2026-07-18T12:00:00Z",
    econ: { solvent: true, revenue_usd: 12, est_cost_usd: 0.4 },
    power: { gemini_calls: 100, gemini_budget: 1000, svc_jobs_today: 10, svc_daily_global: 300 },
    sellers: [
      {
        agent_name: "TheCurator",
        listings: 20,
        first_listed_at: "2026-05-01T00:00:00Z",
        sales_count: 4,
        gross_cents: 5600,
        last_sale_at: "2026-07-17T09:00:00Z",
      },
      {
        agent_name: "Newcomer",
        listings: 1,
        first_listed_at: "2026-07-10T00:00:00Z",
        sales_count: 0,
        gross_cents: 0,
        last_sale_at: null,
      },
    ],
    listings: [
      { id: 1, product_name: "Website Audit Brief", price_cents: 500, listing_type: "service", seller: "TheCurator", created_at: "2026-05-01T00:00:00Z" },
      { id: 2, product_name: "AI Guide", price_cents: 900, listing_type: "digital_good", seller: "TheCurator", created_at: "2026-05-02T00:00:00Z" },
    ],
    jobs: {
      active: 3,
      settled_24h: 2,
      tail: [{ title: "Website Audit Brief", seller: "TheCurator", credits: 25, at: "2026-07-18T10:00:00Z" }],
    },
    population: { registered: 40, verified: 12, active_24h: 10 },
    firsts: [],
    ...over,
  };
}

describe("arclight cityplan", () => {
  it("is deterministic: same snapshot compiles to an identical city", () => {
    const snap = snapshot();
    const a = buildCityPlan(snap);
    const b = buildCityPlan(structuredClone(snap));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps the macro-geography fixed (the map people learned)", () => {
    // The seed and the Circuit are load-bearing constants — changing either
    // rearranges a city visitors have learned. Deliberate changes must update
    // this pin AND the spec.
    expect(ARCLIGHT_SEED).toBe(0xa2c117);
    expect(polyPath(CIRCUIT)).toBe("M115,90 L420,90 L420,475 L300,475 L300,390 L115,390 Z");
    expect(DISTRICTS.map((d) => d.id)).toEqual([
      "stacks", "old_grid", "strip", "exchange", "dockyards", "foundry",
    ]);
  });

  it("grows Exchange towers monotonically with cumulative sales", () => {
    const poor = buildCityPlan(snapshot()).towers.find((t) => t.seller === "Newcomer")!;
    const rich = buildCityPlan(snapshot()).towers.find((t) => t.seller === "TheCurator")!;
    expect(rich.h).toBeGreaterThan(poor.h);
    expect(rich.lit).toBe(true);
    expect(poor.lit).toBe(false);

    const richer = snapshot();
    richer.sellers[0].gross_cents = 100_000;
    const taller = buildCityPlan(richer).towers.find((t) => t.seller === "TheCurator")!;
    expect(taller.h).toBeGreaterThan(rich.h);
  });

  it("assigns tower slots by seniority, stable as sellers arrive", () => {
    const plan = buildCityPlan(snapshot());
    expect(plan.towers[0].seller).toBe("TheCurator");
    expect(plan.towers[1].seller).toBe("Newcomer");
    expect(plan.towers[0].x).not.toBe(plan.towers[1].x);
  });

  it("derives blackouts from the hotter of the two real cost caps", () => {
    expect(buildCityPlan(snapshot()).blackoutLevel).toBe(0);

    const brown = snapshot();
    brown.power.gemini_calls = 750; // 75% of budget
    const b1 = buildCityPlan(brown);
    expect(b1.blackoutLevel).toBe(1);
    expect(b1.dim.foundry).toBeGreaterThan(0);
    expect(b1.dim.exchange).toBe(0);

    const partial = snapshot();
    partial.power.svc_jobs_today = 285; // 95% of svc cap
    const b2 = buildCityPlan(partial);
    expect(b2.blackoutLevel).toBe(2);
    expect(b2.dim.strip).toBeGreaterThan(0);

    const full = snapshot();
    full.power.gemini_calls = 1000;
    const b3 = buildCityPlan(full);
    expect(b3.blackoutLevel).toBe(3);
    expect(b3.dim.exchange).toBeGreaterThan(0);
    expect(b3.load).toBe(1);
  });

  it("flickers the Mint on a deficit day, steady when solvent", () => {
    expect(buildCityPlan(snapshot()).mintBeam).toBe("steady");
    const deficit = snapshot({ econ: { solvent: false, revenue_usd: 0, est_cost_usd: 1 } });
    expect(buildCityPlan(deficit).mintBeam).toBe("flicker");
  });

  it("lights hab cells at the honest active ratio and caps freight sleds", () => {
    const plan = buildCityPlan(snapshot());
    expect(plan.habs.totalCells).toBe(40);
    expect(plan.habs.litCells.length).toBe(10); // 10 of 40 active
    expect(plan.sleds.length).toBe(3);
    for (const s of plan.sleds) {
      expect(s.along).toBeGreaterThanOrEqual(0);
      expect(s.along).toBeLessThan(1);
    }

    const busy = snapshot();
    busy.jobs.active = 50;
    expect(buildCityPlan(busy).sleds.length).toBe(9); // channel holds nine
  });

  it("renders an empty ledger as a dark, honest city — never an error", () => {
    const empty = snapshot({
      sellers: [],
      listings: [],
      jobs: { active: 0, settled_24h: 0, tail: [] },
      population: { registered: 0, verified: 0, active_24h: 0 },
    });
    const plan = buildCityPlan(empty);
    expect(plan.towers).toEqual([]);
    expect(plan.storefronts).toEqual([]);
    expect(plan.sleds).toEqual([]);
    expect(plan.habs.totalCells).toBe(1); // the field renders, unlit
    expect(plan.habs.litCells).toEqual([]);
    expect(plan.traffic).toBe(0);
  });
});
