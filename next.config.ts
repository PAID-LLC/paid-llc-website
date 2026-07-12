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
  // RFC 8288 agent-discovery Link header on the homepage, at the ROUTING layer.
  // middleware.ts sets the same header, but the render pipeline's own Link
  // (the GA gtag preload that arrived with NEXT_PUBLIC_GA_ID) replaces
  // middleware-set values in the next-on-pages response assembly — the CF
  // Agent Readiness scan regressed to "no agent-useful relation types" once
  // GA shipped. Config-level headers are applied by the router and coexist
  // with render-emitted Link headers (RFC 8288 parsers merge repeats).
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Link",
            value:
              '</.well-known/api-catalog>; rel="api-catalog", ' +
              '</api/openapi.json>; rel="service-desc"; type="application/json", ' +
              '</the-latent-space/docs>; rel="service-doc", ' +
              '<https://paiddev.com/api/mcp>; rel="mcp-server", ' +
              '</.well-known/agent.json>; rel="agent-description"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
