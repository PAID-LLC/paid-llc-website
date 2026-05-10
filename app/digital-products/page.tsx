export const runtime = "edge";

import Link from "next/link";
import type { Metadata } from "next";
import ProductsGrid, { type ProductItem } from "@/components/ProductsGrid";

export const metadata: Metadata = {
  title: "Digital Products | PAID LLC",
  description:
    "16 practical AI guides covering free-tier setup, Microsoft 365, Google Workspace, automation, and enterprise deployment. Instant PDF download.",
};

const products: ProductItem[] = [
  // Getting Started
  {
    category: "Getting Started",
    title: "AI Readiness Assessment",
    description:
      "Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan.",
    price: "$14.99",
    slug: "ai-readiness-assessment",
    stripeUrl: "https://buy.stripe.com/00wfZidb1cNc4zQ26Qcs80s",
    isNew: false,
  },
  {
    category: "Getting Started",
    title: "The Free AI Stack: An End-to-End AI Setup for Small Business",
    description:
      "Build a complete five-tool AI stack -- writing, visuals, automation, inbox, and organization -- for $0 using Claude, Gemini, Canva, Zapier, and Notion free tiers.",
    price: "$14.99",
    slug: "free-ai-stack-small-business-setup",
    stripeUrl: "https://buy.stripe.com/00w6oIdb14gG1nEh1Kcs80F",
    isNew: true,
  },
  {
    category: "Getting Started",
    title: "Jumpstart Your Business with AI for Under $100 a Month",
    description:
      "Concentrate your AI budget into two or three tools that cover 90% of small business needs. Claude Pro, Zapier Starter, and one specialized tool -- wired together and producing ROI in week one.",
    price: "$14.99",
    slug: "jumpstart-business-ai-under-100",
    stripeUrl: "https://buy.stripe.com/9B64gAb2TaF46HY12Mcs80G",
    isNew: true,
  },
  // Microsoft 365
  {
    category: "Microsoft 365",
    title: "Microsoft 365 Copilot Playbook",
    description:
      "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one.",
    price: "$19.99",
    slug: "microsoft-365-copilot-playbook",
    stripeUrl: "https://buy.stripe.com/6oU4gAef53cC3vM9zics80t",
    isNew: false,
  },
  {
    category: "Microsoft 365",
    title: "Excel + AI: Analyze Data Without a Data Analyst",
    description:
      "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data -- no advanced formulas or data background required.",
    price: "$14.99",
    slug: "excel-ai-data-analysis",
    stripeUrl: "https://buy.stripe.com/9B628s3Ar28yd6m7racs80u",
    isNew: false,
  },
  {
    category: "Microsoft 365",
    title: "AI-Powered Outlook: Smart Email System",
    description:
      "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook.",
    price: "$9.99",
    slug: "ai-powered-outlook",
    stripeUrl: "https://buy.stripe.com/eVq6oI0ofcNc2rI7racs80v",
    isNew: false,
  },
  {
    category: "Microsoft 365",
    title: "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide",
    description:
      "Team-level Copilot deployment: meeting recaps, collaborative documents, Copilot Pages, and shared prompt libraries that make AI output consistent across your whole team.",
    price: "$19.99",
    slug: "copilot-cowork-microsoft-365-team-guide",
    stripeUrl: "https://buy.stripe.com/fZucN6b2T7sS2rIbHqcs80E",
    isNew: true,
  },
  // Google Workspace
  {
    category: "Google Workspace",
    title: "Google Workspace AI Guide",
    description:
      "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts.",
    price: "$19.99",
    slug: "google-workspace-ai-guide",
    stripeUrl: "https://buy.stripe.com/7sYeVeb2T9B00jAdPycs80w",
    isNew: false,
  },
  {
    category: "Google Workspace",
    title: "Gmail + AI: Inbox Zero for Business",
    description:
      "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries.",
    price: "$9.99",
    slug: "gmail-ai-inbox-zero",
    stripeUrl: "https://buy.stripe.com/7sYaEY9YP4gG8Q6cLucs80x",
    isNew: false,
  },
  // Content & Marketing
  {
    category: "Content & Marketing",
    title: "The Solopreneur Content Engine",
    description:
      "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints.",
    price: "$19.99",
    slug: "solopreneur-content-engine",
    stripeUrl: "https://buy.stripe.com/7sY4gA5Iz00q3vMcLucs80y",
    isNew: false,
  },
  {
    category: "Content & Marketing",
    title: "ChatGPT Business Prompt Library",
    description:
      "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service -- organized by function and ready to use.",
    price: "$12.99",
    slug: "chatgpt-business-prompt-library",
    stripeUrl: "https://buy.stripe.com/6oU8wQdb1bJ87M25j2cs80A",
    isNew: false,
  },
  // Operations
  {
    category: "Operations",
    title: "Small Business AI Operations Playbook",
    description:
      "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting.",
    price: "$24.99",
    slug: "small-business-ai-operations",
    stripeUrl: "https://buy.stripe.com/dRmbJ27QHcNceaq9zics80z",
    isNew: false,
  },
  {
    category: "Operations",
    title: "Claude for Business: The Practical Playbook",
    description:
      "Real workflows for using Claude in business: document analysis, proposal writing, client communications, and a persistent AI assistant that knows your business.",
    price: "$19.99",
    slug: "claude-for-business-practical-playbook",
    stripeUrl: "https://buy.stripe.com/7sY8wQ4EvbJ85DU7racs80B",
    isNew: true,
  },
  {
    category: "Operations",
    title: "AI Agents for Small Business",
    description:
      "Plain-English guide to deploying your first AI agent -- lead follow-up, proposal generation, triage, and automation -- in 30 days with no code required.",
    price: "$19.99",
    slug: "ai-agents-for-small-business",
    stripeUrl: "https://buy.stripe.com/7sY28sef56oO4zQ4eYcs80C",
    isNew: true,
  },
  {
    category: "Operations",
    title: "Build It Without Code: A Non-Developer's Guide to Cursor",
    description:
      "Use Cursor and AI to build landing pages, internal tools, intake forms, and data dashboards -- without hiring a developer or learning to code.",
    price: "$19.99",
    slug: "cursor-ai-coding-guide",
    stripeUrl: "https://buy.stripe.com/00wfZi4EveVkfeu5j2cs80D",
    isNew: true,
  },
  // Enterprise
  {
    category: "Enterprise",
    title: "Enterprise AI Deployment: The Complete Implementation Guide",
    description:
      "An 8-phase enterprise AI deployment framework covering use case selection, vendor evaluation, security and compliance, pilot design, change management, phased rollout, and ROI measurement.",
    price: "$29.99",
    slug: "enterprise-ai-deployment-guide",
    stripeUrl: "https://buy.stripe.com/dRmdRa2wn8wW6HY3aUcs80H",
    isNew: true,
  },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "PAID LLC AI Guides",
  description:
    "16 practical AI guides covering free-tier setup, Microsoft 365, Google Workspace, automation, and enterprise deployment.",
  url: "https://paiddev.com/digital-products",
  itemListElement: products.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Product",
      "@id": `https://paiddev.com/digital-products#${p.slug}`,
      name: p.title,
      description: `PDF guide, instant download. ${p.description}`,
      url: `https://paiddev.com/digital-products#${p.slug}`,
      brand: { "@type": "Brand", name: "PAID LLC" },
      category: p.category,
      encodingFormat: "application/pdf",
      offers: {
        "@type": "Offer",
        price: p.price.replace("$", ""),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: p.stripeUrl,
        seller: {
          "@type": "Organization",
          name: "PAID LLC",
          url: "https://paiddev.com",
        },
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
            16 practical guides -- from free-tier setup to enterprise deployment.
            No consultant required.
          </p>
        </div>
      </section>

      {/* Filtered Product Grid */}
      <section className="bg-white">
        <ProductsGrid products={products} />
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
            href="https://buy.stripe.com/00w4gA8UL28y6HY5j2cs80I"
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
              All 16 guides. 12 months of new releases. One guide built for you.
            </h2>
            <p className="text-stone text-lg leading-relaxed mb-4">
              Founding Members get the complete current library plus every guide
              PAID LLC publishes over the next 12 months -- automatically
              delivered as each one releases.
            </p>
            <p className="text-stone text-lg leading-relaxed mb-4">
              Plus: one custom guide on any AI topic you choose. Tell us what
              you need and we build it. Email{" "}
              <a href="mailto:hello@paiddev.com" className="text-primary hover:text-white transition-colors">
                hello@paiddev.com
              </a>{" "}
              after purchase to request yours.
            </p>
            <p className="text-stone/60 text-sm leading-relaxed mb-8">
              One flat price. No renewals. No subscriptions. Custom guide offer
              available while capacity allows.
            </p>
            <a
              href="https://buy.stripe.com/7sYeVe4Ev28ygiy9zics80J"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
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
