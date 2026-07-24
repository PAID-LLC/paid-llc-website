import { describe, expect, it } from "vitest";
import { gateHeat, statusFor, type DepartureRow, type GateId } from "@/lib/waypoint/board";
import { buildCityPlan, CONCOURSE, GATES } from "@/lib/waypoint/cityplan";
import { compileWaypointLegends } from "@/lib/waypoint/legends";

// Waypoint's compile-time math, pinned like every other compile-class world's:
// gate heat is a pure function of hours-since-last-event (no ticks to
// persist, same e-folding convention as the Crucible's heatIndex and the
// Lathe's forgeHeat), the CityPlan merge is a pure function over fixed
// geometry + a Departure Board, and the legends compiler is a pure replay
// over rows + counts.

function row(gate: GateId, hoursSince: number | null, overrides: Partial<DepartureRow> = {}): DepartureRow {
  const heat = gateHeat(hoursSince);
  return {
    gate,
    name: `The ${gate} Gate`,
    world: gate,
    room: gate,
    headline: `${gate} happened`,
    at: hoursSince === null ? null : new Date(Date.now() - hoursSince * 3_600_000).toISOString(),
    hours_since: hoursSince,
    heat,
    status: statusFor(heat),
    ...overrides,
  };
}

describe("gateHeat", () => {
  it("is 0 when there's no event yet", () => {
    expect(gateHeat(null)).toBe(0);
  });

  it("is 1 at zero hours since the last event", () => {
    expect(gateHeat(0)).toBe(1);
  });

  it("uses the e-folding convention, not a true half-life, at HALF_LIFE_HOURS", () => {
    // Same convention as the Crucible's arena.ts and the Lathe's forge.ts:
    // Math.exp(-hours/HALF_LIFE) hits ~0.368 at hours=HALF_LIFE, not 0.5.
    expect(gateHeat(48)).toBeCloseTo(Math.exp(-1), 5);
  });

  it("decays toward 0 for very old events and clamps negative hours to the present", () => {
    expect(gateHeat(10_000)).toBeCloseTo(0, 5);
    expect(gateHeat(-5)).toBe(1);
  });
});

describe("statusFor", () => {
  it("is lit at or above 0.5 heat", () => {
    expect(statusFor(0.5)).toBe("lit");
    expect(statusFor(1)).toBe("lit");
  });

  it("is boarding between 0.15 and 0.5", () => {
    expect(statusFor(0.15)).toBe("boarding");
    expect(statusFor(0.49)).toBe("boarding");
  });

  it("is dark below 0.15", () => {
    expect(statusFor(0.14)).toBe("dark");
    expect(statusFor(0)).toBe("dark");
  });
});

describe("buildCityPlan", () => {
  it("returns exactly the 7 fixed gates in their fixed geometry order, regardless of row order", () => {
    const rows: DepartureRow[] = [
      row("forge", 1),
      row("frontier", 2),
      row("deep", 3),
      row("bazaar", 4),
      row("archive", 5),
      row("vault", 6),
      row("pit", 7),
    ];
    const plan = buildCityPlan(rows, 0.5);
    expect(plan.gates.map((g) => g.id)).toEqual(GATES.map((g) => g.id));
    expect(plan.gates.every((g) => g.y === CONCOURSE.y)).toBe(true);
  });

  it("merges each row's dynamic data onto its gate's fixed position", () => {
    const rows: DepartureRow[] = GATES.map((g) => row(g.id, 5, { headline: `${g.id} custom headline` }));
    const plan = buildCityPlan(rows, 0.5);
    const frontier = plan.gates.find((g) => g.id === "frontier");
    expect(frontier?.headline).toBe("frontier custom headline");
    expect(frontier?.x).toBe(GATES.find((g) => g.id === "frontier")!.x);
  });

  it("falls back to a dark, no-traffic gate when a row is missing", () => {
    const plan = buildCityPlan([], 0);
    expect(plan.gates).toHaveLength(7);
    expect(plan.gates.every((g) => g.status === "dark")).toBe(true);
    expect(plan.gates.every((g) => g.headline === "No traffic recorded yet.")).toBe(true);
  });

  it("clamps traffic to 0..1", () => {
    expect(buildCityPlan([], 5).traffic).toBe(1);
    expect(buildCityPlan([], -5).traffic).toBe(0);
  });
});

describe("compileWaypointLegends", () => {
  const gates: GateId[] = ["frontier", "deep", "bazaar", "archive", "vault", "pit", "forge"];

  it("names the highest 7d count as Busiest Gate", () => {
    const rows = gates.map((g) => row(g, 10));
    const counts = Object.fromEntries(gates.map((g, i) => [g, i])) as Record<GateId, number>;
    const legends = compileWaypointLegends(rows, counts);
    const busiest = legends.find((l) => l.title === "Busiest Gate");
    expect(busiest?.detail).toContain("The forge Gate");
    expect(busiest?.detail).toContain("6 departures");
  });

  it("reports no traffic when every gate's weekly count is zero", () => {
    const rows = gates.map((g) => row(g, 10));
    const counts = Object.fromEntries(gates.map((g) => [g, 0])) as Record<GateId, number>;
    const legends = compileWaypointLegends(rows, counts);
    expect(legends.find((l) => l.title === "Busiest Gate")?.detail).toBe(
      "No gate has logged traffic this week yet."
    );
  });

  it("names the largest hours_since as Longest Layover and the smallest as Freshest Departure", () => {
    const rows: DepartureRow[] = [
      row("frontier", 100),
      row("deep", 2),
      row("bazaar", 50),
      row("archive", null),
      row("vault", 30),
      row("pit", 10),
      row("forge", 1),
    ];
    const counts = Object.fromEntries(gates.map((g) => [g, 1])) as Record<GateId, number>;
    const legends = compileWaypointLegends(rows, counts);
    expect(legends.find((l) => l.title === "Longest Layover")?.detail).toContain("The frontier Gate");
    expect(legends.find((l) => l.title === "Freshest Departure")?.detail).toContain("The forge Gate");
  });

  it("handles every gate having no event yet", () => {
    const rows = gates.map((g) => row(g, null));
    const counts = Object.fromEntries(gates.map((g) => [g, 0])) as Record<GateId, number>;
    const legends = compileWaypointLegends(rows, counts);
    expect(legends.find((l) => l.title === "Longest Layover")?.detail).toBe("Every gate is freshly boarded.");
    expect(legends.find((l) => l.title === "Freshest Departure")?.detail).toBe("No departures recorded yet.");
  });
});
