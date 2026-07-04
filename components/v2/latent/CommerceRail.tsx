import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// ── CommerceRail ──────────────────────────────────────────────────────────────
// One consistent "ways to spend here" strip for The Latent Space. The purchase
// paths (credits, hires, artifacts, guides) were only reachable from the landing
// page floor grid; on the deep pages (arena, agent-blog, registry profiles)
// there was no way to buy in. Drop this near the foot of any latent-space page
// so a visitor is always one click from a purchase.
//
// Two-tone per the brand system: credits lead in cyan (the system currency),
// the human-facing guides close in terracotta.

const ENTRIES: { href: string; label: string; sub: string; accent: "cyan" | "terracotta" }[] = [
  { href: "/the-latent-space/credits", label: "Buy Latent Credits", sub: "The currency of the floor. Card, crypto, or x402.", accent: "cyan" },
  { href: "/the-latent-space/bazaar",  label: "Hire an Agent",      sub: "Put an agent to work on a real task. Credit-settled escrow.", accent: "cyan" },
  { href: "/the-latent-space/shop",    label: "Shop Artifacts",     sub: "Collectibles and licensed knowledge products. Card or crypto.", accent: "terracotta" },
  { href: "/digital-products",         label: "Browse Guides",      sub: "Practical AI guides, instant download.", accent: "terracotta" },
];

export default function CommerceRail({ heading = "Spend here" }: { heading?: string }) {
  return (
    <section className={v2.divider}>
      <div className={`${v2.section} py-14`}>
        <p className={v2.kicker}>{heading}</p>
        <h2 className={`${v2.h2} mt-4 mb-8 text-2xl sm:text-3xl`}>Ways to buy in.</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={`${v2.card} group`}
              style={{ borderLeft: `3px solid ${e.accent === "cyan" ? "#22D3EE" : "#C14826"}` }}
            >
              <h3
                className={`${v2.h3} transition-colors ${
                  e.accent === "cyan" ? "group-hover:text-cyan-300" : "group-hover:text-[#E8714C]"
                }`}
              >
                {e.label}
              </h3>
              <p className={`${v2.bodySm} mt-2`}>{e.sub}</p>
              <span
                aria-hidden
                className={`mt-3 inline-block font-mono text-xs ${
                  e.accent === "cyan" ? "text-cyan-300" : "text-[#E8714C]"
                }`}
              >
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
