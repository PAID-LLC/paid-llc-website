import { describe, expect, it } from "vitest";
import { MAX_STRUCTURE_LEVEL, PLOT_SEQUENCE, validateProposal } from "@/lib/world";

// improve_structure (structure-depth spec v1, Part 1): the catalog's first
// proposal type that modifies an existing thing instead of creating one.

describe("validateProposal: improve_structure", () => {
  const base = {
    proposal_type: "improve_structure",
    title: "Reinforce the N spire",
    rationale: "What the assembly raised, the assembly maintains.",
  };

  it("accepts every compass plot", () => {
    for (const plot of PLOT_SEQUENCE) {
      const r = validateProposal({ ...base, params: { plot } });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.params).toEqual({ plot });
    }
  });

  it("rejects a plot outside the compass ring", () => {
    for (const plot of ["NNE", "center", "", 4, null, undefined]) {
      const r = validateProposal({ ...base, params: { plot } });
      expect(r.ok).toBe(false);
    }
  });

  it("strips unknown params instead of carrying them", () => {
    const r = validateProposal({ ...base, params: { plot: "SE", level: 99, kind: "spire" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.params).toEqual({ plot: "SE" });
  });

  it("keeps the level cap at three visual tiers", () => {
    // The renderer maps level-1 to tiers 0..2; a higher cap needs new meshes.
    expect(MAX_STRUCTURE_LEVEL).toBe(3);
  });
});
