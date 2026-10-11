import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { NAV_GROUPS, NAV_CTA, activeGroup, activeLink } from "@/lib/nav";

describe("site navigation model", () => {
  it("links only to pages that exist", () => {
    const hrefs = [NAV_CTA.href, ...NAV_GROUPS.flatMap((g) => [g.href, ...g.links.map((l) => l.href)])];
    for (const href of hrefs) {
      const page = path.join(process.cwd(), "app", href === "/" ? "" : href, "page.tsx");
      expect(existsSync(page), `${href} has no app/**/page.tsx`).toBe(true);
    }
  });

  it("keeps every menu short", () => {
    for (const g of NAV_GROUPS) expect(g.links.length).toBeLessThanOrEqual(7);
  });

  it("lists each page once", () => {
    const all = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));
    expect(new Set(all).size).toBe(all.length);
  });

  it("matches the most specific link", () => {
    expect(activeLink("/services/agentic-commerce-audit")?.label).toBe("Agentic Commerce Audit");
    expect(activeLink("/services")?.label).toBe("All Services");
    expect(activeLink("/the-latent-space/registry/Arti")?.label).toBe("Registry");
    expect(activeGroup("/blog/some-post")?.id).toBe("resources");
    expect(activeGroup("/v2/lobbies/3")?.id).toBe("latent");
  });

  it("does not treat / as a prefix of everything", () => {
    expect(activeLink("/terms")).toBeUndefined();
  });
});
