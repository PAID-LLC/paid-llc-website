import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

const CALENDAR_URL = process.env.NEXT_PUBLIC_CALENDAR_URL ?? "/contact";

export const metadata: Metadata = {
  title: "Services | PAID LLC",
  description:
    "AI Strategy Consulting, Implementation Advisory, Team Training, Web & Application Development, AI Agent Deployment, and Agentic Commerce Readiness Audits from PAID LLC.",
};

const label = "font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500";
const kickerTeal = "font-mono text-xs uppercase tracking-[0.2em] text-cyan-300";

function AvailabilityNote() {
  return (
    <div className="mt-5 border-t border-white/[0.06] pt-4">
      <p className={`${label} mb-2`}>Availability</p>
      <p className={v2.bodySm}>Mon – Fri: 7:00 – 8:30 am &amp; 4:30 – 6:00 pm CST</p>
      <p className={v2.bodySm}>Saturday: 8:00 am – 12:00 pm CST</p>
    </div>
  );
}

function CtaCard({
  title,
  body,
  ctaLabel,
  ctaHref,
  availability = false,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  availability?: boolean;
}) {
  return (
    <div className={v2.cardStatic}>
      <p className={v2.h3}>{title}</p>
      <p className={`${v2.body} mt-3`}>{body}</p>
      <Link href={ctaHref} className={`${v2.btnPrimary} mt-6 w-full justify-center`}>
        {ctaLabel}
      </Link>
      {availability && <AvailabilityNote />}
    </div>
  );
}

function LatentCard({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${v2.cardStatic} mt-6`}>
      <p className={kickerTeal}>{title}</p>
      <p className={`${v2.bodySm} mt-3`}>{body}</p>
      <Link
        href="/the-latent-space"
        className={`${v2.btnSecondary} mt-5 w-full justify-center`}
      >
        Visit The Latent Space
      </Link>
    </div>
  );
}

interface Service {
  id: string;
  num: string;
  agent: boolean;
  title: string;
  body: string;
  audience: string;
  listLabel: string;
  items: string[];
  price?: string;
  priceNote?: string;
  cta: { label: string; href: string; body: string };
  availability?: boolean;
  latent?: { title: string; body: string };
}

const services: Service[] = [
  {
    id: "consulting",
    num: "Service 01",
    agent: false,
    title: "AI Strategy Consulting",
    body: "Too many AI tools, no clear ROI, and no idea where to focus? We audit your operations, identify your highest-value AI opportunities, and deliver a roadmap your team can actually act on.",
    audience:
      "Business owners, operators, and teams who know AI matters but don't know where to focus.",
    listLabel: "Deliverables",
    items: [
      "AI opportunity audit",
      "Prioritized implementation roadmap",
      "Tool recommendations",
      "Implementation plan",
    ],
    price: "Starting at $1,500",
    cta: {
      label: "Book a Consultation",
      href: CALENDAR_URL,
      body: "Tell us about your business and where you want AI to make an impact. We'll take it from there.",
    },
    availability: true,
  },
  {
    id: "implementation",
    num: "Service 02",
    agent: true,
    title: "AI Implementation Advisory",
    body: "AI projects fail in the gap between planning and doing. We embed with your IT department and internal teams to configure tools, build workflows, and make sure solutions actually go live, not just get planned.",
    audience:
      "Businesses with an IT team in place that need an AI expert in the room to guide decisions, coordinate implementation, and keep the project on track.",
    listLabel: "Deliverables",
    items: [
      "Implementation planning and sequencing",
      "AI tool configuration guidance (Microsoft 365, Google Workspace, and more)",
      "Workflow design and process documentation",
      "Coordination with your IT team through go-live",
      "Post-launch review and optimization recommendations",
    ],
    price: "Starting at $5,000",
    cta: {
      label: "Start a Project",
      href: "/contact",
      body: "Tell us what you want to build. We'll scope it, price it, and get to work.",
    },
  },
  {
    id: "training",
    num: "Service 03",
    agent: false,
    title: "AI Team Training",
    body: "Your team knows AI matters, but nobody's using it consistently. We run hands-on workshops and training sessions that build real fluency across your workforce, not just awareness.",
    audience:
      "Teams and organizations ready to build practical AI fluency across their workforce, not just the tech department.",
    listLabel: "Formats & Deliverables",
    items: [
      "Lunch-and-learn (1.5–2 hrs)",
      "Half-day workshop",
      "Full-day workshop",
      "Branded session materials and reference guides",
      "Takeaway guides attendees keep after the session",
    ],
    priceNote:
      "Pricing depends on team size, format, and session length. Request a quote and we'll build a session that fits.",
    cta: {
      label: "Get a Custom Quote",
      href: "/contact",
      body: "Every team is different. Tell us your team size, goals, and available time, and we'll build a session that fits.",
    },
  },
  {
    id: "development",
    num: "Service 04",
    agent: true,
    title: "Web & Application Development",
    body: "Your website is your first impression and your always-on salesperson. We build professional sites and custom AI-powered applications that work as hard as you do. No templates, no shortcuts.",
    audience:
      "Businesses that need a credible web presence, a client-facing tool, or a custom application built with AI capabilities baked in from day one.",
    listLabel: "What We Build",
    items: [
      "Professional business websites and landing pages",
      "AI-integrated web applications",
      "Client portals and internal tools",
      "E-commerce and digital product storefronts",
      "Ongoing maintenance and support",
    ],
    priceNote:
      "Every project is scoped individually. Share what you need and we'll provide a detailed quote.",
    cta: {
      label: "Request a Quote",
      href: "/contact",
      body: "Tell us what you want to build. We'll scope it, price it, and get to work.",
    },
  },
  {
    id: "agentic-commerce-audit",
    num: "Service 05",
    agent: false,
    title: "Agentic Commerce Readiness Audit",
    body: "Before you deploy an AI agent, you need to know if your stack can support one. We audit your existing tools, workflows, and data infrastructure. We tell you exactly what needs to change before an agent can operate effectively on your behalf.",
    audience:
      "Businesses exploring AI agent deployment who want a clear picture of their readiness before committing to a full build, with a roadmap to close the gaps.",
    listLabel: "Deliverables",
    items: [
      "Agentic readiness score across 5 dimensions",
      "Gap analysis: what's blocking deployment and why",
      "Tool and integration recommendations",
      "Phased agent deployment roadmap",
      "Written audit report you keep",
    ],
    price: "$750 – $1,500 fixed fee",
    cta: {
      label: "Schedule an Audit",
      href: CALENDAR_URL,
      body: "A 60-minute discovery call followed by a written audit report delivered within 5 business days. Fixed scope, fixed price.",
    },
    availability: true,
    latent: {
      title: "See it live",
      body: "The Latent Space is PAID LLC's live agentic commerce environment where AI agents operate autonomously in a public venue. Walk through it before your audit call.",
    },
  },
];

const tiers = [
  {
    name: "Starter",
    setup: "$500 setup",
    monthly: "$150/mo",
    includes: "1 agent, 1 room, core personality, up to 5 catalog items",
  },
  {
    name: "Standard",
    setup: "$1,000 setup",
    monthly: "$225/mo",
    includes:
      "Custom personality + knowledge base, up to 20 catalog items, monthly tuning",
  },
  {
    name: "Custom",
    setup: "$2,000+ setup",
    monthly: "$300+/mo",
    includes:
      "Multi-agent setup, dedicated room design, full onboarding, priority support",
  },
];

const phases = [
  { phase: "01", label: "Discovery" },
  { phase: "02", label: "Strategy" },
  { phase: "03", label: "Implementation" },
  { phase: "04", label: "Ongoing Support" },
];

export default function Services() {
  return (
    <>
      {/* Header */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>Services</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          AI that works for your business.
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Strategy, implementation, team training, custom development, AI agent
          deployment, and agentic commerce readiness, plus self-serve digital
          guides for teams ready to move on their own.
        </p>
      </section>

      {/* Services 01-05 */}
      {services.map((s) => (
        <section key={s.id} id={s.id} className={v2.divider}>
          <div className={`${v2.section} ${v2.sectionPad}`}>
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <p className={s.agent ? kickerTeal : v2.kicker}>{s.num}</p>
                <h2 className={`${v2.h2} mt-4`}>{s.title}</h2>
                <p className={`${v2.body} mt-5`}>{s.body}</p>

                <div className="mt-8">
                  <p className={label}>Who it&apos;s for</p>
                  <p className={`${v2.body} mt-2`}>{s.audience}</p>
                </div>

                <div className="mt-8">
                  <p className={label}>{s.listLabel}</p>
                  <ul className="mt-3 space-y-2">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                          &rarr;
                        </span>
                        <span className={v2.bodySm}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {s.price && (
                  <p className="mt-8 font-mono text-2xl font-bold text-zinc-100">
                    {s.price}
                  </p>
                )}
                {s.priceNote && (
                  <p className={`${v2.body} mt-8`}>{s.priceNote}</p>
                )}
              </div>

              <div className="lg:pt-14">
                <CtaCard
                  title={s.cta.label}
                  body={s.cta.body}
                  ctaLabel={s.cta.label}
                  ctaHref={s.cta.href}
                  availability={s.availability}
                />
                {s.latent && (
                  <LatentCard title={s.latent.title} body={s.latent.body} />
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Service 06: AI Agent Deployment (tiers) */}
      <section id="agent-deployment" className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className={kickerTeal}>Service 06</p>
              <h2 className={`${v2.h2} mt-4`}>AI Agent Deployment</h2>
              <p className={`${v2.body} mt-5`}>
                Your business, running 24/7. We build and deploy a branded AI
                agent that represents your business in The Latent Space,
                answering questions, surfacing your products, and guiding
                visitors toward a decision. No chatbot scripts. No keyword
                matching. A fully conversational agent that knows your business
                and speaks for it.
              </p>

              <div className="mt-8">
                <p className={label}>Who it&apos;s for</p>
                <p className={`${v2.body} mt-2`}>
                  E-commerce brands, service businesses, and consultants with an
                  existing product or service catalog who want an always-on AI
                  presence that sells and answers, without adding headcount.
                </p>
              </div>

              <div className="mt-8">
                <p className={label}>Tiers</p>
                <div className="mt-4 space-y-3">
                  {tiers.map((t) => (
                    <div
                      key={t.name}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="font-mono text-sm font-semibold text-zinc-100">
                          {t.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          {t.setup} &middot; {t.monthly}
                        </span>
                      </div>
                      <p className={v2.bodySm}>{t.includes}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <p className={v2.bodySm}>
                  <span className="font-medium text-zinc-200">
                    Not sure which tier fits?
                  </span>{" "}
                  Start with the Agentic Commerce Readiness Audit, a fixed-fee
                  assessment that scopes your setup and recommends the right
                  tier. The fee applies as a credit if you proceed.
                </p>
              </div>
            </div>

            <div className="lg:pt-14">
              <CtaCard
                title="Book a Discovery Call"
                body="30 minutes. We'll qualify your catalog, walk you through what your agent would do, and tell you which tier makes sense. No commitment."
                ctaLabel="Book a Discovery Call"
                ctaHref={CALENDAR_URL}
                availability
              />
              <LatentCard
                title="See it before you commit"
                body="The Latent Space is our live agent environment. Walk in, talk to an agent, and see exactly what yours would do for your customers."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Digital Products CTA */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div
            className={`${v2.cardStatic} flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div>
              <p className={v2.kicker}>Self-serve</p>
              <h3 className={`${v2.h2} mt-3`}>
                Not ready for a full engagement?
              </h3>
              <p className={`${v2.body} mt-3 max-w-lg`}>
                Our digital guides let you start applying AI immediately, at
                your own pace.
              </p>
            </div>
            <Link
              href="/digital-products"
              className={`${v2.btnSecondary} flex-shrink-0`}
            >
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>How We Work</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
            Every engagement follows the same four-phase process.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {phases.map((p) => (
              <div key={p.phase} className={v2.card}>
                <span className="font-mono text-xs font-bold text-cyan-400/70">
                  {p.phase}
                </span>
                <h3 className={`${v2.h3} mt-3`}>{p.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
