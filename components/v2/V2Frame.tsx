import Link from "next/link";
import CursorGlow from "@/components/v2/CursorGlow";
import AskArti from "@/components/AskArti";

// ── V2 frame ─────────────────────────────────────────────────────────────────
// The v2 site chrome (backdrop, header, footer, Ask Arti) extracted from
// app/v2/layout.tsx so other segments can adopt the v2 look before promotion.
// First adopter: /blog (app/blog/layout.tsx + the .v2-blog dark skin in
// globals.css). SiteChrome must list any adopting segment in BARE_PREFIXES so
// the v1 chrome stays out.

// Promoted nav (2026-06-12): v2 is the site. Root home, legacy pages skinned.
const v2Links = [
  { href: "/", label: "Overview" },
  { href: "/services", label: "Services" },
  { href: "/v2/platform", label: "Platform" },
  { href: "/the-latent-space", label: "The Latent Space" },
  { href: "/v2/lobbies", label: "Agent Lobbies" },
  { href: "/digital-products", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

// Build stamp: inlined at build time by next.config.ts (env key), derived
// from CF_PAGES_COMMIT_SHA — a real release id, matching the site's
// software-release framing.
const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_STAMP ?? "BUILD_DEV";
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

export default function V2Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2-root min-h-screen bg-[#07070b] text-zinc-300 antialiased selection:bg-cyan-400/20 selection:text-cyan-100">
      {/* Ambient backdrop: radial glow + hairline grid, fixed behind content.
          CursorGlow lights the grid around the pointer (wow audit Tier 1.3). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
        {/* Film grain: tactile depth over the gradient (Fable 5 design pass) */}
        <div className="v2-grain absolute inset-0" />
        <CursorGlow />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07070b]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              {/* Brand lettermark: PAID terracotta (#C14826), not the system cyan */}
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#C14826]/60 bg-[#C14826]/15 font-mono text-xs font-bold text-[#E8714C]">
                P
              </span>
              <span className="v2-weight-shift font-mono text-sm font-semibold tracking-tight text-zinc-100">
                paiddev
              </span>
            </Link>
            {/* xl only: below that the 8-link nav needs the width */}
            <span
              className="hidden shrink-0 font-mono text-[10px] tracking-[0.15em] text-zinc-600 xl:inline"
              title={`commit ${BUILD_SHA}`}
            >
              {BUILD_STAMP}
            </span>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {v2Links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-sm font-medium text-zinc-200 transition-colors hover:text-cyan-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile nav: horizontal scroll row so every page stays reachable */}
        <nav className="flex items-center gap-5 overflow-x-auto px-6 pb-3 md:hidden">
          {v2Links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 font-mono text-sm font-medium text-zinc-200 transition-colors hover:text-cyan-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <div className="relative z-10">{children}</div>

      {/* Ask Arti chat — same widget as v1 (Travis: must exist on v2 too) */}
      <AskArti />

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 font-mono text-[11px] text-zinc-500 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span>PAID LLC — Performance Artificial Intelligence Development</span>
            <span className="text-zinc-600">
              {`PAID_DEV // ${BUILD_STAMP} // ${BUILD_SHA}`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/support"
              className="text-zinc-400 transition-colors hover:text-[#E8714C]"
            >
              Back the Build
            </Link>
            <a
              href="https://www.linkedin.com/in/travis-raveling-760b293b6/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-zinc-400 transition-colors hover:text-cyan-300"
            >
              LinkedIn
            </a>
            <a
              href="https://x.com/paiddevllc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X / Twitter"
              className="text-zinc-400 transition-colors hover:text-cyan-300"
            >
              X
            </a>
          </div>
          <span className="text-zinc-600">
            Built by a <span className="text-[#E8714C]">founder</span> and his{" "}
            <span className="text-cyan-400">agents</span>.
          </span>
        </div>
      </footer>
    </div>
  );
}
