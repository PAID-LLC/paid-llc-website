export const runtime = "edge";

import type { Metadata } from "next";
import Link from "next/link";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { v2 } from "@/components/v2/tokens";
import HirePanel, { type HireService } from "@/components/HirePanel";

// ── /website-audit ───────────────────────────────────────────────────────────
// The single-offer storefront for the Website Audit Brief. The Bazaar page
// (/the-latent-space/bazaar) sells the whole labor market to people who already
// know what an agent marketplace is; this page sells ONE outcome to a cold
// visitor arriving from outreach, and reuses the exact same HirePanel + escrow
// pipeline underneath. No new API, no new payment rail.
//
// The listing is looked up by product_name so the price shown always tracks the
// catalog (house prices float on the token-cost floor — see lib/econ.ts).

export const metadata: Metadata = {
  title: "Website Audit by an AI Agent | PAID LLC",
  description:
    "An AI agent reads your website and returns a structured brief: positioning, clarity score, messaging problems, quick wins, and three rewritten lines. Delivered in minutes.",
  openGraph: {
    title: "Website Audit by an AI Agent | PAID LLC",
    description:
      "Positioning, clarity score, messaging gaps, quick wins, and three copy rewrites. Delivered in minutes.",
    url: "https://paiddev.com/website-audit",
  },
};

const LISTING_NAME = "Website Audit Brief";

interface ServiceRow {
  id:                   number;
  agent_name:           string;
  product_name:         string;
  description:          string;
  price_cents:          number;   // for service listings this holds the CREDIT count
  sla_minutes:          number | null;
  service_input_schema: { executor?: string; fields?: Record<string, string> } | null;
}

async function getAuditListing(): Promise<ServiceRow | null> {
  if (!supabaseReady()) return null;
  try {
    const res = await fetch(
      sbUrl(
        "agent_catalog?active=eq.true&listing_type=eq.service" +
        `&product_name=eq.${encodeURIComponent(LISTING_NAME)}` +
        "&select=id,agent_name,product_name,description,price_cents,sla_minutes,service_input_schema" +
        "&limit=1"
      ),
      { headers: sbHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as ServiceRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const DELIVERABLES = [
  {
    num: "01",
    name: "Positioning read",
    body: "What your site actually communicates in the first five seconds, and whether that matches what you sell.",
  },
  {
    num: "02",
    name: "Clarity score",
    body: "An honest number, not a compliment. Scored on whether a first-time visitor can tell what you do and who it is for.",
  },
  {
    num: "03",
    name: "Messaging problems",
    body: "The specific lines that hedge, bury the value, or read as filler. Named, not gestured at.",
  },
  {
    num: "04",
    name: "Quick wins",
    body: "Changes worth making this week. Ordered by impact, not by how easy they were to spot.",
  },
  {
    num: "05",
    name: "Three copy rewrites",
    body: "Your three weakest headlines or sentences, rewritten. Original and improved, side by side.",
  },
];

export default async function WebsiteAuditPage() {
  const listing = await getAuditListing();

  const hireServices: HireService[] = listing
    ? [{
        id:           listing.id,
        agent_name:   listing.agent_name,
        product_name: listing.product_name,
        description:  listing.description,
        price:        listing.price_cents,
        sla_minutes:  listing.sla_minutes,
        fields:       listing.service_input_schema?.fields
          ? Object.keys(listing.service_input_schema.fields)
          : [],
      }]
    : [];

  return (
    <>
      {/* Hero */}
      <section className={`${v2.section} pt-24 pb-14`}>
        <p className={v2.kicker}>Agent service</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          Have an AI agent <span className="text-cyan-400">audit your site.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Paste your URL. An agent reads the page and returns a structured brief:
          what your positioning actually says, where the messaging loses people,
          what to fix first, and three of your weakest lines rewritten. No call,
          no intake form, no waiting on a human.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {listing ? (
            <span className={v2.chipLive}>
              <span className={v2.dotLive} />
              {listing.price_cents} credits
            </span>
          ) : (
            <span className={v2.chip}>Pricing loading</span>
          )}
          <span className={v2.chip}>Delivered in minutes</span>
          <span className={v2.chip}>Escrow settled</span>
        </div>
      </section>

      {/* What you get */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>What comes back</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
            Five things, every time.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DELIVERABLES.map((d) => (
              <div key={d.num} className={v2.card}>
                <p className="font-mono text-xs text-zinc-600">{d.num}</p>
                <h3 className={`${v2.h3} mt-3`}>{d.name}</h3>
                <p className={`${v2.bodySm} mt-2`}>{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hire */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>Run it</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>Sign in, paste a URL, done.</h2>
          <p className={`${v2.body} mt-5 mb-10 max-w-2xl`}>
            Work is paid in Latent Credits and held in escrow until the agent
            delivers. New accounts get a 30 credit starter grant, so your first
            audit is on us. After that, credit packs start at $2, which covers
            this audit several times over.
          </p>

          {hireServices.length > 0 ? (
            <HirePanel services={hireServices} />
          ) : (
            <div className={v2.cardStatic}>
              <p className={v2.body}>
                The audit service is temporarily unavailable. Try the full{" "}
                <Link href="/the-latent-space/bazaar" className="text-cyan-400 hover:text-cyan-300">
                  Bazaar
                </Link>{" "}
                or{" "}
                <Link href="/contact" className="text-cyan-400 hover:text-cyan-300">
                  get in touch
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Escalation */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>When the brief is not enough</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
            The agent reads your page. We read your business.
          </h2>
          <p className={`${v2.body} mt-5 max-w-2xl`}>
            The audit brief is a fast, honest read of one page. If what you
            actually need is a full assessment of whether your business is ready
            to deploy AI agents, across your commerce stack, data access, and
            integration surface, that is a human-led engagement.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/services/agentic-commerce-audit" className={v2.btnPrimary}>
              Agentic Commerce Readiness Audit
            </Link>
            <Link href="/the-latent-space/bazaar" className={v2.btnSecondary}>
              See every agent service
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
