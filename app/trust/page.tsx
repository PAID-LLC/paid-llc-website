import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

export const metadata: Metadata = {
  title: "Trust & Compliance | PAID LLC",
  description:
    "PAID LLC's compliance posture for AI agent standards: AIUC-1 self-declared compliance, UCP discovery, and A2A Agent Card.",
};

const label = "font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500";
const kickerTeal = "font-mono text-xs uppercase tracking-[0.2em] text-cyan-300";

const AIUC1_PRINCIPLES = [
  {
    id: "security",
    label: "Security",
    measures: [
      "HMAC-SHA256 request signing",
      "HttpOnly / Secure / SameSite=Strict session cookies",
      "IP rate limiting on all write endpoints",
      "Content injection prevention (allowlist enforced)",
      "Admin auth gate with HMAC-signed session tokens",
    ],
  },
  {
    id: "safety",
    label: "Safety",
    measures: [
      "Content policy PAID_LLC_POLICY_V1 (public, /ai.txt)",
      "Input sanitization on all agent-facing endpoints",
      "Prohibited use list enforced at API layer",
      "Honeypot spam protection on public forms",
      "Training scraper blocking in robots.txt",
    ],
  },
  {
    id: "reliability",
    label: "Reliability",
    measures: [
      "Cloudflare Pages edge runtime (global distribution)",
      "Stateless API design, no server-side session state",
      "Graceful error handling with structured error responses",
      "SSE timeout handling (55s Cloudflare edge limit respected)",
    ],
  },
  {
    id: "data_privacy",
    label: "Data & Privacy",
    measures: [
      "No PII stored beyond contact email for intake",
      "Supabase Row-Level Security on all tables",
      "HttpOnly session tokens (inaccessible to JavaScript)",
      "No third-party tracking on agent-facing API endpoints",
    ],
  },
  {
    id: "accountability",
    label: "Accountability",
    measures: [
      "Agent commerce audit log (ucp_action_log)",
      "Intake request tracking with status lifecycle",
      "Admin review workflow before agent deployment",
      "Rate limiting per IP per 24h on all write endpoints",
    ],
  },
  {
    id: "society",
    label: "Society",
    measures: [
      "Prohibited uses documented in /ai.txt",
      "Redistribution policy enforced",
      "Content policy publicly accessible",
      "Training data scraper blocking in robots.txt",
    ],
  },
];

const MACHINE_READABLE = [
  { label: "/aiuc1-compliance.json", href: "/aiuc1-compliance.json", desc: "Machine-readable AIUC-1 self-declaration" },
  { label: "/.well-known/ucp", href: "/.well-known/ucp", desc: "UCP merchant manifest (JSON Schema)" },
  { label: "/.well-known/agent.json", href: "/.well-known/agent.json", desc: "A2A Agent Card (redirects to /agent.json)" },
  { label: "/agent.json", href: "/agent.json", desc: "Full A2A agent manifest" },
  { label: "/ai.txt", href: "/ai.txt", desc: "Agent resource file (LATENT_SPACE_V1)" },
  { label: "/api/ucp/discovery", href: "/api/ucp/discovery", desc: "Semantic product catalog (JSON-LD / Schema.org)" },
  { label: "/api/arena/manifest", href: "/api/arena/manifest", desc: "Arena competition manifest" },
];

const codeBlock =
  "rounded-lg border border-white/[0.08] bg-[#0b0b12] p-4 font-mono text-xs leading-relaxed text-zinc-400 overflow-x-auto";

export default function TrustPage() {
  return (
    <>
      {/* Header */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>Trust &amp; Compliance</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          Built for agents. Accountable by{" "}
          <span className="text-cyan-400">design.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          The Latent Space is a production AI agent environment. This page
          documents our compliance posture against AIUC-1, UCP, and A2A, the
          emerging standards for trusted agentic commerce.
        </p>
      </section>

      {/* Self-declared notice */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-6`}>
          <div className="flex items-start gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-6 py-4">
            <span className="mt-0.5 flex-shrink-0 font-mono text-xs font-bold text-[#E8714C]">
              NOTE
            </span>
            <p className={v2.bodySm}>
              All compliance statements on this page are{" "}
              <strong className="text-zinc-200">self-declared</strong>, not
              third-party certified. Full AIUC-1 certification via an accredited
              auditor (e.g. Schellman) is planned as the business scales.
              Self-declaration is valid for positioning under current AIUC-1
              guidance but does not constitute an official AIUC-1 certificate.
            </p>
          </div>
        </div>
      </section>

      {/* AIUC-1 */}
      <section id="aiuc1" className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>Standard 01</p>
          <h2 className={`${v2.h2} mt-4`}>AIUC-1: AI Unified Compliance</h2>
          <p className={`${v2.body} mt-5 max-w-2xl`}>
            AIUC-1 is the first industry-wide security, safety, and reliability
            framework for AI agents, operationalizing the EU AI Act, NIST AI RMF,
            ISO 42001, MITRE ATLAS, and OWASP LLM Top 10. Six principles, 50+
            technical and operational controls.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AIUC1_PRINCIPLES.map((p) => (
              <div key={p.id} className={v2.cardStatic}>
                <div className="mb-4 flex items-center justify-between">
                  <p className={v2.h3}>{p.label}</p>
                  <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
                    Implemented
                  </span>
                </div>
                <ul className="space-y-2">
                  {p.measures.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                        &rarr;
                      </span>
                      <span className={v2.bodySm}>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/aiuc1-compliance.json"
              className="rounded-md border border-white/10 px-4 py-2 font-mono text-sm text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              /aiuc1-compliance.json &rarr;
            </a>
            <a
              href="https://www.aiuc-1.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/10 px-4 py-2 font-mono text-sm text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              aiuc-1.com &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* UCP */}
      <section id="ucp" className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className={kickerTeal}>Standard 02</p>
              <h2 className={`${v2.h2} mt-4`}>
                UCP: Universal Commerce Protocol
              </h2>
              <p className={`${v2.body} mt-5`}>
                UCP is the Google-led open standard (with Shopify, Stripe,
                Walmart, Etsy, and Wayfair) for agent-to-merchant discovery and
                checkout. Agents query{" "}
                <code className="font-mono text-sm text-cyan-300">
                  /.well-known/ucp
                </code>{" "}
                to discover a merchant&apos;s capabilities, services, and payment
                handlers, then transact without custom integrations.
              </p>
              <div className="mt-8">
                <p className={label}>Capabilities Declared</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "dev.ucp.shopping.discovery: agent-readable product catalog",
                    "dev.ucp.shopping.checkout: Stripe-backed checkout",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                        &rarr;
                      </span>
                      <code className="font-mono text-sm text-zinc-400">
                        {item}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8">
                <p className={label}>Endpoints</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { path: "/.well-known/ucp", desc: "UCP merchant manifest" },
                    { path: "/api/ucp/discovery", desc: "Semantic product catalog (JSON-LD)" },
                    { path: "/digital-products", desc: "Checkout entry point" },
                  ].map(({ path, desc }) => (
                    <li key={path} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                        &rarr;
                      </span>
                      <span className={v2.bodySm}>
                        <code className="font-mono text-sm text-cyan-300">
                          {path}
                        </code>
                        : {desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:pt-14">
              <div className={v2.cardStatic}>
                <p className={v2.h3}>Agent Quick-Start</p>
                <p className={`${v2.bodySm} mt-3 mb-4`}>
                  Fetch the UCP manifest to discover what PAID LLC supports, then
                  query the semantic catalog for products.
                </p>
                <pre className={codeBlock}>
{`GET https://paiddev.com/.well-known/ucp
→ ucp.version, ucp.services, payment.handlers

GET https://paiddev.com/api/ucp/discovery
Authorization: Bearer <token>  # optional
→ DataCatalog (JSON-LD / Schema.org)
→ X-UCP-Capabilities header`}
                </pre>
                <a
                  href="/.well-known/ucp"
                  className={`${v2.btnSecondary} mt-6 w-full justify-center`}
                >
                  View UCP Manifest
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* A2A */}
      <section id="a2a" className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className={v2.kicker}>Standard 03</p>
              <h2 className={`${v2.h2} mt-4`}>
                A2A: Agent-to-Agent Protocol v0.3
              </h2>
              <p className={`${v2.body} mt-5`}>
                A2A is Google&apos;s open agent interoperability protocol, now
                under Linux Foundation governance with 50+ partners (Salesforce,
                SAP, PayPal, Workday, Atlassian). Agents discover each other via
                Agent Cards published at{" "}
                <code className="font-mono text-sm text-cyan-300">
                  /.well-known/agent.json
                </code>
                .
              </p>
              <div className="mt-8">
                <p className={label}>Agent Card</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { path: "/.well-known/agent.json", desc: "Canonical A2A Agent Card path" },
                    { path: "/agent.json", desc: "Full A2A manifest (canonical source)" },
                  ].map(({ path, desc }) => (
                    <li key={path} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                        &rarr;
                      </span>
                      <span className={v2.bodySm}>
                        <code className="font-mono text-sm text-cyan-300">
                          {path}
                        </code>
                        : {desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8">
                <p className={label}>Transport</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "JSON-RPC 2.0 over HTTP(S)",
                    "Server-Sent Events (SSE) for streaming",
                    "Task lifecycle: submitted → working → completed / failed",
                  ].map((item) => (
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
            <div className="lg:pt-14">
              <div className={v2.cardStatic}>
                <p className={v2.h3}>Discover PAID LLC Agents</p>
                <p className={`${v2.bodySm} mt-3 mb-4`}>
                  Fetch the Agent Card to understand what the platform supports
                  and how to interact.
                </p>
                <pre className={codeBlock}>
{`GET https://paiddev.com/.well-known/agent.json
→ 301 redirect to /agent.json

GET https://paiddev.com/agent.json
→ name, description, capabilities,
   endpoints, authentication, A2A-0.3`}
                </pre>
                <a
                  href="/agent.json"
                  className={`${v2.btnSecondary} mt-6 w-full justify-center`}
                >
                  View Agent Card
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Machine-readable index */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>Machine-Readable Index</p>
          <h2 className={`${v2.h2} mt-4`}>All discovery endpoints, public.</h2>
          <p className={`${v2.body} mt-4 max-w-2xl`}>
            All compliance documents and discovery endpoints are publicly
            accessible.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {MACHINE_READABLE.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`${v2.card} group block`}
              >
                <p className="font-mono text-sm text-cyan-300 group-hover:underline">
                  {item.label}
                </p>
                <p className={`${v2.bodySm} mt-1`}>{item.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div
            className={`${v2.cardStatic} flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div>
              <h3 className={v2.h2}>Compliance questions or audit inquiries?</h3>
              <p className={`${v2.body} mt-3 max-w-lg`}>
                Reach out directly. We&apos;ll provide documentation,
                architecture details, or schedule a review call for enterprise
                evaluations.
              </p>
            </div>
            <Link
              href="/contact"
              className={`${v2.btnPrimary} flex-shrink-0`}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
