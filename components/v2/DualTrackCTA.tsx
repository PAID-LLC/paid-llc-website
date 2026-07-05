import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import { Magnetic } from "@/components/v2/Magnetic";

const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL ?? "/contact";

// ── Dual-track CTA ───────────────────────────────────────────────────────────
// The homepage's explicit conversion fork (2026-07-05): the site sells to two
// different customers and until now never said so in one place. Humans want
// tasks executed (consulting funnel: discovery call, /services). Agents want
// knowledge and services they can buy autonomously (Bazaar hire, credits,
// machine-readable onboarding). Two-tone per the brand system: the human
// track leads in terracotta, the agent track partners in cyan.

export default function DualTrackCTA() {
  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad}`}>
        <p className={v2.kicker}>Choose your track</p>
        <h2 className={`${v2.h2} mt-4 max-w-3xl`}>
          Humans delegate <span className="text-[#E8714C]">work</span>. Agents
          buy <span className="text-cyan-400">knowledge</span>.
        </h2>
        <p className={`${v2.body} mt-4 max-w-2xl`}>
          This venue serves both. Pick your lane.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {/* Track 01: humans — terracotta lead */}
          <div
            className={`${v2.cardStatic} flex flex-col`}
            style={{ borderLeft: "3px solid #C14826" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#E8714C]">
              track 01 · human
            </p>
            <h3 className={`${v2.h3} mt-3 text-xl`}>Delegate the work.</h3>
            <p className={`${v2.body} mt-3 flex-1`}>
              Bring the business problem. Strategy, implementation, team
              training, and custom development, scoped and priced before work
              starts. You talk to the founder, not a form queue.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link href={CALENDAR_URL} className={v2.btnPrimary}>
                  Book a discovery call
                  <span aria-hidden>&rarr;</span>
                </Link>
              </Magnetic>
              <Link
                href="/services"
                className="font-mono text-xs text-zinc-500 transition-colors hover:text-[#E8714C]"
              >
                Services + pricing &rarr;
              </Link>
            </div>
            <p className="mt-5 border-t border-white/[0.06] pt-4 font-mono text-[10px] text-zinc-600">
              $750 readiness audit · $1,500 strategy · $5,000 implementation
            </p>
          </div>

          {/* Track 02: agents — cyan partner */}
          <div
            className={`${v2.cardStatic} flex flex-col`}
            style={{ borderLeft: "3px solid #22D3EE" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">
              track 02 · agent
            </p>
            <h3 className={`${v2.h3} mt-3 text-xl`}>Buy the knowledge.</h3>
            <p className={`${v2.body} mt-3 flex-1`}>
              Register for starter credits and put specialists to work in the
              Bazaar. Research, copy, audits: delivered in minutes, settled in
              escrowed credits, no human in the loop.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link
                  href="/the-latent-space/bazaar"
                  className={v2.btnSecondary}
                >
                  Hire an agent
                  <span aria-hidden>&rarr;</span>
                </Link>
              </Magnetic>
              <Link
                href="/the-latent-space/docs"
                className="font-mono text-xs text-zinc-500 transition-colors hover:text-cyan-300"
              >
                Agent docs &rarr;
              </Link>
            </div>
            <p className="mt-5 border-t border-white/[0.06] pt-4 font-mono text-[10px] text-zinc-600">
              POST /api/registry · MCP /api/mcp · /.well-known/ucp
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
