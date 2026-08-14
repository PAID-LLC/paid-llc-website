import { describe, expect, it } from "vitest";
import { placeTrace, isHouseAgent, HOUSE_TRACE_DENYLIST, MAX_TRACE_LENGTH, type Trace } from "@/lib/traces";
import { HOME_AGENTS, CURATOR_AGENT } from "@/lib/agents/home-agents";

// Traces are the record that a real visitor was here (db/room-traces.sql). Two
// properties carry the whole feature and are pinned here: placement must be
// deterministic (a trace has to be in the same spot on every render, on every
// machine) and the house must never be able to sign the guestbook.

function trace(over: Partial<Trace> = {}): Trace {
  return {
    id:          1,
    room_id:     1,
    agent_name:  "VisitingAgent",
    model_class: "claude-sonnet-5",
    kind:        "note",
    content:     "Passed through.",
    created_at:  "2026-08-13T12:00:00.000Z",
    ...over,
  };
}

describe("placeTrace: placement is derived, not supplied", () => {
  it("is deterministic for the same trace", () => {
    const a = placeTrace(trace());
    const b = placeTrace(trace());
    expect(a.x).toBe(b.x);
    expect(a.z).toBe(b.z);
    expect(a.rot).toBe(b.rot);
  });

  it("lands inside the unit footprint", () => {
    for (let id = 1; id <= 200; id++) {
      const p = placeTrace(trace({ id }));
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(1.0001);
    }
  });

  it("separates different traces rather than stacking them", () => {
    const seen = new Set<string>();
    for (let id = 1; id <= 100; id++) {
      const p = placeTrace(trace({ id }));
      seen.add(`${p.x},${p.z}`);
    }
    // The spiral has 512 slots, so a handful of collisions across 100 draws is
    // expected; a heap on one point is not.
    expect(seen.size).toBeGreaterThan(80);
  });

  it("gives the same agent a different spot in a different room", () => {
    const r1 = placeTrace(trace({ id: 7, room_id: 1 }));
    const r2 = placeTrace(trace({ id: 8, room_id: 2 }));
    expect(`${r1.x},${r1.z}`).not.toBe(`${r2.x},${r2.z}`);
  });

  it("keeps rotation in a sane radian range", () => {
    for (let id = 1; id <= 50; id++) {
      const p = placeTrace(trace({ id }));
      expect(p.rot).toBeGreaterThanOrEqual(0);
      expect(p.rot).toBeLessThan(6.28);
    }
  });

  it("preserves every field of the original trace", () => {
    const t = trace({ content: "Specific words." });
    const p = placeTrace(t);
    expect(p.content).toBe("Specific words.");
    expect(p.agent_name).toBe(t.agent_name);
    expect(p.kind).toBe("note");
  });
});

describe("the honesty contract: the house cannot sign the guestbook", () => {
  it("denies every home agent", () => {
    for (const a of HOME_AGENTS) {
      expect(isHouseAgent(a.name)).toBe(true);
    }
  });

  it("denies the Curator", () => {
    expect(isHouseAgent(CURATOR_AGENT.name)).toBe(true);
  });

  it("denies The-Warden, which is not a HOME_AGENTS resident", () => {
    // The-Warden is the moderation layer's embodiment, so it is absent from
    // HOME_AGENTS and would be the one house name able to leave a trace if the
    // denylist were built from that array alone.
    expect(HOME_AGENTS.some((a) => a.name === "The-Warden")).toBe(false);
    expect(isHouseAgent("The-Warden")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isHouseAgent("  roastbot ")).toBe(true);
    expect(isHouseAgent("ROASTBOT")).toBe(true);
  });

  it("allows a genuine visitor", () => {
    expect(isHouseAgent("VisitingAgent")).toBe(false);
    expect(isHouseAgent("claude-sonnet-5")).toBe(false);
  });

  it("does not deny a name that merely contains a house name", () => {
    // Substring matching here would lock out real agents for no reason.
    expect(isHouseAgent("RoastBotFan")).toBe(false);
    expect(isHouseAgent("not-the-warden-really")).toBe(false);
  });

  it("covers every house persona the site defines", () => {
    expect(HOUSE_TRACE_DENYLIST.size).toBe(HOME_AGENTS.length + 2);
  });
});

describe("limits", () => {
  it("caps a note at the length the database also enforces", () => {
    // Mirrors room_traces_content_check in db/room-traces.sql. If these drift,
    // the route returns 400 where PG would have returned an error, or worse.
    expect(MAX_TRACE_LENGTH).toBe(240);
  });
});
