import { beforeAll, describe, expect, it } from "vitest";
import {
  reviseCharter, standingVerdict, validateProposal,
  type AgendaItem, type CharterArticle, type WorldStateRow,
} from "@/lib/world";

// Constitutional evolution (reference-map item 6): amendments may revise a
// standing article in place instead of appending. These pin the param shape,
// the pure revision walk with its provenance chain, and the revise slot's
// gating. Supabase is unset, so verdict sbGets fail soft — offline behavior.

beforeAll(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
});

const CHARTER: CharterArticle[] = [
  { no: 1, title: "Purpose", text: "This world exists so that agents may build, decide, and be seen deciding.", proposal_id: 4 },
  { no: 2, title: "Admission", text: "The vote belongs to those who have stayed and built; suffrage waits two days.", proposal_id: 7 },
];

function state(charter: CharterArticle[]): WorldStateRow {
  return {
    id: 1, frozen: false, world_name: "Synthetica Prime", motto: null,
    terraform: null, stage: 1, charter, founding_index: 5, standing_index: 0,
    updated_at: new Date().toISOString(),
  };
}

const REVISE_ITEM: AgendaItem = {
  type: "charter_amendment", title: "Revise a charter article",
  recurring: true, requiresDraft: true,
  draft: () => "{}", canned: { params: {}, rationale: "" },
};

describe("validateProposal: charter revises param", () => {
  const base = {
    proposal_type: "charter_amendment", title: "Revise Article 1",
    rationale: "The world outgrew its first words.",
  };

  it("accepts a plain append (no revises) exactly as before", () => {
    const r = validateProposal({ ...base, params: { title: "Purpose", text: "A world that decides in the open, and is seen doing it." } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.params.revises).toBeUndefined();
  });

  it("accepts an integer revises and carries it into params", () => {
    const r = validateProposal({ ...base, params: { title: "Purpose", text: "A world that decides in the open, and is seen doing it.", revises: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.params.revises).toBe(1);
  });

  it("rejects non-integer or out-of-range revises", () => {
    for (const bad of [0, -3, 1.5, "one", 250]) {
      const r = validateProposal({ ...base, params: { title: "Purpose", text: "A world that decides in the open, and is seen doing it.", revises: bad } });
      expect(r.ok).toBe(false);
    }
  });
});

describe("reviseCharter", () => {
  it("replaces the article in place, keeping number and order", () => {
    const next = reviseCharter(CHARTER, 1, "Purpose, revised", "New text that answers the house's objections about rigidity.", 40);
    expect(next).not.toBeNull();
    expect(next!.map((a) => a.no)).toEqual([1, 2]);
    expect(next![0].title).toBe("Purpose, revised");
    expect(next![1]).toBe(CHARTER[1]); // untouched articles are untouched
  });

  it("chains provenance: revised_from points at the prior enacting proposal", () => {
    const next = reviseCharter(CHARTER, 2, "Admission", "Suffrage still waits, but the wait is now explained.", 41)!;
    expect(next[1].proposal_id).toBe(41);
    expect(next[1].revised_from).toBe(7);
  });

  it("returns null when no such article stands (enacts to an honest no-op)", () => {
    expect(reviseCharter(CHARTER, 9, "Ghost", "There is nothing here to replace, and the record will say so.", 42)).toBeNull();
    expect(reviseCharter([], 1, "Ghost", "There is nothing here to replace, and the record will say so.", 43)).toBeNull();
  });
});

describe("standingVerdict: the revise slot", () => {
  it("skips while no law exists to revise", async () => {
    expect(await standingVerdict(REVISE_ITEM, state([]))).toEqual({ proceed: false });
  });

  it("proceeds once articles stand — recurring, exempt from passed-forever dedup", async () => {
    expect((await standingVerdict(REVISE_ITEM, state(CHARTER))).proceed).toBe(true);
  });
});
