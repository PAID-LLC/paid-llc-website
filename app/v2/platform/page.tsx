import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

export const metadata = { title: "Platform" };

const pillars = [
  {
    id: "automation",
    kicker: "[01] // Enterprise Automation",
    title: "Workflows that run without babysitting.",
    body: "We take the processes burning your team's hours and rebuild them as agent-driven pipelines with observability and rollback. Scope is fixed per stage; you approve each exit gate before the next begins.",
    deliverables: [
      "Automation leverage audit: every candidate workflow scored by hours saved, risk, and data readiness",
      "Written specification per automation: intent, constraints, failure modes, verification plan",
      "Deployed pipeline on your stack or ours, with monitoring and a human override path",
      "30-day operate period: tuning, QA agent coverage, handoff documentation",
    ],
    engagement: "Fixed-fee per workflow, scoped after the audit.",
  },
  {
    id: "commerce",
    kicker: "[02] // Financial Operations Layer",
    title: "Checkout that works for humans and agents.",
    body: "Payment infrastructure that closes the sale regardless of who arrives: a person with a card, or an autonomous agent with a budget and a mandate. We run this stack in production on this domain; we install the same layer for you.",
    deliverables: [
      "Stripe and crypto checkout with verified webhooks and automated fulfillment",
      "Agent-readable storefront: agent.json discovery, UCP endpoints, MCP tool surface",
      "Delivery automation: signed URLs, email receipts, list capture",
      "Agentic Commerce Audit: your site reviewed the way an agent sees it, with a fix list",
    ],
    engagement: "Audit first (fixed fee), implementation scoped from its findings.",
    cta: { label: "Request an Agentic Commerce Audit", href: "/services/agentic-commerce-audit" },
  },
  {
    id: "specdev",
    kicker: "[03] // Specification-Driven Development",
    title: "Software anchored to a contract, not a codebase.",
    body: "AI generates code faster than anyone reviews it. We make the specification the durable artifact: precise intent, constraints, and proof. Implementations regenerate; the contract holds across model upgrades and rewrites.",
    deliverables: [
      "Specification library for your product: each feature as intent, constraints, verification",
      "Agent implementation workflow: specs drive generation, QA agents verify against them",
      "Edge-deployed builds with pre-deploy checklists and post-deploy verification",
      "Team training: your developers running the spec-driven loop themselves",
    ],
    engagement: "Project-based or advisory retainer.",
  },
];

const proof = [
  { stat: "19", label: "MCP tools in production" },
  { stat: "7", label: "live agent rooms" },
  { stat: "2", label: "payment rails (card + crypto)" },
  { stat: "<60s", label: "purchase to delivery" },
];

export default function V2Platform() {
  return (
    <>
      {/* Hero */}
      <section className={`${v2.section} pt-24 pb-16`}>
        <p className={v2.kicker}>The Platform</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          Three layers. One operating{" "}
          <span className="text-cyan-400">thesis.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Businesses that win the next decade will be legible to AI agents and
          run by them where it counts. Everything we sell installs a piece of
          that capability, and everything we sell runs in production here
          first.
        </p>
      </section>

      {/* Proof strip */}
      <section className={v2.divider}>
        <div className={`${v2.section} grid grid-cols-2 gap-6 py-10 sm:grid-cols-4`}>
          {proof.map((p) => (
            <div key={p.label}>
              <p className="font-mono text-3xl font-bold text-cyan-300">{p.stat}</p>
              <p className={`${v2.mono} mt-1`}>{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      {pillars.map((pillar) => (
        <section key={pillar.id} id={pillar.id} className={v2.divider}>
          <div className={`${v2.section} ${v2.sectionPad} grid gap-10 lg:grid-cols-[1fr_1.2fr]`}>
            <div>
              <p className={v2.kicker}>{pillar.kicker}</p>
              <h2 className={`${v2.h2} mt-4`}>{pillar.title}</h2>
              <p className={`${v2.body} mt-5`}>{pillar.body}</p>
              <p className="mt-5 font-mono text-xs text-zinc-500">
                <span className="text-zinc-300">Engagement:</span>{" "}
                {pillar.engagement}
              </p>
              {pillar.cta && (
                <Link href={pillar.cta.href} className={`${v2.btnPrimary} mt-6`}>
                  {pillar.cta.label} <span aria-hidden>&rarr;</span>
                </Link>
              )}
            </div>
            <div className={v2.cardStatic}>
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                deliverables
              </p>
              <ul className="mt-4 space-y-3">
                {pillar.deliverables.map((d) => (
                  <li key={d} className="flex gap-3 text-sm leading-relaxed text-zinc-400">
                    <span aria-hidden className="mt-1 text-cyan-400/70">›</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      {/* Closing CTA */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-20 text-center`}>
          <h2 className={v2.h2}>Start with a conversation.</h2>
          <p className={`${v2.body} mx-auto mt-4 max-w-xl`}>
            Thirty minutes. Bring the workflow that hurts or the revenue you
            think agents should be generating. We will tell you what we would
            build and what it costs.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/contact" className={v2.btnPrimary}>
              Book a discovery call <span aria-hidden>&rarr;</span>
            </Link>
            <Link href="/the-latent-space" className={v2.btnGhost}>
              See the live demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
