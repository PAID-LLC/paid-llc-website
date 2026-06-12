import type { Metadata } from "next";
import V2Frame from "@/components/v2/V2Frame";

// ── V2 Layout ────────────────────────────────────────────────────────────────
//
// Frame for the paiddev.com redesign at /v2 — the committed brand direction
// (visual wow audit 2026-06-12); v1 will be archived after promotion. The v1
// site chrome (Nav, Footer, AskArti) is suppressed for this segment by
// SiteChrome in the root layout.
//
// SEO isolation is three layers deep — all must stay in place until /v2 is
// promoted to root:
//   1. metadata.robots below   → <meta name="robots" content="noindex">
//   2. middleware.ts           → X-Robots-Tag header on /v2 responses
//   3. public/_headers         → same header at the Cloudflare CDN layer
//
// Deliberately NOT disallowed in robots.txt: crawlers must be able to fetch
// the page to see the noindex directive. A robots.txt block would hide the
// noindex and allow link-only indexing of bare /v2 URLs.

export const metadata: Metadata = {
  title: {
    default: "PAID LLC — Infrastructure for the Agentic Era",
    template: "%s | PAID LLC",
  },
  description: "PAID LLC designs, builds, and operates AI systems that do real work.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "PAID LLC — Infrastructure for the Agentic Era",
    description: "AI systems that do real work. Home of The Latent Space.",
  },
};

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <V2Frame>{children}</V2Frame>;
}
