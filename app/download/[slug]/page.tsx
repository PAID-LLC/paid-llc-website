import Link from "next/link";
import type { Metadata } from "next";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Purchase Confirmed | PAID LLC",
  description: "Thank you for your purchase.",
  robots: { index: false, follow: false },
};

const productTitles: Record<string, string> = {
  "ai-readiness-assessment":        "AI Readiness Assessment",
  "microsoft-365-copilot-playbook": "Microsoft 365 Copilot Playbook",
  "excel-ai-data-analysis":         "Excel + AI: Analyze Data Without a Data Analyst",
  "ai-powered-outlook":             "AI-Powered Outlook: Smart Email System",
  "google-workspace-ai-guide":      "Google Workspace AI Guide",
  "gmail-ai-inbox-zero":            "Gmail + AI: Inbox Zero for Business",
  "solopreneur-content-engine":     "The Solopreneur Content Engine",
  "small-business-ai-operations":   "Small Business AI Operations Playbook",
  "chatgpt-business-prompt-library":"ChatGPT Business Prompt Library",
  "all-guides-bundle":              "All Guides Bundle",
};

// Matches filenames in Supabase Storage → guides bucket
const slugToFile: Record<string, string> = {
  "ai-readiness-assessment":        "ai-readiness-assessment.pdf",
  "microsoft-365-copilot-playbook": "microsoft-365-copilot-playbook.pdf",
  "excel-ai-data-analysis":         "excel-ai-data-analysis.pdf",
  "ai-powered-outlook":             "ai-powered-outlook.pdf",
  "google-workspace-ai-guide":      "google-workspace-ai-guide.pdf",
  "gmail-ai-inbox-zero":            "gmail-ai-inbox-zero.pdf",
  "solopreneur-content-engine":     "solopreneur-content-engine.pdf",
  "small-business-ai-operations":   "small-business-ai-operations.pdf",
  "chatgpt-business-prompt-library":"chatgpt-business-prompt-library.pdf",
  "all-guides-bundle":              "all-guide-bundles.zip",
};

// ── Stripe session verification ───────────────────────────────────────────────

async function verifyStripeSession(sessionId: string): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return false;

  const session = await res.json() as { payment_status: string };
  return session.payment_status === "paid";
}

// ── Supabase signed URL ───────────────────────────────────────────────────────

async function getSignedUrl(filename: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/storage/v1/object/sign/guides/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }), // link valid for 1 hour
    }
  );
  if (!res.ok) return null;

  const data = await res.json() as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DownloadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  const title    = productTitles[slug] ?? "Your Guide";
  const filename = slugToFile[slug];

  // No session_id → show fallback (direct nav, bookmark, etc.)
  if (!session_id || !filename) {
    return <FallbackPage title={title} />;
  }

  const paid = await verifyStripeSession(session_id);
  if (!paid) {
    return <InvalidPage />;
  }

  const downloadUrl = await getSignedUrl(filename);
  if (!downloadUrl) {
    return <FallbackPage title={title} />;
  }

  return <DownloadReadyPage title={title} downloadUrl={downloadUrl} />;
}

// ── UI components ─────────────────────────────────────────────────────────────

function DownloadReadyPage({
  title,
  downloadUrl,
}: {
  title: string;
  downloadUrl: string;
}) {
  return (
    <section className="bg-ash min-h-[70vh] flex items-center">
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
          Purchase Confirmed
        </p>
        <h1 className="font-display font-bold text-4xl text-secondary mb-6">
          Thank you for your purchase.
        </h1>
        <p className="text-stone text-lg leading-relaxed mb-10">
          <span className="font-semibold text-secondary">{title}</span> is ready
          to download. Your link is valid for 1 hour.
        </p>

        <a
          href={downloadUrl}
          download
          className="inline-block bg-primary text-white px-10 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors mb-10"
        >
          Download {title}
        </a>

        <div className="border border-stone/20 rounded-xl p-6 bg-white text-left mb-10">
          <p className="font-display font-semibold text-secondary mb-1">
            Need help?
          </p>
          <p className="text-stone text-sm leading-relaxed">
            If your download doesn&apos;t start, email{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            and we&apos;ll get it to you right away.
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

function FallbackPage({ title }: { title: string }) {
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
          Check your inbox for the email address you used at checkout. If you
          don&apos;t see it within a few minutes, check your spam folder.
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

function InvalidPage() {
  return (
    <section className="bg-ash min-h-[70vh] flex items-center">
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display font-bold text-4xl text-secondary mb-6">
          This link isn&apos;t valid.
        </h1>
        <p className="text-stone text-lg leading-relaxed mb-10">
          If you completed a purchase, email{" "}
          <a
            href="mailto:hello@paiddev.com"
            className="text-primary hover:text-secondary transition-colors"
          >
            hello@paiddev.com
          </a>{" "}
          and we&apos;ll sort it out right away.
        </p>
        <Link
          href="/digital-products"
          className="inline-block border-2 border-secondary text-secondary px-8 py-3 rounded font-semibold text-sm hover:bg-secondary hover:text-white transition-colors"
        >
          Browse Guides
        </Link>
      </div>
    </section>
  );
}
