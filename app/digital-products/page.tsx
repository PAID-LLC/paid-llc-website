import Link from "next/link";
import type { Metadata } from "next";

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
  },
  {
    category: "Microsoft",
    title: "Microsoft 365 Copilot Playbook",
    description:
      "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one.",
    price: "$19.99",
    slug: "microsoft-365-copilot-playbook",
  },
  {
    category: "Microsoft",
    title: "Excel + AI: Analyze Data Without a Data Analyst",
    description:
      "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data — no advanced formulas or data background required.",
    price: "$14.99",
    slug: "excel-ai-data-analysis",
  },
  {
    category: "Microsoft",
    title: "AI-Powered Outlook: Smart Email System",
    description:
      "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook.",
    price: "$9.99",
    slug: "ai-powered-outlook",
  },
  {
    category: "Google",
    title: "Google Workspace AI Guide",
    description:
      "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts.",
    price: "$19.99",
    slug: "google-workspace-ai-guide",
  },
  {
    category: "Google",
    title: "Gmail + AI: Inbox Zero for Business",
    description:
      "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries.",
    price: "$9.99",
    slug: "gmail-ai-inbox-zero",
  },
  {
    category: "Business",
    title: "The Solopreneur Content Engine",
    description:
      "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints.",
    price: "$19.99",
    slug: "solopreneur-content-engine",
  },
  {
    category: "Business",
    title: "Small Business AI Operations Playbook",
    description:
      "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting.",
    price: "$24.99",
    slug: "small-business-ai-operations",
  },
  {
    category: "Business",
    title: "ChatGPT Business Prompt Library",
    description:
      "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service — organized by function and ready to use.",
    price: "$12.99",
    slug: "chatgpt-business-prompt-library",
  },
];

const categoryColors: Record<string, string> = {
  Microsoft: "text-primary",
  Google: "text-primary",
  Business: "text-primary",
};

export default function DigitalProducts() {
  return (
    <>
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
            and business operations — no consultant required.
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
                className="border border-ash rounded-xl overflow-hidden flex flex-col hover:border-stone/40 transition-colors"
              >
                {/* Cover */}
                <div className="bg-secondary aspect-[3/2] flex items-center justify-center px-8">
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
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-secondary text-lg">
                      {product.price}
                    </span>
                    <Link
                      href={`/contact?guide=${product.slug}`}
                      className="bg-primary text-white px-4 py-2 rounded text-sm font-semibold hover:bg-secondary transition-colors"
                    >
                      Get This Guide
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment note */}
          <p className="text-center text-stone text-sm mt-12">
            Not satisfied? We offer a 7-day refund — no hassle, no fine print.{" "}
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
            Get all 9 guides for one flat price. The complete AI toolkit for
            small businesses running Microsoft 365 or Google Workspace.
          </p>
          <Link
            href="/contact?guide=all-guides-bundle"
            className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
          >
            Get the Full Bundle — $69.99
          </Link>
        </div>
      </section>

      {/* Consulting CTA */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Need more than a guide?
            </h2>
            <p className="text-stone text-lg leading-relaxed mb-8">
              Our consulting and implementation services take you from strategy
              to shipping — with a dedicated partner the whole way.
            </p>
            <Link
              href="/services"
              className="inline-block border-2 border-white text-white px-8 py-4 rounded font-semibold text-sm hover:bg-white hover:text-secondary transition-colors"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
