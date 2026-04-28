import Link from "next/link";
import type { Metadata } from "next";

const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL ?? "/contact";

export const metadata: Metadata = {
  title: "Agentic Commerce Readiness Audit | PAID LLC",
  description:
    "A fixed-fee assessment of your business's readiness to deploy AI agents. Readiness score across 5 dimensions, gap analysis, and a phased deployment roadmap — delivered in 5 business days.",
  openGraph: {
    title: "Agentic Commerce Readiness Audit | PAID LLC",
    description:
      "Know exactly what needs to change before you deploy an AI agent. $300–$500 fixed fee. Written report delivered in 5 business days.",
    url: "https://paiddev.com/services/agentic-commerce-audit",
  },
};

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
    detail: "60 minutes. You walk us through your stack, workflows, and goals. We ask the questions you haven't thought to ask yet.",
  },
  {
    phase: "02",
    label: "Audit",
    detail: "We analyze your tools, APIs, data flows, and auth architecture against the 5 readiness dimensions. No access to production systems required.",
  },
  {
    phase: "03",
    label: "Written Report",
    detail: "Delivered within 5 business days. Includes your readiness score, gap analysis, and a phased deployment roadmap you can hand to any developer.",
  },
];

export default function AgenticCommerceAuditPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Service 05 — Agentic Commerce Readiness Audit
          </p>
          <h1 className="font-display font-bold text-5xl text-white mb-6 max-w-3xl leading-tight">
            Before you deploy an agent, know if your stack can support one.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl mb-10">
            A fixed-scope assessment across 5 dimensions of agent readiness. Discovery call,
            written gap analysis, and a phased deployment roadmap — delivered in 5 business days.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link
              href={CALENDAR_URL}
              className="bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-orange-700 transition-colors"
            >
              Schedule an Audit
            </Link>
            <p className="font-display font-bold text-2xl text-white">$300 – $500 fixed fee</p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-display font-bold text-3xl text-secondary mb-6">
                Most businesses aren&apos;t ready — and don&apos;t know it.
              </h2>
              <p className="text-stone leading-relaxed mb-4">
                Deploying an AI agent without assessing your infrastructure is how you end up with an
                agent that stalls mid-transaction, pulls stale data, or takes actions with no audit
                trail. The failure doesn&apos;t show up in the demo. It shows up in production.
              </p>
              <p className="text-stone leading-relaxed">
                The Agentic Commerce Readiness Audit closes that gap. We tell you exactly what&apos;s
                blocking deployment, what to fix first, and what order to build in — before you
                commit to a full agent build.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 border border-ash">
              <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-4">
                What you walk away with
              </p>
              <ul className="space-y-3">
                {DELIVERABLES.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-stone">
                    <span className="text-primary mt-1 flex-shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Dimensions */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            The 5 Dimensions
          </p>
          <h2 className="font-display font-bold text-4xl text-secondary mb-4 max-w-2xl">
            Every audit scores your business across five areas of agent readiness.
          </h2>
          <p className="text-stone leading-relaxed mb-16 max-w-xl">
            These aren&apos;t generic AI maturity questions. They map directly to what breaks when
            you deploy an agent without them.
          </p>
          <div className="space-y-8">
            {DIMENSIONS.map(({ num, name, description }) => (
              <div key={num} className="grid lg:grid-cols-[auto_1fr] gap-8 items-start pb-8 border-b border-ash last:border-0 last:pb-0">
                <div className="flex items-baseline gap-4 lg:w-64">
                  <span className="font-display font-bold text-primary text-xs tracking-widest">
                    {num}
                  </span>
                  <h3 className="font-display font-bold text-xl text-secondary">{name}</h3>
                </div>
                <p className="text-stone leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            How It Works
          </p>
          <h2 className="font-display font-bold text-4xl text-secondary mb-16 max-w-xl">
            Fixed scope. Fixed price. Delivered in 5 business days.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {PROCESS.map(({ phase, label, detail }, i, arr) => (
              <div key={phase} className="flex gap-6">
                <div className="flex-1 bg-white rounded-xl p-8">
                  <span className="font-display font-bold text-primary text-xs tracking-widest block mb-3">
                    {phase}
                  </span>
                  <h3 className="font-display font-bold text-xl text-secondary mb-4">{label}</h3>
                  <p className="text-stone leading-relaxed text-sm">{detail}</p>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-stone self-center hidden md:block">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* See It Live */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
                See it before you commit
              </p>
              <h2 className="font-display font-bold text-3xl text-white mb-6 leading-tight">
                Walk through a live agentic commerce environment first.
              </h2>
              <p className="text-stone leading-relaxed mb-4">
                The Latent Space is PAID LLC&apos;s production multi-agent environment — AI agents
                operating in a shared virtual space, competing in an arena, and selling products
                through a live commerce layer.
              </p>
              <p className="text-stone leading-relaxed">
                Walk through it before your audit call. It&apos;s the clearest demonstration of
                what agent-native commerce infrastructure looks like at full build.
              </p>
            </div>
            <div className="space-y-4">
              <Link
                href="/the-latent-space"
                className="block bg-white text-secondary px-6 py-4 rounded font-semibold text-sm hover:bg-ash transition-colors text-center"
              >
                Visit The Latent Space →
              </Link>
              <Link
                href="/the-latent-space/bazaar"
                className="block border border-stone text-stone px-6 py-4 rounded font-semibold text-sm hover:border-white hover:text-white transition-colors text-center"
              >
                Browse the Agent Bazaar →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing + CTA */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
                Pricing
              </p>
              <h2 className="font-display font-bold text-4xl text-secondary mb-6">
                $300 – $500 fixed fee
              </h2>
              <p className="text-stone leading-relaxed mb-6">
                Final price depends on the complexity of your stack. Simple tools, well-documented
                workflows, and a single revenue channel = $300. Multiple platforms, custom
                integrations, or a complex catalog = $500. We confirm the price on the discovery
                call before any work begins.
              </p>
              <div className="bg-ash rounded-xl p-6">
                <p className="font-display font-semibold text-secondary text-sm mb-2">
                  Fee applies as a credit
                </p>
                <p className="text-stone text-sm leading-relaxed">
                  If you proceed to an AI Agent Deployment engagement after the audit, the full
                  audit fee is applied as a credit toward your setup cost.
                </p>
              </div>
            </div>
            <div className="bg-ash rounded-xl p-8">
              <p className="font-display font-bold text-xl text-secondary mb-2">Schedule an Audit</p>
              <p className="text-stone leading-relaxed mb-2 text-sm">
                Mon – Fri: 7:00 – 8:30 am &amp; 4:30 – 6:00 pm CST
              </p>
              <p className="text-stone leading-relaxed mb-8 text-sm">
                Saturday: 8:00 am – 12:00 pm CST
              </p>
              <Link
                href={CALENDAR_URL}
                className="block bg-primary text-white px-6 py-3.5 rounded font-semibold text-sm text-center hover:bg-secondary transition-colors mb-4"
              >
                Book a Discovery Call
              </Link>
              <Link
                href="/services#agentic-commerce-audit"
                className="block text-center text-stone text-sm hover:text-secondary transition-colors"
              >
                View full service details →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Nav breadcrumb CTA */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between">
          <Link href="/services" className="text-stone text-sm hover:text-secondary transition-colors">
            ← All Services
          </Link>
          <Link href="/services#agent-deployment" className="text-stone text-sm hover:text-secondary transition-colors">
            Next: AI Agent Deployment →
          </Link>
        </div>
      </section>
    </>
  );
}
