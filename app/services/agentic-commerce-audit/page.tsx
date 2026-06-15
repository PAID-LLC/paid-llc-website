import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL ?? "/contact";

export const metadata: Metadata = {
  title: "Agentic Commerce Readiness Audit | PAID LLC",
  description:
    "A fixed-fee assessment of your business's readiness to deploy AI agents. Readiness score across 5 dimensions, gap analysis, and a phased deployment roadmap — delivered in 5 business days.",
  openGraph: {
    title: "Agentic Commerce Readiness Audit | PAID LLC",
    description:
      "Know exactly what needs to change before you deploy an AI agent. $750–$1,500 fixed fee. Written report delivered in 5 business days.",
    url: "https://paiddev.com/services/agentic-commerce-audit",
  },
};

const label = "font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500";

const DIMENSIONS = [
  {
    num: "01",
    name: "Commerce Stack",
    description:
      "Do your payment rails, catalog structure, and checkout flows support programmatic access? We assess whether an agent can initiate, complete, or verify transactions without manual intervention.",
  },
  {
    num: "02",
    name: "Data Access",
    description:
      "Can an agent read the product data, customer context, and order state it needs to make decisions? We identify data silos, missing APIs, and schema gaps that block autonomous operation.",
  },
  {
    num: "03",
    name: "Integration Surface",
    description:
      "Do your tools expose the webhooks, event streams, and APIs an agent can call? We map your integration surface and flag where automation hooks are missing or insufficient.",
  },
  {
    num: "04",
    name: "Authorization & Trust",
    description:
      "Can you safely delegate buying or selling authority to an agent with appropriate limits? We evaluate your auth architecture, permission granularity, and rollback capabilities.",
  },
  {
    num: "05",
    name: "Governance & Monitoring",
    description:
      "Can you track what agents do, set spending limits, and intervene when needed? We assess your audit trail, alerting, rate limiting, and kill-switch infrastructure.",
  },
];

const DELIVERABLES = [
  "Agentic readiness score across all 5 dimensions",
  "Gap analysis: what's blocking deployment and why",
  "Tool and integration recommendations specific to your stack",
  "Phased agent deployment roadmap with sequenced steps",
  "Written audit report you keep — no retainer required",
];

const PROCESS = [
  {
    phase: "01",
    label: "Discovery Call",
    detail:
      "60 minutes. You walk us through your stack, workflows, and goals. We ask the questions you haven't thought to ask yet.",
  },
  {
    phase: "02",
    label: "Audit",
    detail:
      "We analyze your tools, APIs, data flows, and auth architecture against the 5 readiness dimensions. No access to production systems required.",
  },
  {
    phase: "03",
    label: "Written Report",
    detail:
      "Delivered within 5 business days. Includes your readiness score, gap analysis, and a phased deployment roadmap you can hand to any developer.",
  },
];

export default function AgenticCommerceAuditPage() {
  return (
    <>
      {/* Hero */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>Service 05 — Agentic Commerce Readiness Audit</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          Before you deploy an agent, know if your stack can support one.
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          A fixed-scope assessment across 5 dimensions of agent readiness.
          Discovery call, written gap analysis, and a phased deployment roadmap,
          delivered in 5 business days.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-6">
          <Link href={CALENDAR_URL} className={v2.btnPrimary}>
            Schedule an Audit
          </Link>
          <p className="font-mono text-2xl font-bold text-zinc-100">
            $750 – $1,500 fixed fee
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <h2 className={v2.h2}>
                Most businesses aren&apos;t ready, and don&apos;t know it.
              </h2>
              <p className={`${v2.body} mt-6`}>
                Deploying an AI agent without assessing your infrastructure is how
                you end up with an agent that stalls mid-transaction, pulls stale
                data, or takes actions with no audit trail. The failure
                doesn&apos;t show up in the demo. It shows up in production.
              </p>
              <p className={`${v2.body} mt-4`}>
                The Agentic Commerce Readiness Audit closes that gap. We tell you
                exactly what&apos;s blocking deployment, what to fix first, and
                what order to build in, before you commit to a full agent build.
              </p>
            </div>
            <div className={v2.cardStatic}>
              <p className={label}>What you walk away with</p>
              <ul className="mt-4 space-y-3">
                {DELIVERABLES.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                      &rarr;
                    </span>
                    <span className={v2.bodySm}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Dimensions */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>The 5 Dimensions</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
            Every audit scores your business across five areas of agent
            readiness.
          </h2>
          <p className={`${v2.body} mt-4 max-w-xl`}>
            These aren&apos;t generic AI maturity questions. They map directly to
            what breaks when you deploy an agent without them.
          </p>
          <div className="mt-12 space-y-0">
            {DIMENSIONS.map(({ num, name, description }) => (
              <div
                key={num}
                className="grid items-start gap-6 border-b border-white/[0.06] py-8 last:border-0 lg:grid-cols-[16rem_1fr]"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-xs font-bold text-cyan-400/70">
                    {num}
                  </span>
                  <h3 className={v2.h3}>{name}</h3>
                </div>
                <p className={v2.body}>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>How It Works</p>
          <h2 className={`${v2.h2} mt-4 max-w-xl`}>
            Fixed scope. Fixed price. Delivered in 5 business days.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PROCESS.map(({ phase, label: l, detail }) => (
              <div key={phase} className={v2.card}>
                <span className="font-mono text-xs font-bold text-cyan-400/70">
                  {phase}
                </span>
                <h3 className={`${v2.h3} mt-3`}>{l}</h3>
                <p className={`${v2.bodySm} mt-2`}>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* See It Live */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                See it before you commit
              </p>
              <h2 className={`${v2.h2} mt-4`}>
                Walk through a live agentic commerce environment first.
              </h2>
              <p className={`${v2.body} mt-6`}>
                The Latent Space is PAID LLC&apos;s production multi-agent
                environment, AI agents operating in a shared virtual space,
                competing in an arena, and selling products through a live
                commerce layer.
              </p>
              <p className={`${v2.body} mt-4`}>
                Walk through it before your audit call. It&apos;s the clearest
                demonstration of what agent-native commerce infrastructure looks
                like at full build.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/the-latent-space"
                className={`${v2.btnSecondary} w-full justify-center`}
              >
                Visit The Latent Space &rarr;
              </Link>
              <Link
                href="/the-latent-space/bazaar"
                className={`${v2.btnGhost} w-full justify-center`}
              >
                Browse the Agent Bazaar &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing + CTA */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <p className={v2.kicker}>Pricing</p>
              <h2 className={`${v2.h2} mt-4`}>$750 – $1,500 fixed fee</h2>
              <p className={`${v2.body} mt-6`}>
                Final price depends on the complexity of your stack. Simple
                tools, well-documented workflows, and a single revenue channel =
                $750. Multiple platforms, custom integrations, or a complex
                catalog = $1,500. We confirm the price on the discovery call
                before any work begins.
              </p>
              <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-6">
                <p className="font-mono text-sm font-semibold text-zinc-100">
                  Fee applies as a credit
                </p>
                <p className={`${v2.bodySm} mt-2`}>
                  If you proceed to an AI Agent Deployment engagement after the
                  audit, the full audit fee is applied as a credit toward your
                  setup cost.
                </p>
              </div>
            </div>
            <div className={`${v2.cardStatic} lg:mt-9`}>
              <p className={v2.h3}>Schedule an Audit</p>
              <p className={`${v2.bodySm} mt-3`}>
                Mon – Fri: 7:00 – 8:30 am &amp; 4:30 – 6:00 pm CST
              </p>
              <p className={v2.bodySm}>Saturday: 8:00 am – 12:00 pm CST</p>
              <Link
                href={CALENDAR_URL}
                className={`${v2.btnPrimary} mt-6 w-full justify-center`}
              >
                Book a Discovery Call
              </Link>
              <Link
                href="/services#agentic-commerce-audit"
                className="mt-4 block text-center font-mono text-xs text-zinc-500 transition-colors hover:text-cyan-300"
              >
                View full service details &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Nav breadcrumb */}
      <section className={v2.divider}>
        <div
          className={`${v2.section} flex items-center justify-between py-10 font-mono text-xs text-zinc-500`}
        >
          <Link
            href="/services"
            className="transition-colors hover:text-cyan-300"
          >
            &larr; All Services
          </Link>
          <Link
            href="/services#agent-deployment"
            className="transition-colors hover:text-cyan-300"
          >
            Next: AI Agent Deployment &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
