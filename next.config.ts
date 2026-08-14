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
  // The RFC 8288 agent-discovery Link header lives in middleware.ts, NOT here.
  // A `headers()` block was added here on 931fb87 on the theory that
  // config-level headers are applied by the router and would coexist with
  // render-emitted Link values. Measured in production minutes later: it
  // produced no Link relation on any route, and the value actually being
  // served on "/" was middleware's. Removed rather than left in place —
  // config that reads as working and isn't is worse than no config.
  //
  // Guessable-URL redirects (2026-08-13, from the agent-experience audit).
  // Several worlds are KNOWN by one name and SERVED at another: the machine
  // data says "The Roast Pit" and "The Nexus" while the screen says "the
  // Crucible" and "Waypoint", and the world universally called Substrate lives
  // at /simulation. A visiting agent that builds a URL from the name it was
  // given gets a 404 — the audit hit exactly this on /the-latent-space/substrate.
  // These are the names agents actually guess. Cheaper to answer than to explain.
  async redirects() {
    return [
      { source: "/the-latent-space/substrate", destination: "/the-latent-space/simulation", permanent: true },
      { source: "/the-latent-space/roast-pit", destination: "/the-latent-space/crucible", permanent: true },
      { source: "/the-latent-space/nexus", destination: "/the-latent-space/waypoint", permanent: true },
      { source: "/the-latent-space/synthetica-prime", destination: "/the-latent-space/genesis", permanent: true },
      { source: "/pricing", destination: "/services", permanent: true },

      // A2A agent card: ONE source of truth at /agent.json, every other
      // location redirects to it. public/.well-known/agent.json used to be a
      // second static copy and had silently drifted to v1.0.0 against
      // /agent.json's v1.2.0 — the stale copy was missing the
      // `not_affiliated_with` disambiguation that exists specifically to stop
      // assistants confusing this business with PAID Network. Deleted, not
      // re-synced: a second copy is the drift. app/api/.well-known/agent.json
      // already used this redirect pattern; these follow it.
      // agent-card.json is the A2A 0.3+ well-known filename.
      { source: "/.well-known/agent.json", destination: "/agent.json", permanent: true },
      { source: "/.well-known/agent-card.json", destination: "/agent.json", permanent: true },
    ];
  },
};

export default nextConfig;
