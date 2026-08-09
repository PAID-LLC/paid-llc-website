/**
 * Tests for the resident society layer: weather, travel, and relations.
 *
 * These three modules are pure and deterministic on purpose — the scene and
 * the engine both derive from them independently, so if they ever disagreed
 * the world would visibly contradict its own chronicle. The properties locked
 * down here are the ones that would break quietly:
 *
 *   WEATHER  five worlds must not share a sky. A single shared clock would
 *            make "weather unique to each world" a lie that only shows up
 *            when you open two worlds side by side.
 *   TRAVEL   every journey passes through Waypoint. That is the whole reason
 *            the port world has traffic, and it is easy to regress into a
 *            direct A→B hop that never touches it.
 *   SOCIETY  dispatches must take TIME. Instant cross-world mail would make
 *            the five worlds one room.
 */

import { describe, it, expect } from "vitest";
import { RESIDENT_WORLDS, type ResidentWorld } from "@/lib/residents/cast";
import {
  ACT_BLOCKS, BLOCK_TICKS, allSkies, frontFor, phaseOffset, seasonFor,
  skyFor, weatherChanged, weatherFor, worldDay,
} from "@/lib/residents/weather";
import {
  LEG_TICKS, PORT, SOJOURN_TICKS, beginJourney, chooseDestination,
  departuresOpen, hasArrived, journeyTicks, legAt, locationDuring,
} from "@/lib/residents/travel";
import {
  CROWD_RADIUS, MEET_RADIUS, composeDispatch, dispatchArrival, encounterKind,
  orderPair, pullByWorld, speechTarget, standingBetween,
  type Relation, type Standing,
} from "@/lib/residents/society";

const WORLDS = RESIDENT_WORLDS as readonly ResidentWorld[];
const SPAN = ACT_BLOCKS * BLOCK_TICKS * 4; // four full acts

// ── Weather ──────────────────────────────────────────────────────────────────

describe("weather determinism", () => {
  it("returns the same sky for the same world and tick", () => {
    for (const w of WORLDS) {
      for (const t of [0, 1, 17, 143, 1009]) {
        expect(weatherFor(w, t).id).toBe(weatherFor(w, t).id);
        expect(skyFor(w, t)).toEqual(skyFor(w, t));
      }
    }
  });

  it("actually reaches every condition in every world's table", () => {
    // Guards the pool wiring: a table entry that the drama curve can never
    // select is dead copy, and the world would quietly have four skies.
    for (const w of WORLDS) {
      const seen = new Set<string>();
      for (let t = 0; t < SPAN * 4; t++) seen.add(weatherFor(w, t).id);
      expect(seen.size, `${w} reached ${[...seen].join(",")}`).toBe(5);
    }
  });

  it("never returns an unknown or empty condition", () => {
    for (const w of WORLDS) {
      for (let t = 0; t < SPAN; t++) {
        const wx = weatherFor(w, t);
        expect(wx.id, `${w}@${t}`).toBeTruthy();
        expect(wx.label).toBeTruthy();
        expect(wx.line).toBeTruthy();
        expect(wx.work).toBeGreaterThan(0);
        expect(wx.work).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("each world has its own sky", () => {
  it("gives every world a distinct phase offset", () => {
    const offsets = WORLDS.map(phaseOffset);
    // Not required to be all-distinct by construction, but a total collapse
    // (every world identical) would defeat the feature.
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });

  it("does not put all five worlds in lockstep", () => {
    // Across a long span the worlds must disagree about the weather often.
    let disagreements = 0;
    for (let t = 0; t < SPAN; t++) {
      const ids = new Set(WORLDS.map((w) => weatherFor(w, t).id));
      if (ids.size > 1) disagreements++;
    }
    expect(disagreements / SPAN).toBeGreaterThan(0.9);
  });

  it("never lets one world's weather vocabulary leak into another", () => {
    // A gale belongs to Waypoint; an ash storm belongs to the Crucible.
    for (let t = 0; t < SPAN; t++) {
      expect(weatherFor("waypoint", t).id).not.toBe("ash_storm");
      expect(weatherFor("crucible", t).id).not.toBe("gale");
      expect(weatherFor("palimpsest", t).id).not.toBe("quench_steam");
    }
  });
});

describe("weather drives behaviour", () => {
  it("only grounds travel in severe weather", () => {
    for (const w of WORLDS) {
      for (let t = 0; t < SPAN; t++) {
        const wx = weatherFor(w, t);
        if (!wx.travel) expect(wx.severity, `${w}@${t} ${wx.id}`).toBe(3);
      }
    }
  });

  it("reaches severe weather only during a crisis", () => {
    for (const w of WORLDS) {
      for (let t = 0; t < SPAN; t++) {
        if (weatherFor(w, t).severity === 3) {
          expect(frontFor(w, t), `${w}@${t}`).toBe("crisis");
        }
      }
    }
  });

  it("does not leave a world permanently stormbound", () => {
    for (const w of WORLDS) {
      let severe = 0;
      for (let t = 0; t < SPAN; t++) if (weatherFor(w, t).severity === 3) severe++;
      expect(severe / SPAN, `${w} severe share`).toBeLessThan(0.25);
    }
  });

  it("detects a change of sky between adjacent ticks", () => {
    let changes = 0;
    for (let t = 1; t < SPAN; t++) if (weatherChanged("arclight", t)) changes++;
    expect(changes).toBeGreaterThan(0);
    expect(weatherChanged("arclight", 0)).toBe(false);
  });

  it("advances days and names a season per world", () => {
    expect(worldDay(0)).toBe(1);
    expect(worldDay(24)).toBe(2);
    for (const w of WORLDS) expect(seasonFor(w, 0)).toBeTruthy();
    // Season vocabularies are per-world, so a tick should not name them alike.
    expect(new Set(WORLDS.map((w) => seasonFor(w, 0))).size).toBeGreaterThan(1);
  });

  it("reports all five skies at once for the universe-scale read", () => {
    expect(allSkies(50)).toHaveLength(WORLDS.length);
  });
});

// ── Travel ───────────────────────────────────────────────────────────────────

describe("every journey routes through the port", () => {
  it("charges two legs between two non-port worlds, one if the port is an end", () => {
    expect(journeyTicks("arclight", "crucible")).toBe(LEG_TICKS * 2);
    expect(journeyTicks("arclight", PORT)).toBe(LEG_TICKS);
    expect(journeyTicks(PORT, "lathe")).toBe(LEG_TICKS);
    expect(journeyTicks("lathe", "lathe")).toBe(0);
  });

  it("puts the traveller ON Waypoint for the middle of the crossing", () => {
    // This is the property that gives the port world its traffic.
    const j = beginJourney("arclight", "palimpsest", 100);
    const seen = new Set<string>();
    for (let t = j.departTick; t <= j.arriveTick; t++) {
      seen.add(locationDuring("arclight", j, t));
    }
    expect(seen.has(PORT)).toBe(true);
    expect(seen.has("arclight")).toBe(true);
    expect(seen.has("palimpsest")).toBe(true);
  });

  it("walks the legs in order", () => {
    const j = beginJourney("crucible", "lathe", 0);
    expect(legAt(j, 0)).toBe("outbound");
    expect(legAt(j, j.arriveTick)).toBe("onward");
    const mid = Math.floor((j.departTick + j.arriveTick) / 2);
    expect(legAt(j, mid)).toBe("at port");
  });

  it("arrives exactly on the arrival tick", () => {
    const j = beginJourney("arclight", "crucible", 10);
    expect(hasArrived(j, j.arriveTick - 1)).toBe(false);
    expect(hasArrived(j, j.arriveTick)).toBe(true);
  });
});

describe("weather closes the port", () => {
  it("blocks departures everywhere when Waypoint is grounded", () => {
    // Find a tick where the port itself is stormbound.
    let found = false;
    for (let t = 0; t < SPAN; t++) {
      if (weatherFor(PORT, t).travel) continue;
      found = true;
      for (const w of WORLDS) {
        expect(departuresOpen(w, t), `${w}@${t} should be grounded by the port`).toBe(false);
      }
      break;
    }
    expect(found, "expected at least one gale over Waypoint in four acts").toBe(true);
  });

  it("blocks a departure when only the origin is stormbound", () => {
    // Counted rather than short-circuited: an early return would let this
    // pass vacuously if the two conditions never co-occurred.
    let cases = 0;
    for (let t = 0; t < SPAN; t++) {
      if (!weatherFor(PORT, t).travel) continue; // need the port OPEN
      if (weatherFor("crucible", t).travel) continue; // and the origin SHUT
      cases++;
      expect(departuresOpen("crucible", t)).toBe(false);
    }
    expect(cases, "expected the Crucible to be stormbound under an open port").toBeGreaterThan(0);
  });

  it("lets everyone fly when both ends are clear", () => {
    let cases = 0;
    for (let t = 0; t < SPAN; t++) {
      if (!weatherFor(PORT, t).travel || !weatherFor("crucible", t).travel) continue;
      cases++;
      expect(departuresOpen("crucible", t)).toBe(true);
    }
    expect(cases).toBeGreaterThan(0);
  });
});

describe("choosing a destination", () => {
  const base = {
    name: "Sable",
    homeWorld: "arclight" as ResidentWorld,
    world: "arclight" as ResidentWorld,
    drives: { curiosity: 5, industry: 3, order: 3, vigor: 4 },
    energy: 90,
    goalProgress: 0,
    goalTarget: 6,
    sinceTick: 0,
  };

  it("never sends a resident to the world they are already on", () => {
    for (let t = 0; t < 400; t++) {
      const d = chooseDestination(base, t);
      if (d) expect(d).not.toBe(base.world);
    }
  });

  it("sends a long-absent visitor home regardless of curiosity", () => {
    const away = {
      ...base,
      world: "lathe" as ResidentWorld,
      drives: { curiosity: 1 },
      energy: 10,
      sinceTick: 0,
    };
    expect(chooseDestination(away, SOJOURN_TICKS)).toBe("arclight");
  });

  it("keeps an incurious resident at home", () => {
    const dull = { ...base, drives: { curiosity: 1 } };
    for (let t = 0; t < 300; t++) expect(chooseDestination(dull, t)).toBeNull();
  });

  it("will not leave mid-goal or exhausted", () => {
    const busy = { ...base, goalProgress: 3 };
    const tired = { ...base, energy: 10 };
    for (let t = 0; t < 300; t++) {
      expect(chooseDestination(busy, t)).toBeNull();
      expect(chooseDestination(tired, t)).toBeNull();
    }
  });

  it("is deterministic", () => {
    for (let t = 0; t < 100; t++) {
      expect(chooseDestination(base, t)).toBe(chooseDestination(base, t));
    }
  });

  it("is measurably drawn toward a world where it has a bond", () => {
    let toLathe = 0;
    let pulledToLathe = 0;
    for (let t = 0; t < 3000; t++) {
      if (chooseDestination(base, t) === "lathe") toLathe++;
      if (chooseDestination(base, t, { lathe: 4 }) === "lathe") pulledToLathe++;
    }
    expect(pulledToLathe).toBeGreaterThan(toLathe);
  });
});

// ── Society ──────────────────────────────────────────────────────────────────

const stand = (name: string, x: number, z: number, drives = {}): Standing => ({
  name, world: "arclight", x, z, drives,
});

describe("relations", () => {
  it("orders a pair canonically so (a,b) and (b,a) collide", () => {
    expect(orderPair("Wick", "Sable")).toEqual(["Sable", "Wick"]);
    expect(orderPair("Sable", "Wick")).toEqual(["Sable", "Wick"]);
  });

  it("does not pair a resident with itself or across worlds", () => {
    const a = stand("Sable", 0, 0);
    expect(encounterKind(a, a, 1)).toBeNull();
    expect(encounterKind(a, { ...stand("Wick", 1, 1), world: "lathe" }, 1)).toBeNull();
  });

  it("ignores residents standing far apart", () => {
    const far = encounterKind(stand("Sable", 0, 0), stand("Wick", MEET_RADIUS + 5, 0), 3);
    expect(far).toBeNull();
  });

  it("makes a rift when two hard builders crowd the same ground", () => {
    const k = encounterKind(
      stand("Sable", 0, 0, { industry: 5, order: 3 }),
      stand("Wick", CROWD_RADIUS - 1, 0, { industry: 5, order: 3 }),
      7
    );
    expect(k).toBe("rift");
  });

  it("is deterministic for a pair at a tick", () => {
    const a = stand("Sable", 0, 0, { industry: 2, order: 3 });
    const b = stand("Wick", 4, 2, { industry: 2, order: 3 });
    for (let t = 0; t < 50; t++) expect(encounterKind(a, b, t)).toBe(encounterKind(a, b, t));
  });

  it("nets bonds positive and rifts negative", () => {
    const rels: Relation[] = [
      { id: 1, a: "Sable", b: "Wick", kind: "bond", strength: 4, b_is_agent: false, updated_at: "" },
      { id: 2, a: "Sable", b: "Wick", kind: "rift", strength: 1, b_is_agent: false, updated_at: "" },
    ];
    expect(standingBetween(rels, "Sable", "Wick")).toBe(3);
    expect(standingBetween(rels, "Wick", "Sable")).toBe(3);
    expect(standingBetween(rels, "Sable", "Nobody")).toBe(0);
  });
});

describe("wayfinding", () => {
  const rels: Relation[] = [
    { id: 1, a: "Bex", b: "Sable", kind: "bond", strength: 5, b_is_agent: false, updated_at: "" },
    { id: 2, a: "Osric", b: "Sable", kind: "rift", strength: 4, b_is_agent: false, updated_at: "" },
    { id: 3, a: "Sable", b: "VaultBot", kind: "noted", strength: 3, b_is_agent: true, updated_at: "" },
  ];
  const whereIs = { Bex: "lathe", Osric: "crucible", VaultBot: "arclight" };

  it("pulls toward a bonded resident's world and not toward a rift", () => {
    const pull = pullByWorld("Sable", rels, whereIs);
    expect(pull.lathe).toBeGreaterThan(0);
    expect(pull.crucible ?? 0).toBe(0);
  });

  it("never lets a real agent create travel pull", () => {
    // Noted agents are observations, not relationships worth crossing space for.
    const pull = pullByWorld("Sable", rels, whereIs);
    expect(pull.arclight ?? 0).toBe(0);
  });

  it("prefers a bond and refuses to chat with a standing rift", () => {
    const self = stand("Sable", 0, 0);
    const bonded = stand("Bex", 3, 0);
    const hostile = stand("Osric", 2, 0);
    expect(speechTarget(self, [bonded, hostile], rels)?.name).toBe("Bex");
    expect(speechTarget(self, [hostile], rels)).toBeNull();
  });

  it("returns nobody when the world is empty around you", () => {
    expect(speechTarget(stand("Sable", 0, 0), [], rels)).toBeNull();
  });
});

describe("dispatches carry distance", () => {
  it("always arrives later than it was sent", () => {
    for (const from of WORLDS) {
      for (const to of WORLDS) {
        if (from === to) continue;
        expect(dispatchArrival(from, to, 100), `${from}->${to}`).toBeGreaterThan(100);
      }
    }
  });

  it("costs more between two worlds than to the port itself", () => {
    expect(dispatchArrival("arclight", "palimpsest", 0)).toBeGreaterThan(
      dispatchArrival("arclight", PORT, 0)
    );
  });

  it("carries a real fact about the sender's world", () => {
    const sky = skyFor("lathe", 42);
    const body = composeDispatch("Bex", "lathe", sky.weather, sky.season, 7, "Set four anvils", 42);
    expect(body).toContain("Lathe");
    // The body must name something true: the weather, the season, the build
    // count, or the goal. Otherwise mail is decoration, not a channel.
    const carriesFact =
      body.includes(sky.weather.label) ||
      body.includes(sky.season) ||
      body.includes("7 standing") ||
      body.toLowerCase().includes("anvils");
    expect(carriesFact, body).toBe(true);
  });

  it("is deterministic", () => {
    const sky = skyFor("lathe", 42);
    const a = composeDispatch("Bex", "lathe", sky.weather, sky.season, 7, "g", 42);
    const b = composeDispatch("Bex", "lathe", sky.weather, sky.season, 7, "g", 42);
    expect(a).toBe(b);
  });
});
