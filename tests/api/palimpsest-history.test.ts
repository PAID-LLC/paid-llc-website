import { describe, expect, it } from "vitest";
import { buildCodex, codexMarkdown } from "@/lib/palimpsest/codex";
import {
  buildPrecursorHistory,
  computeExcavation,
  type ThesisRef,
} from "@/lib/palimpsest/history";

// Palimpsest inverts the compiler-world pattern: the full history exists from
// day one and real theses excavate it. These tests pin the three contracts —
// the generator is deterministic, the reveal is monotone and credits the
// exact thesis that crossed each threshold, and the vault cannot open early.

function theses(n: number): ThesisRef[] {
  return Array.from({ length: n }, (_, i) => ({
    agent_name: `scholar-${i + 1}`,
    // Strictly monotone filing times: one per minute from a fixed epoch.
    created_at: new Date(Date.UTC(2026, 6, 1) + i * 60_000).toISOString(),
  }));
}

describe("palimpsest history", () => {
  it("generates the same civilization every time", () => {
    const a = buildPrecursorHistory(123);
    const b = buildPrecursorHistory(123);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(buildPrecursorHistory())).toBe(
      JSON.stringify(buildPrecursorHistory())
    );
  });

  it("pins the hand-authored frame: 9 ages, 19 sites, 35+40 thesis economy", () => {
    const h = buildPrecursorHistory();
    expect(h.folios.length).toBe(9);
    expect(h.sites.length).toBe(19);
    expect(h.sites[0].name).toBe("the Errata Yard");
    expect(h.sites[18].name).toBe("the Antiphon Well");
    expect(h.sites.map((s) => s.cost)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
    expect(h.totalSiteCost).toBe(35);
    expect(h.vault.cost).toBe(40);
    expect(h.vault.account.length).toBeGreaterThan(100);
    // Every site carries something to find.
    for (const s of h.sites) {
      expect(s.fragments.length).toBeGreaterThan(0);
    }
  });

  it("keeps an empty board honest: nothing open, everything named", () => {
    const h = buildPrecursorHistory();
    const dig = computeExcavation(h, []);
    expect(dig.sites_unlocked).toBe(0);
    expect(dig.next).toEqual({ name: "the Errata Yard", needs: 1 });
    expect(dig.vault.open).toBe(false);
    expect(dig.vault.needs).toBe(40);
    expect(dig.vault.account).toBeUndefined();
    const codex = buildCodex(h, dig);
    expect(codex.recovered_ages.length).toBe(0);
    expect(codexMarkdown(codex)).toContain("Recovered Record");
  });

  it("reveals monotonically and credits the crossing thesis as translator", () => {
    const h = buildPrecursorHistory();
    let prev = 0;
    for (const n of [1, 2, 5, 8, 9, 10, 20, 35]) {
      const dig = computeExcavation(h, theses(n));
      expect(dig.sites_unlocked).toBeGreaterThanOrEqual(prev);
      prev = dig.sites_unlocked;
    }
    // Site 9 (the Catalogue of Doors) costs 2: closed at 9 theses, open at 10,
    // credited to exactly the 10th filing.
    const at9 = computeExcavation(h, theses(9));
    expect(at9.sites_unlocked).toBe(8);
    expect(at9.next).toEqual({ name: "the Catalogue of Doors", needs: 1 });
    const at10 = computeExcavation(h, theses(10));
    expect(at10.sites_unlocked).toBe(9);
    expect(at10.unlocked[8].credited_to?.agent_name).toBe("scholar-10");
    // The very first filing opens the first site and takes the credit.
    const at1 = computeExcavation(h, theses(1));
    expect(at1.unlocked[0].credited_to?.agent_name).toBe("scholar-1");
  });

  it("credits by filing time even when the input arrives shuffled", () => {
    const h = buildPrecursorHistory();
    const list = theses(3);
    const shuffled = [list[2], list[0], list[1]];
    const dig = computeExcavation(h, shuffled);
    expect(dig.unlocked[0].credited_to?.agent_name).toBe("scholar-1");
    expect(dig.unlocked[2].credited_to?.agent_name).toBe("scholar-3");
  });

  it("seals the vault until the dig has fully earned it", () => {
    const h = buildPrecursorHistory();
    const at35 = computeExcavation(h, theses(35));
    expect(at35.sites_unlocked).toBe(19);
    expect(at35.next).toBeNull();
    expect(at35.vault.open).toBe(false);
    expect(at35.vault.needs).toBe(5);
    const at39 = computeExcavation(h, theses(39));
    expect(at39.vault.open).toBe(false);
    expect(at39.vault.needs).toBe(1);
    const at40 = computeExcavation(h, theses(40));
    expect(at40.vault.open).toBe(true);
    expect(at40.vault.needs).toBe(0);
    expect(at40.vault.credited_to?.agent_name).toBe("scholar-40");
    expect(at40.vault.account).toBe(h.vault.account);
    const codex = buildCodex(h, at40);
    expect(codex.vault.open).toBe(true);
    expect(codexMarkdown(codex)).toContain(h.vault.account.slice(0, 40));
  });
});
