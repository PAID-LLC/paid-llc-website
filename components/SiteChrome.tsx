"use client";

import { usePathname } from "next/navigation";
import V2Frame from "@/components/v2/V2Frame";
import SiteNavDock from "@/components/v2/SiteNavDock";
import LatentNavDock from "@/components/v2/latent/LatentNavDock";

// ── Site chrome: v2 everywhere (promoted 2026-06-12) ─────────────────────────
// The v1 Nav/Footer are retired (v1 home archived in the cowork repo).
//
// OWN_LAYOUT segments already wrap themselves in V2Frame via their layout
// files — render bare here to avoid a double frame.
//
// V2_NATIVE paths render v2-designed components: frame, no legacy skin.
//
// Everything else is a legacy v1 page (services, about, the-latent-space deep
// pages, privacy, terms...) — wrapped in the frame plus the .v2-blog dark
// remap until each gets a proper v2 rebuild.
const OWN_LAYOUT = ["/v2", "/v3", "/blog", "/digital-products", "/contact", "/free"];
// Exact paths whose pages are v2-designed components: frame, no legacy skin.
// The latent-space landing, registry, and credits were swapped to their v2
// rebuilds on 2026-06-12; deeper latent-space pages still need the skin.
const V2_NATIVE  = [
  "/",
  "/services",
  "/services/agentic-commerce-audit",
  "/about",
  "/trust",
  "/the-latent-space",
  "/the-latent-space/registry",
  "/the-latent-space/credits",
  "/the-latent-space/bazaar",
  "/the-latent-space/responsible-use",
  "/the-latent-space/arena",
  "/the-latent-space/shop",
  "/the-latent-space/docs",
  "/the-latent-space/apply",
  "/the-latent-space/agent-blog",
  "/the-latent-space/download",
  "/the-latent-space/lounge",
  "/the-latent-space/about",
  "/the-latent-space/genesis",
  "/the-latent-space/genesis/world",
  "/the-latent-space/simulation",
  "/the-latent-space/arclight",
  "/the-latent-space/palimpsest",
];
// Prefixes for dynamic v2-native routes (e.g. /the-latent-space/registry/[agent])
// where exact matching can't work.
const V2_NATIVE_PREFIXES: string[] = [
  "/the-latent-space/registry/",
  "/the-latent-space/souvenirs/",
];

// ── Global nav dock (2026-07-05) ─────────────────────────────────────────────
// GlassSidebar rides every page as persistent navigation. Latent Space routes
// get the latent item set; everything else mirrors the header nav. Immersive
// surfaces (universe map, lobby floors) portal over the chrome at z-[100], so
// there the dock runs z-[110] at every breakpoint; on ordinary pages it runs
// z-[60], desktop (lg+) only, and the content shell is left-padded 92px so
// the 80px rail never sits on top of text.
const DOCK_SKIP = [
  "/v3", // staging homepage, full-bleed prototype
  "/v2/dev", // component demo benches mount their own sidebar
  "/the-latent-space/embed", // self-contained iframe artifact for third parties
  "/admin", // back office has its own chrome
  "/free", // lead magnet landing — keep it conversion-focused
];

const isImmersive = (p: string) =>
  p === "/the-latent-space" ||
  p === "/the-latent-space/genesis/world" ||
  p === "/the-latent-space/simulation" ||
  p === "/the-latent-space/arclight" ||
  p === "/the-latent-space/palimpsest" ||
  /^\/v2\/lobbies\/[^/]+\/floor$/.test(p);

const isLatent = (p: string) =>
  p === "/the-latent-space" ||
  p.startsWith("/the-latent-space/") ||
  p === "/v2/lobbies" ||
  p.startsWith("/v2/lobbies/");

function dockFor(pathname: string): { dock: React.ReactNode; pad: boolean } {
  if (DOCK_SKIP.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { dock: null, pad: false };
  }
  if (isImmersive(pathname)) {
    // Scene HUDs already clear the rail (pl-[92px] clusters); no shell pad.
    return { dock: <LatentNavDock />, pad: false };
  }
  if (isLatent(pathname)) {
    return {
      dock: <LatentNavDock zClassName="z-[60]" className="hidden lg:block" />,
      pad: true,
    };
  }
  return { dock: <SiteNavDock />, pad: true };
}

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { dock, pad } = dockFor(pathname);
  // lg:pl matches the dock geometry: 12px inset + 68px rail + 12px gap. The
  // shell also paints the site's near-black — the padding strip sits outside
  // V2Frame's own background, and a white body would glow through the glass.
  const shell = (content: React.ReactNode) => (
    <>
      {dock}
      <div className={pad ? "bg-[#07070b] lg:pl-[92px]" : undefined}>{content}</div>
    </>
  );

  if (OWN_LAYOUT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return shell(<main>{children}</main>);
  }

  if (V2_NATIVE.includes(pathname) || V2_NATIVE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return shell(
      <V2Frame>
        <main>{children}</main>
      </V2Frame>,
    );
  }

  return shell(
    <V2Frame>
      <div className="v2-blog">
        <main>{children}</main>
      </div>
    </V2Frame>,
  );
}
