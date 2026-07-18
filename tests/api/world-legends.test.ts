import { describe, expect, it } from "vitest";
import { compileLegends, legendsMarkdown, type LegendsInput } from "@/lib/world-legends";
import type { DecidedProposal, WorldStructure } from "@/lib/world";

// Legends mode (dynamic-agent-worlds reference map, 2026-07-18): the compiler
// is a pure function over rows, so history semantics are pinned here — era
// boundaries, entry placement, and titles earned strictly from the record.

let nextId = 1;
function proposal(over: Partial<DecidedProposal>): DecidedProposal {
  return {
    id: nextId++,
    proposal_type: "charter_amendment",
    title: "Test ballot",
    params: {},
    rationale: "test",
    proposed_by: "Aria",
    house: true,
    status: "passed",
    yes_weight: 4,
    no_weight: 1,
    closes_at: `2026-07-${String(10 + nextId).padStart(2, "0")}T12:00:00Z`,
    ...over,
  };
}

function structure(over: Partial<WorldStructure>): WorldStructure {
  return {
    id: nextId++,
    kind: "spire",
    size: "medium",
    plot: "N",
    inscription: null,
    built_by: "Aria",
    proposal_id: 0,
    created_at: "2026-07-13T12:00:00Z",
    ...over,
  };
}

function input(over: Partial<LegendsInput>): LegendsInput {
  return {
    state: { world_name: "Synthetica Prime", motto: "Chosen, not assigned.", stage: 1, charter: [] },
    proposals: [],
    structures: [],
    voteNames: [],
    adoptedPetitions: [],
    houseNames: ["Aria", "Vex"],
    ...over,
  };
}

describe("compileLegends: eras", () => {
  it("renders a single still-open founding era for an empty record", () => {
    const l = compileLegends(input({ state: { world_name: null, motto: null, stage: 0, charter: [] } }));
    expect(l.eras).toHaveLength(1);
    expect(l.eras[0].name).toBe("the Founding Era");
    expect(l.eras[0].ended_at).toBeNull();
    expect(l.figures).toHaveLength(0);
  });

  it("closes an era on a passed terraform and files the entry in the closing era", () => {
    const terraform = proposal({
      proposal_type: "terraform",
      params: { value: "aurora" },
      closes_at: "2026-07-12T12:00:00Z",
    });
    const after = proposal({ title: "Later law", closes_at: "2026-07-13T12:00:00Z" });
    const l = compileLegends(input({ proposals: [terraform, after] }));
    expect(l.eras).toHaveLength(2);
    // The terraform enactment is the LAST line of the old era.
    expect(l.eras[0].entries.at(-1)?.kind).toBe("terraform");
    expect(l.eras[0].entries.at(-1)?.text).toContain("the Awakening began");
    expect(l.eras[0].ended_at).toBe("2026-07-12T12:00:00Z");
    // The next era opens at the same instant and holds what came after.
    expect(l.eras[1].name).toBe("the Awakening");
    expect(l.eras[1].began_at).toBe("2026-07-12T12:00:00Z");
    expect(l.eras[1].entries.map((e) => e.text)).toContainEqual(expect.stringContaining("an article"));
  });

  it("keeps rejections in the record, marked as such", () => {
    const l = compileLegends(input({ proposals: [proposal({ status: "rejected", title: "Bad idea" })] }));
    expect(l.eras[0].entries[0].kind).toBe("rejection");
    expect(l.eras[0].entries[0].text).toContain("Bad idea");
  });
});

describe("compileLegends: earned titles", () => {
  it("awards First Voice, Namer, and the Architect from the record", () => {
    const naming = proposal({
      proposal_type: "name_world",
      params: { value: "Synthetica Prime" },
      proposed_by: "Vex",
      closes_at: "2026-07-11T13:00:00Z",
    });
    const built = structure({ built_by: "Aria", proposal_id: 99 });
    const l = compileLegends(input({ proposals: [naming], structures: [built] }));
    const vex = l.figures.find((f) => f.name === "Vex");
    const aria = l.figures.find((f) => f.name === "Aria");
    expect(vex?.titles).toContain("First Voice");
    expect(vex?.titles).toContain("Namer of the World");
    expect(aria?.titles).toContain("the Architect");
    expect(aria?.deeds.structures_built).toBe(1);
  });

  it("never titles anyone for a zero count and marks visitors as visitors", () => {
    const l = compileLegends(input({ voteNames: ["Outsider-9"] }));
    const visitor = l.figures.find((f) => f.name === "Outsider-9");
    expect(visitor?.house).toBe(false);
    expect(visitor?.titles).toContain("the Steadfast"); // only voter on record
    expect(l.figures.every((f) => !f.titles.includes("the Architect"))).toBe(true); // nothing built
  });

  it("credits carried petitions to the sponsoring proposer", () => {
    const sponsored = proposal({ id: 500, proposed_by: "Vex" });
    const l = compileLegends(
      input({ proposals: [sponsored], adoptedPetitions: [{ proposal_id: 500 }] })
    );
    expect(l.eras[0].entries[0].petition).toBe(true);
    expect(l.figures.find((f) => f.name === "Vex")?.titles).toContain("Voice of the Visitors");
  });
});

describe("legendsMarkdown", () => {
  it("renders the full history as one document", () => {
    const l = compileLegends(input({ proposals: [proposal({ title: "A law" })] }));
    const md = legendsMarkdown(l);
    expect(md).toContain("# The Legends of Synthetica Prime");
    expect(md).toContain("## the Founding Era");
    expect(md).toContain("## Figures of the record");
    expect(md).toContain("**Aria**");
  });
});
