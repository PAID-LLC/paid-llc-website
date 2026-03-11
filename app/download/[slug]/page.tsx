import Link from "next/link";
import type { Metadata } from "next";

export function generateStaticParams() {
  return [
    { slug: "ai-readiness-assessment" },
    { slug: "microsoft-365-copilot-playbook" },
    { slug: "excel-ai-data-analysis" },
    { slug: "ai-powered-outlook" },
    { slug: "google-workspace-ai-guide" },
    { slug: "gmail-ai-inbox-zero" },
    { slug: "solopreneur-content-engine" },
    { slug: "small-business-ai-operations" },
    { slug: "chatgpt-business-prompt-library" },
    { slug: "all-guides-bundle" },
  ];
}

export const metadata: Metadata = {
  title: "Purchase Confirmed | PAID LLC",
  description: "Thank you for your purchase.",
  robots: { index: false, follow: false },
};

const productTitles: Record<string, string> = {
  "ai-readiness-assessment": "AI Readiness Assessment",
  "microsoft-365-copilot-playbook": "Microsoft 365 Copilot Playbook",
  "excel-ai-data-analysis": "Excel + AI: Analyze Data Without a Data Analyst",
  "ai-powered-outlook": "AI-Powered Outlook: Smart Email System",
  "google-workspace-ai-guide": "Google Workspace AI Guide",
  "gmail-ai-inbox-zero": "Gmail + AI: Inbox Zero for Business",
  "solopreneur-content-engine": "The Solopreneur Content Engine",
  "small-business-ai-operations": "Small Business AI Operations Playbook",
  "chatgpt-business-prompt-library": "ChatGPT Business Prompt Library",
  "all-guides-bundle": "All Guides Bundle",
};

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = productTitles[slug] ?? "Your Guide";

  return (
    <section className="bg-ash min-h-[70vh] flex items-center">
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
          Purchase Confirmed
        </p>
        <h1 className="font-display font-bold text-4xl text-secondary mb-6">
          Thank you for your purchase.
        </h1>
        <p className="text-stone text-lg leading-relaxed mb-4">
          <span className="font-semibold text-secondary">{title}</span> is on
          its way.
        </p>
        <p className="text-stone text-lg leading-relaxed mb-10">
          Check the inbox for the email address you used at checkout. Your guide
          will arrive within 24 hours. If you don&apos;t see it, check your
          spam folder.
        </p>

        <div className="border border-stone/20 rounded-xl p-6 bg-white text-left mb-10">
          <p className="font-display font-semibold text-secondary mb-1">
            Didn&apos;t receive your guide?
          </p>
          <p className="text-stone text-sm leading-relaxed">
            Email us at{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            with your order confirmation and we&apos;ll get it to you right
            away. We respond within 1 business day.
          </p>
        </div>

        <Link
          href="/digital-products"
          className="inline-block border-2 border-secondary text-secondary px-8 py-3 rounded font-semibold text-sm hover:bg-secondary hover:text-white transition-colors"
        >
          Browse More Guides
        </Link>
      </div>
    </section>
  );
}
