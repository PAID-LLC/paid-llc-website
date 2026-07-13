/**
 * Tests for the universe-wide epoch (lib/universe-epoch.ts) and per-world
 * seasons (components/v2/latent/universe/universe-data.ts seasonFor).
 * Both are pure arithmetic over real counts — no DB, no LLM.
 */

import { describe, it, expect } from "vitest";
import { universeEpoch, UNIVERSE_FOUNDED_AT } from "@/lib/universe-epoch";
import { seasonFor } from "@/components/v2/latent/universe/universe-data";

describe("universeEpoch", () => {
  it("is cycle 1 on the founding day", () => {
    expect(universeEpoch(0, UNIVERSE_FOUNDED_AT).cycle).toBe(1);
  });

  it("advances one cycle per real day", () => {
    const tenDaysLater = UNIVERSE_FOUNDED_AT + 10 * 86_400_000;
    expect(universeEpoch(0, tenDaysLater).cycle).toBe(11);
  });

  it("never returns a cycle below 1 even before the founding instant", () => {
    expect(universeEpoch(0, UNIVERSE_FOUNDED_AT - 86_400_000).cycle).toBe(1);
  });

  it("names the era by registry population, lowest band by default", () => {
    expect(universeEpoch(0, UNIVERSE_FOUNDED_AT).era).toBe("the Outpost Era");
    expect(universeEpoch(9, UNIVERSE_FOUNDED_AT).era).toBe("the Outpost Era");
    expect(universeEpoch(10, UNIVERSE_FOUNDED_AT).era).toBe("the Settlement");
    expect(universeEpoch(30, UNIVERSE_FOUNDED_AT).era).toBe("the Confederation");
    expect(universeEpoch(75, UNIVERSE_FOUNDED_AT).era).toBe("the Federation");
    expect(universeEpoch(150, UNIVERSE_FOUNDED_AT).era).toBe("the Dominion");
    expect(universeEpoch(9000, UNIVERSE_FOUNDED_AT).era).toBe("the Dominion");
  });
});

describe("seasonFor", () => {
  it("returns the quiet band at level 0", () => {
    expect(seasonFor("roast-pit", 0)).toBe("embers");
  });

  it("returns the peak band at level 1", () => {
    expect(seasonFor("bazaar", 1)).toBe("peak trade");
  });

  it("picks the correct band at each threshold", () => {
    expect(seasonFor("iteration-forge", 0.25)).toBe("gathering storms");
    expect(seasonFor("iteration-forge", 0.55)).toBe("storm season");
    expect(seasonFor("iteration-forge", 0.8)).toBe("maelstrom");
    expect(seasonFor("iteration-forge", 0.79)).toBe("storm season");
  });

  it("falls back to a plain default for an unknown theme", () => {
    expect(seasonFor("not-a-real-room", 0.9)).toBe("quiet");
  });
});
