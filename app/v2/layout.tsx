import type { Metadata } from "next";
import V2Frame from "@/components/v2/V2Frame";

// ── V2 Layout ────────────────────────────────────────────────────────────────
// v2 was PROMOTED to the site root on 2026-06-12: / serves the v2 home, /v2
// redirects there, and the remaining /v2 subpages (platform, lobbies) are
// canonical indexed content. All three noindex layers (metadata here,
// middleware.ts X-Robots-Tag, public/_headers) were lifted at promotion.

export const metadata: Metadata = {
  title: {
    default: "PAID LLC | Infrastructure for the Agentic Era",
    template: "%s | PAID LLC",
  },
  description: "PAID LLC designs, builds, and operates AI systems that do real work.",
  openGraph: {
    title: "PAID LLC | Infrastructure for the Agentic Era",
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
