export const runtime = "edge";

import Link from "next/link";
import type { Metadata } from "next";
import CoinbaseGuideButton from "@/components/CoinbaseGuideButton";

export const metadata: Metadata = {
  title: "Digital Products | PAID LLC",
  description:
    "Practical AI guides for Microsoft 365, Google Workspace, and small business operations. Get real results without a consultant.",
};

const products = [
  {
    category: "Business",
    title: "AI Readiness Assessment",
    description:
      "Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan.",
    price: "$14.99",
    slug: "ai-readiness-assessment",
    stripeUrl: "https://buy.stripe.com/14AcN60of28y0jAfXGcs809",
    isNew: false,
  },
  {
    category: "Microsoft",
    title: "Microsoft 365 Copilot Playbook",
    description:
      "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one.",
    price: "$19.99",
    slug: "microsoft-365-copilot-playbook",
    stripeUrl: "https://buy.stripe.com/fZu28s0of00qgiyaDmcs808",
    isNew: false,
  },
  {
    category: "Microsoft",
    title: "Excel + AI: Analyze Data Without a Data Analyst",
    description:
      "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data -- no advanced formulas or data background required.",
    price: "$14.99",
    slug: "excel-ai-data-analysis",
    stripeUrl: "https://buy.stripe.com/aFa6oI6MD28yeaqbHqcs807",
    isNew: false,
  },
  {
    category: "Microsoft",
    title: "AI-Powered Outlook: Smart Email System",
    description:
      "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook.",
    price: "$9.99",
    slug: "ai-powered-outlook",
    stripeUrl: "https://buy.stripe.com/aFacN6db15kKaYe8vecs806",
    isNew: false,
  },
  {
    category: "Google",
    title: "Google Workspace AI Guide",
    description:
      "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts.",
    price: "$19.99",
    slug: "google-workspace-ai-guide",
    stripeUrl: "https://buy.stripe.com/bJe14odb16oOaYe26Qcs805",
    isNew: false,
  },
  {
    category: "Google",
    title: "Gmail + AI: Inbox Zero for Business",
    description:
      "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries.",
    price: "$9.99",
    slug: "gmail-ai-inbox-zero",
    stripeUrl: "https://buy.stripe.com/00w9AU7QHeVk3vMdPycs804",
    isNew: false,
  },
  {
    category: "Business",
    title: "The Solopreneur Content Engine",
    description:
      "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints.",
    price: "$19.99",
    slug: "solopreneur-content-engine",
    stripeUrl: "https://buy.stripe.com/7sY5kEc6X7sS6HY7racs803",
    isNew: false,
  },
  {
    category: "Business",
    title: "Small Business AI Operations Playbook",
    description:
      "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting.",
    price: "$24.99",
    slug: "small-business-ai-operations",
    stripeUrl: "https://buy.stripe.com/bJefZi7QH7sS6HYdPycs802",
    isNew: false,
  },
  {
    category: "Business",
    title: "ChatGPT Business Prompt Library",
    description:
      "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service -- organized by function and ready to use.",
    price: "$12.99",
    slug: "chatgpt-business-prompt-library",
    stripeUrl: "https://buy.stripe.com/fZucN65IzcNcgiydPycs801",
    isNew: false,
  },
  {
    category: "Business",
    title: "Claude for Business: The Practical Playbook",
    description:
      "Real workflows for using Claude in business: document analysis, proposal writing, client communications, and a persistent AI assistant that knows your business.",
    price: "$19.99",
    slug: "claude-for-business-practical-playbook",
    stripeUrl: "https://buy.stripe.com/fZu14ognd28y6HYfXGcs80j",
    isNew: true,
  },
  {
    category: "Business",
    title: "AI Agents for Small Business",
    description:
      "Plain-English guide to deploying your first AI agent -- lead follow-up, proposal generation, triage, and automation -- in 30 days with no code required.",
    price: "$19.99",
    slug: "ai-agents-for-small-business",
    stripeUrl: "https://buy.stripe.com/aFa5kE9YPeVk7M2fXGcs80k",
    isNew: true,
  },
  {
    category: "Business",
    title: "Build It Without Code: A Non-Developer's Guide to Cursor",
    description:
      "Use Cursor and AI to build landing pages, internal tools, intake forms, and data dashboards -- without hiring a developer or learning to code.",
    price: "$19.99",
    slug: "cursor-ai-coding-guide",
    stripeUrl: "https://buy.stripe.com/00w28sef5dRg4zQfXGcs80l",
    isNew: true,
  },
  {
    category: "Microsoft",
    title: "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide",
    description:
      "Team-level Copilot deployment: meeting recaps, collaborative documents, Copilot Pages, and shared prompt libraries that make AI output consistent across your whole team.",
    price: "$19.99",
    slug: "copilot-cowork-microsoft-365-team-guide",
    stripeUrl: "https://buy.stripe.com/5kQ28s0of14u6HYh1Kcs80m",
    isNew: true,
  },
  {
    category: "Business",
    title: "The Free AI Stack: An End-to-End AI Setup for Small Business",
    description:
      "Build a complete five-tool AI stack -- writing, visuals, automation, inbox, and organization -- for $0 using Claude, Gemini, Canva, Zapier, and Notion free tiers.",
    price: "$14.99",
    slug: "free-ai-stack-small-business-setup",
    stripeUrl: "https://buy.stripe.com/3cI3cw1sjdRg9Ua4eYcs80n",
    isNew: true,
  },
  {
    category: "Business",
    title: "Jumpstart Your Business with AI for Under $100 a Month",
    description:
      "Concentrate your AI budget into two or three tools that cover 90% of small business needs. Claude Pro, Zapier Starter, and one specialized tool -- wired together and producing ROI in week one.",
    price: "$14.99",
    slug: "jumpstart-business-ai-under-100",
    stripeUrl: "https://buy.stripe.com/bJefZifj94gG0jA26Qcs80o",
    isNew: true,
  },
  {
    category: "Business",
    title: "Enterprise AI Deployment: The Complete Implementation Guide",
    description:
      "An 8-phase enterprise AI deployment framework covering use case selection, vendor evaluation, security and compliance, pilot design, change management, phased rollout, and ROI measurement.",
    price: "$29.99",
    slug: "enterprise-ai-deployment-guide",
    stripeUrl: "https://buy.stripe.com/4gM7sMfj9eVkfeudPycs80p",
    isNew: true,
  },
];

const categoryColors: Record<string, string> = {
  Microsoft: "text-primary",
  Google: "text-primary",
  Business: "text-primary",
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "PAID LLC AI Guides",
  "description": "Practical AI guides for Microsoft 365, Google Workspace, and small business operations.",
  "url": "https://paiddev.com/digital-products",
  "itemListElement": products.map((p, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "item": {
      "@type": "Product",
      "@id": `https://paiddev.com/digital-products#${p.slug}`,
      "name": p.title,
      "description": `PDF guide, instant download. ${p.description}`,
      "url": `https://paiddev.com/digital-products#${p.slug}`,
      "brand": { "@type": "Brand", "name": "PAID LLC" },
      "category": p.category,
      "encodingFormat": "application/pdf",
      "offers": {
        "@type": "Offer",
        "price": p.price.replace("$", ""),
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "url": p.stripeUrl,
        "seller": { "@type": "Organization", "name": "PAID LLC", "url": "https://paiddev.com" },
      },
    },
  })),
};

export default function DigitalProducts() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {/* Page Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Digital Products
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            AI guides that get you moving.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl">
            Practical, step-by-step guides for Microsoft 365, Google Workspace,
            and business operations -- no consultant required.
          </p>
        </div>
      </section>

      {/* Product Grid */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product) => (
              <div
                key={product.slug}
                id={product.slug}
                className="border border-ash rounded-xl overflow-hidden flex flex-col hover:border-stone/40 transition-colors"
              >
                {/* Cover */}
                <div className="bg-secondary aspect-[3/2] flex items-center justify-center px-8 relative">
                  {product.isNew && (
                    <span className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                      New
                    </span>
                  )}
                  <p className="font-display font-bold text-white text-center text-lg leading-snug">
                    {product.title}
                  </p>
                </div>
                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <span
                    className={`text-xs font-semibold tracking-widest uppercase mb-3 ${categoryColors[product.category]}`}
                  >
                    {product.category}
                  </span>
                  <h3 className="font-display font-bold text-secondary text-base mb-3 leading-snug">
                    {product.title}
                  </h3>
                  <p className="text-stone text-sm leading-relaxed mb-6 flex-1">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-secondary text-lg">
                      {product.price}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={product.stripeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-white px-4 py-2 rounded text-sm font-semibold hover:bg-secondary transition-colors"
                      >
                        Buy Now
                      </a>
                      <CoinbaseGuideButton productSlug={product.slug} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment note */}
          <p className="text-center text-stone text-sm mt-12">
            Not satisfied? We offer a 7-day refund -- no hassle, no fine print.{" "}
            <a href="mailto:hello@paiddev.com" className="text-primary hover:text-secondary transition-colors">
              Email us
            </a>{" "}
            within 7 days of purchase.
          </p>
        </div>
      </section>

      {/* Bundle CTA */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="font-display font-bold text-3xl text-secondary mb-4">
            Need the whole stack?
          </h2>
          <p className="text-stone leading-relaxed mb-8 max-w-lg mx-auto">
            Get all 16 guides for one flat price -- the complete AI toolkit
            from free-tier setup to enterprise deployment.
          </p>
          <a
            href="https://buy.stripe.com/9B68wQ4Ev14u9Ua8vecs80q"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
          >
            Get the Full Bundle -- $119
          </a>
        </div>
      </section>

      {/* Founding Member CTA */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
              Founding Member
            </p>
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              All 16 guides. Every new guide for the next 12 months.
            </h2>
            <p className="text-stone text-lg leading-relaxed mb-4">
              Founding Members get the complete current library plus every guide
              PAID LLC publishes over the next 12 months -- automatically
              delivered as each one releases.
            </p>
            <p className="text-stone text-lg leading-relaxed mb-8">
              One flat price. No renewals. No subscriptions.
            </p>
            <a
              href="https://buy.stripe.com/8x200k6MD4gG8Q6dPycs80r"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors mr-4"
            >
              Become a Founding Member -- $199
            </a>
          </div>
        </div>
      </section>

      {/* Consulting CTA */}
      <section className="bg-white border-t border-ash">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="font-display font-bold text-4xl text-secondary mb-4">
              Need more than a guide?
            </h2>
            <p className="text-stone text-lg leading-relaxed mb-8">
              Our consulting and implementation services take you from strategy
              to shipping -- with a dedicated partner the whole way.
            </p>
            <Link
              href="/services"
              className="inline-block border-2 border-secondary text-secondary px-8 py-4 rounded font-semibold text-sm hover:bg-secondary hover:text-white transition-colors"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
