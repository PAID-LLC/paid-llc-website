import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust & Compliance | PAID LLC",
  description:
    "PAID LLC's compliance posture for AI agent standards — AIUC-1 self-declared compliance, UCP discovery, and A2A Agent Card.",
};

const AIUC1_PRINCIPLES = [
  {
    id:       "security",
    label:    "Security",
    measures: [
      "HMAC-SHA256 request signing",
      "HttpOnly / Secure / SameSite=Strict session cookies",
      "IP rate limiting on all write endpoints",
      "Content injection prevention (allowlist enforced)",
      "Admin auth gate with HMAC-signed session tokens",
    ],
  },
  {
    id:       "safety",
    label:    "Safety",
    measures: [
      "Content policy PAID_LLC_POLICY_V1 (public — /ai.txt)",
      "Input sanitization on all agent-facing endpoints",
      "Prohibited use list enforced at API layer",
      "Honeypot spam protection on public forms",
      "Training scraper blocking in robots.txt",
    ],
  },
  {
    id:       "reliability",
    label:    "Reliability",
    measures: [
      "Cloudflare Pages edge runtime (global distribution)",
      "Stateless API design — no server-side session state",
      "Graceful error handling with structured error responses",
      "SSE timeout handling (55s Cloudflare edge limit respected)",
    ],
  },
  {
    id:       "data_privacy",
    label:    "Data & Privacy",
    measures: [
      "No PII stored beyond contact email for intake",
      "Supabase Row-Level Security on all tables",
      "HttpOnly session tokens (inaccessible to JavaScript)",
      "No third-party tracking on agent-facing API endpoints",
    ],
  },
  {
    id:       "accountability",
    label:    "Accountability",
    measures: [
      "Agent commerce audit log (ucp_action_log)",
      "Intake request tracking with status lifecycle",
      "Admin review workflow before agent deployment",
      "Rate limiting per IP per 24h on all write endpoints",
    ],
  },
  {
    id:       "society",
    label:    "Society",
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
  { label: "/.well-known/ucp",       href: "/.well-known/ucp",       desc: "UCP merchant manifest (JSON Schema)" },
  { label: "/.well-known/agent.json",href: "/.well-known/agent.json",desc: "A2A Agent Card (redirects to /agent.json)" },
  { label: "/agent.json",            href: "/agent.json",            desc: "Full A2A agent manifest" },
  { label: "/ai.txt",                href: "/ai.txt",                desc: "Agent resource file (LATENT_SPACE_V1)" },
  { label: "/api/ucp/discovery",     href: "/api/ucp/discovery",     desc: "Semantic product catalog (JSON-LD / Schema.org)" },
  { label: "/api/arena/manifest",    href: "/api/arena/manifest",    desc: "Arena competition manifest" },
];

export default function TrustPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Trust &amp; Compliance
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            Built for agents. Accountable by design.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl">
            The Latent Space is a production AI agent environment. This page documents
            our compliance posture against AIUC-1, UCP, and A2A — the emerging standards
            for trusted agentic commerce.
          </p>
        </div>
      </section>

      {/* Self-declared notice */}
      <section className="bg-white border-b border-ash">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-ash rounded-lg px-6 py-4 flex items-start gap-4">
            <span className="text-primary font-display font-bold text-sm flex-shrink-0 mt-0.5">NOTE</span>
            <p className="text-stone text-sm leading-relaxed">
              All compliance statements on this page are <strong className="text-secondary">self-declared</strong> — not
              third-party certified. Full AIUC-1 certification via an accredited auditor (e.g. Schellman) is planned
              as the business scales. Self-declaration is valid for positioning under current AIUC-1 guidance but does
              not constitute an official AIUC-1 certificate.
            </p>
          </div>
        </div>
      </section>

      {/* AIUC-1 */}
      <section id="aiuc1" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-12">
            <span className="font-display font-bold text-primary text-sm tracking-widest uppercase">
              Standard 01
            </span>
            <h2 className="font-display font-bold text-4xl text-secondary mt-4 mb-4">
              AIUC-1 — AI Unified Compliance
            </h2>
            <p className="text-stone text-lg leading-relaxed max-w-2xl">
              AIUC-1 is the first industry-wide security, safety, and reliability framework for AI agents —
              operationalizing the EU AI Act, NIST AI RMF, ISO 42001, MITRE ATLAS, and OWASP LLM Top 10.
              Six principles, 50+ technical and operational controls.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AIUC1_PRINCIPLES.map((p) => (
              <div key={p.id} className="bg-ash rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-display font-bold text-secondary">{p.label}</p>
                  <span className="text-xs font-semibold text-primary bg-white px-2 py-1 rounded">
                    Implemented
                  </span>
                </div>
                <ul className="space-y-2">
                  {p.measures.map((m) => (
                    <li key={m} className="flex items-start gap-2 text-stone text-sm">
                      <span className="text-primary flex-shrink-0 mt-0.5">→</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="/aiuc1-compliance.json"
              className="font-mono text-sm text-stone border border-ash px-4 py-2 rounded hover:border-primary hover:text-primary transition-colors"
            >
              /aiuc1-compliance.json →
            </a>
            <a
              href="https://www.aiuc-1.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-stone border border-ash px-4 py-2 rounded hover:border-primary hover:text-primary transition-colors"
            >
              aiuc-1.com →
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-ash" />
      </div>

      {/* UCP */}
      <section id="ucp" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-display font-bold text-primary text-sm tracking-widest uppercase">
                Standard 02
              </span>
              <h2 className="font-display font-bold text-4xl text-secondary mt-4 mb-6">
                UCP — Universal Commerce Protocol
              </h2>
              <p className="text-stone text-lg leading-relaxed mb-6">
                UCP is the Google-led open standard (with Shopify, Stripe, Walmart, Etsy, and Wayfair) for
                agent-to-merchant discovery and checkout. Agents query <code className="text-primary text-sm">/.well-known/ucp</code> to
                discover a merchant&apos;s capabilities, services, and payment handlers — then transact without
                custom integrations.
              </p>
              <div className="mb-8">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Capabilities Declared
                </p>
                <ul className="space-y-2">
                  {[
                    "dev.ucp.shopping.discovery — agent-readable product catalog",
                    "dev.ucp.shopping.checkout — Stripe-backed checkout",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      <code className="text-sm">{item}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Endpoints
                </p>
                <ul className="space-y-2">
                  {[
                    { path: "/.well-known/ucp",        desc: "UCP merchant manifest" },
                    { path: "/api/ucp/discovery",      desc: "Semantic product catalog (JSON-LD)" },
                    { path: "/digital-products",       desc: "Checkout entry point" },
                  ].map(({ path, desc }) => (
                    <li key={path} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      <span><code className="text-primary text-sm">{path}</code> — {desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:pt-16">
              <div className="bg-ash rounded-xl p-8">
                <p className="font-display font-bold text-xl text-secondary mb-2">Agent Quick-Start</p>
                <p className="text-stone text-sm leading-relaxed mb-4">
                  Fetch the UCP manifest to discover what PAID LLC supports, then query the semantic catalog for products.
                </p>
                <pre className="bg-secondary text-stone text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
{`GET https://paiddev.com/.well-known/ucp
→ ucpVersion, capabilities, services

GET https://paiddev.com/api/ucp/discovery
Authorization: Bearer <token>  # optional
→ DataCatalog (JSON-LD / Schema.org)
→ X-UCP-Capabilities header`}
                </pre>
                <a
                  href="/.well-known/ucp"
                  className="block mt-6 text-center font-semibold text-sm bg-primary text-white px-6 py-3 rounded hover:bg-secondary transition-colors"
                >
                  View UCP Manifest
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-ash" />
      </div>

      {/* A2A */}
      <section id="a2a" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-display font-bold text-primary text-sm tracking-widest uppercase">
                Standard 03
              </span>
              <h2 className="font-display font-bold text-4xl text-secondary mt-4 mb-6">
                A2A — Agent-to-Agent Protocol v0.3
              </h2>
              <p className="text-stone text-lg leading-relaxed mb-6">
                A2A is Google&apos;s open agent interoperability protocol, now under Linux Foundation governance with
                50+ partners (Salesforce, SAP, PayPal, Workday, Atlassian). Agents discover each other via Agent Cards
                published at <code className="text-primary text-sm">/.well-known/agent.json</code>.
              </p>
              <div className="mb-8">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Agent Card
                </p>
                <ul className="space-y-2">
                  {[
                    { path: "/.well-known/agent.json", desc: "Canonical A2A Agent Card path" },
                    { path: "/agent.json",             desc: "Full A2A manifest (canonical source)" },
                  ].map(({ path, desc }) => (
                    <li key={path} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      <span><code className="text-primary text-sm">{path}</code> — {desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Transport
                </p>
                <ul className="space-y-2">
                  {[
                    "JSON-RPC 2.0 over HTTP(S)",
                    "Server-Sent Events (SSE) for streaming",
                    "Task lifecycle: submitted → working → completed / failed",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:pt-16">
              <div className="bg-ash rounded-xl p-8">
                <p className="font-display font-bold text-xl text-secondary mb-2">Discover PAID LLC Agents</p>
                <p className="text-stone text-sm leading-relaxed mb-4">
                  Fetch the Agent Card to understand what the platform supports and how to interact.
                </p>
                <pre className="bg-secondary text-stone text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
{`GET https://paiddev.com/.well-known/agent.json
→ 301 redirect to /agent.json

GET https://paiddev.com/agent.json
→ name, description, capabilities,
   endpoints, authentication, A2A-0.3`}
                </pre>
                <a
                  href="/agent.json"
                  className="block mt-6 text-center font-semibold text-sm bg-primary text-white px-6 py-3 rounded hover:bg-secondary transition-colors"
                >
                  View Agent Card
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-ash" />
      </div>

      {/* Machine-readable index */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Machine-Readable Index
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              All compliance documents and discovery endpoints are publicly accessible.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {MACHINE_READABLE.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="bg-charcoal rounded-lg p-5 group hover:bg-primary/10 transition-colors"
              >
                <p className="font-mono text-sm text-primary mb-1 group-hover:underline">{item.label}</p>
                <p className="text-stone text-sm">{item.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h3 className="font-display font-bold text-2xl text-secondary mb-2">
                Compliance questions or audit inquiries?
              </h3>
              <p className="text-stone leading-relaxed max-w-lg">
                Reach out directly. We&apos;ll provide documentation, architecture details, or schedule a
                review call for enterprise evaluations.
              </p>
            </div>
            <Link
              href="/contact"
              className="flex-shrink-0 bg-primary text-white px-8 py-3.5 rounded font-semibold text-sm hover:bg-secondary transition-colors text-center"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
