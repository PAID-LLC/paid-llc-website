"use client";

import { usePathname } from "next/navigation";
import V2Frame from "@/components/v2/V2Frame";

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
const OWN_LAYOUT = ["/v2", "/blog", "/digital-products", "/contact", "/free"];
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
];

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (OWN_LAYOUT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <main>{children}</main>;
  }

  if (V2_NATIVE.includes(pathname)) {
    return (
      <V2Frame>
        <main>{children}</main>
      </V2Frame>
    );
  }

  return (
    <V2Frame>
      <div className="v2-blog">
        <main>{children}</main>
      </div>
    </V2Frame>
  );
}
