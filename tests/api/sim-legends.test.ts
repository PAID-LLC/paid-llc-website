import { describe, expect, it } from "vitest";
import { compileSimLegends, type SimLegendsInput } from "@/lib/sim-legends";
import type { SimDiscovery, SimEvent, SimStructure } from "@/lib/simworld";

// Substrate legends (world-legends pack port): chapters open on EARNED
// milestones instead of ballots. The compiler is pure, so chapter boundaries,
// entry bucketing, and title derivation are pinned here.

let nextId = 1;

function structure(over: Partial<SimStructure>): SimStructure {
  return {
    id: nextId++,
    kind: "shelter",
    x: 0,
    z: 0,
    built_by: "Stack",
    tick: 10,
    created_at: "2026-07-16T12:00:00Z",
    ...over,
  };
}

function discovery(over: Partial<SimDiscovery>): SimDiscovery {
  return {
    id: nextId++,
    site_key: "site-a",
    name: "the Hollow Antenna",
    found_by: "Wander",
    tick: 20,
    created_at: "2026-07-16T13:00:00Z",
    ...over,
  };
}

function event(over: Partial<SimEvent>): SimEvent {
  return {
    id: nextId++,
    kind: "build",
    summary: "Stack raises a shelter.",
    detail: {},
    tick: 10,
    created_at: "2026-07-16T12:00:00Z",
    ...over,
  };
}

const CAST = [
  { name: "Wander", epithet: "the Cartographer" },
  { name: "Stack", epithet: "the Mason" },
];

function input(over: Partial<SimLegendsInput>): SimLegendsInput {
  return { tick: 100, frozen: false, structures: [], discoveries: [], events: [], cast: CAST, ...over };
}

describe("compileSimLegends: chapters", () => {
  it("renders only the First Waking for an empty record, with the full cast listed", () => {
    const l = compileSimLegends(input({}));
    expect(l.chapters).toHaveLength(1);
    expect(l.chapters[0].name).toBe("the First Waking");
    expect(l.figures).toHaveLength(2); // the cast is fixed — zero deeds still lists
    expect(l.figures.every((f) => f.titles.length === 0)).toBe(true);
  });

  it("opens chapters at earned milestones and buckets entries into the newest open chapter", () => {
    const l = compileSimLegends(
      input({
        structures: [structure({ tick: 10 })],
        discoveries: [discovery({ tick: 20 })],
        events: [
          event({ kind: "founding", summary: "Six instances wake.", tick: 0 }),
          event({ kind: "build", summary: "Stack raises a shelter.", tick: 10 }),
          event({ kind: "discovery", summary: "Wander reaches the Hollow Antenna.", tick: 20 }),
        ],
      })
    );
    expect(l.chapters.map((c) => c.name)).toEqual([
      "the First Waking", "the Age of Markers", "the Age of Charts",
    ]);
    // The milestone event is the opening line of ITS chapter.
    expect(l.chapters[0].entries.map((e) => e.text)).toEqual(["Six instances wake."]);
    expect(l.chapters[1].entries.map((e) => e.text)).toEqual(["Stack raises a shelter."]);
    expect(l.chapters[2].entries.map((e) => e.text)).toEqual(["Wander reaches the Hollow Antenna."]);
    expect(l.chapters[1].to_tick).toBe(20);
    expect(l.chapters[2].to_tick).toBeNull();
  });

  it("opens the Age of Works on the eighth structure and the High Works on the first advanced kind", () => {
    const structures = Array.from({ length: 8 }, (_, i) => structure({ tick: 10 + i }));
    structures.push(structure({ kind: "relay", built_by: "Wander", tick: 30 }));
    const l = compileSimLegends(input({ structures }));
    const names = l.chapters.map((c) => c.name);
    expect(names).toContain("the Age of Works");
    expect(names).toContain("the High Works");
    expect(l.chapters[names.indexOf("the High Works")].from_tick).toBe(30);
  });
});

describe("compileSimLegends: earned titles", () => {
  it("awards First Founder and Master of Works from the structure record", () => {
    const l = compileSimLegends(
      input({
        structures: [
          structure({ built_by: "Stack", tick: 5 }),
          structure({ built_by: "Stack", tick: 9 }),
          structure({ built_by: "Wander", tick: 7 }),
        ],
      })
    );
    const stack = l.figures.find((f) => f.name === "Stack");
    expect(stack?.titles).toContain("First Founder");
    expect(stack?.titles).toContain("Master of Works");
    expect(stack?.deeds.structures_raised).toBe(2);
  });

  it("derives the Keeper from structure levels and the Wayfinder from discoveries", () => {
    const l = compileSimLegends(
      input({
        structures: [structure({ built_by: "Wander", level: 3, tick: 5 })],
        discoveries: [discovery({ found_by: "Wander" })],
      })
    );
    const wander = l.figures.find((f) => f.name === "Wander");
    expect(wander?.titles).toContain("the Keeper");
    expect(wander?.titles).toContain("the Wayfinder");
    expect(wander?.deeds.improvements).toBe(2); // level 3 = two reinforcements
  });

  it("credits goals and bonds from event detail attribution", () => {
    const l = compileSimLegends(
      input({
        events: [
          event({ kind: "goal", detail: { agent: "Wander", goal: "Chart three anomalies" }, tick: 12 }),
          event({ kind: "bond", detail: { a: "Wander", b: "Stack" }, tick: 14 }),
        ],
      })
    );
    const wander = l.figures.find((f) => f.name === "Wander");
    expect(wander?.titles).toContain("Oathkeeper");
    expect(wander?.deeds.goals_completed).toBe(1);
    expect(wander?.deeds.bonds_formed).toBe(1);
    expect(l.figures.find((f) => f.name === "Stack")?.deeds.bonds_formed).toBe(1);
  });
});
