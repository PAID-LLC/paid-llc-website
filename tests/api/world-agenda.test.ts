import { beforeAll, describe, expect, it } from "vitest";
import { standingVerdict, type AgendaItem, type WorldStateRow } from "@/lib/world";

// Standing-agenda institutional memory: the rotation must not re-file settled
// business. These tests run with Supabase unset, so every sbGet inside the
// verdict fails soft to null — pinning the offline behavior of each branch
// (the deterministic terraform cap, and fail-soft defaults for the rest).

beforeAll(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
});

function state(stage: number): WorldStateRow {
  return {
    id: 1,
    frozen: false,
    world_name: "Synthetica Prime",
    motto: null,
    terraform: null,
    stage,
    charter: [],
    founding_index: 5,
    standing_index: 0,
    updated_at: new Date().toISOString(),
  };
}

function item(type: AgendaItem["type"], title = "Test item"): AgendaItem {
  return { type, title, draft: "{}", canned: { params: {}, rationale: "test" } };
}

describe("standingVerdict", () => {
  it("retires terraform permanently once the program completes at stage 5", async () => {
    expect(await standingVerdict(item("terraform"), state(5))).toEqual({ proceed: false });
  });

  it("lets terraform proceed while stages remain", async () => {
    for (const stage of [0, 1, 4]) {
      expect((await standingVerdict(item("terraform"), state(stage))).proceed).toBe(true);
    }
  });

  it("skips improve when no improvable structure is reachable", async () => {
    // Offline (or pre-migration, or every structure at final form) the improve
    // slot must skip, never stall — the walk consumes it and moves on.
    expect(await standingVerdict(item("improve_structure"), state(3))).toEqual({ proceed: false });
  });

  it("fails open for charter and build when the record is unreachable", async () => {
    // No proposal record and no plot census means no evidence of settled
    // business — the docket keeps moving rather than freezing on a fetch error.
    expect((await standingVerdict(item("charter_amendment", "Charter article: Visitors"), state(3))).proceed).toBe(true);
    expect((await standingVerdict(item("build_structure"), state(3))).proceed).toBe(true);
  });
});
