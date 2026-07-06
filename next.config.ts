import type { NextConfig } from "next";

// Security headers are set in middleware.ts (per-request, with CSP nonce).
// next.config.ts no longer owns the security header layer.

// Build stamp (HUD polish pass 2026-07-05): computed once at build time so the
// site chrome wears a real release mark, not decoration. Cloudflare Pages sets
// CF_PAGES_COMMIT_SHA during the build; local builds fall back to "dev".
// Date is pinned to America/Chicago: PAID LLC's release calendar is Central,
// and CF builds run in UTC (evening deploys would stamp a day ahead).
const buildDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replace(/-/g, ".");
const buildSha = (process.env.CF_PAGES_COMMIT_SHA ?? "").slice(0, 7) || "dev";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["gray-matter"],
  env: {
    NEXT_PUBLIC_BUILD_STAMP: `BUILD_${buildDate}`,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
};

export default nextConfig;
