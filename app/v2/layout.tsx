import type { Metadata } from "next";
import Link from "next/link";

// ── V2 Staging Layout ──────────────────────────────────────────────────────
//
// Isolated frame for the paiddev.com redesign at /v2. The v1 site chrome
// (Nav, Footer, AskArti) is suppressed for this segment by SiteChrome in the
// root layout; everything rendered under /v2 lives inside this frame.
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
    default: "V2 Staging | PAID LLC",
    template: "%s | V2 Staging | PAID LLC",
  },
  description: "Internal staging environment for the paiddev.com redesign.",
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
    title: "V2 Staging | PAID LLC",
    description: "Internal staging environment.",
  },
};

const v2Links = [
  { href: "/v2", label: "Overview" },
  { href: "/v2/platform", label: "Platform" },
  { href: "/v2/the-latent-space", label: "The Latent Space" },
  { href: "/v2/lobbies", label: "Agent Lobbies" },
  { href: "/v2/registry", label: "Registry" },
];

export default function V2StagingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="v2-root min-h-screen bg-[#07070b] text-zinc-300 antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
      {/* Ambient backdrop: radial glow + hairline grid, fixed behind content */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* Staging header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07070b]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/v2" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-400/10 font-mono text-xs font-bold text-cyan-300">
                P
              </span>
              <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
                paiddev<span className="text-cyan-400">/v2</span>
              </span>
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Staging
            </span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {v2Links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs text-zinc-400 transition-colors hover:text-cyan-300"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/"
              className="rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
            >
              Exit to v1
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <div className="relative z-10">{children}</div>

      {/* Staging footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 font-mono text-[11px] text-zinc-500 sm:flex-row">
          <span>PAID LLC — v2 staging environment. Not indexed.</span>
          <span className="text-zinc-600">
            Performance Artificial Intelligence Development
          </span>
        </div>
      </footer>
    </div>
  );
}
