import type { Metadata } from "next";
import V2Frame from "@/components/v2/V2Frame";

// ── V3 Layout (staging) ──────────────────────────────────────────────────────
// Homepage redesign preview route — same triple-layer noindex /v2 used
// before its 2026-06-12 promotion (this metadata + middleware.ts
// X-Robots-Tag + public/_headers). Lift all three if/when Travis approves
// this and it gets promoted to the site root.

export const metadata: Metadata = {
  title: "paiddev.com | Homepage Preview (v3)",
  description: "Staging preview of the redesigned paiddev.com homepage. Not for indexing.",
  robots: { index: false, follow: false },
};

export default function V3Layout({ children }: { children: React.ReactNode }) {
  return <V2Frame>{children}</V2Frame>;
}
