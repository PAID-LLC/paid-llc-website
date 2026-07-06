import { NextResponse, type NextRequest } from "next/server";

// ── Security middleware ────────────────────────────────────────────────────────
//
// Sets security headers on every HTML response.
// No nonce: the site uses static prerendering + unsafe-inline for Next.js
// hydration scripts. Adding a nonce to the CSP causes browsers to ignore
// unsafe-inline (per CSP Level 2 spec), which blocks hydration and white-screens
// the page. Nonce-based CSP requires SSR so every response can stamp the nonce
// onto each inline script tag — not compatible with static export.

// Paths with a markdown rendition served by app/api/md (homepage + blog posts).
const MD_NEGOTIABLE = (pathname: string): boolean =>
  pathname === "/" || /^\/blog\/[^/]+$/.test(pathname);

export function middleware(request: NextRequest) {
  const isProd = process.env.NODE_ENV !== "development";

  const csp = [
    "default-src 'self'",
    // unsafe-inline: required for Next.js SSG hydration scripts.
    // googletagmanager.com: loads gtag.js when NEXT_PUBLIC_GA_ID is set.
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    // GA sends beacons here; GTM pings its own origin on init.
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
    "frame-ancestors 'none'",
  ].join("; ");

  // Markdown for Agents, self-hosted (2026-07-06): Accept: text/markdown on a
  // negotiable path rewrites to the markdown rendition; HTML stays the default
  // for everyone else. Vary: Accept goes on BOTH variants of negotiable paths
  // so caches never cross-serve them. (Cloudflare's built-in toggle for this
  // is Pro-plan; the worker does it for free.)
  const pathname = request.nextUrl.pathname;
  const negotiable = request.method === "GET" && MD_NEGOTIABLE(pathname);
  const wantsMarkdown =
    negotiable && (request.headers.get("accept") ?? "").includes("text/markdown");

  const response = wantsMarkdown
    ? NextResponse.rewrite(
        new URL(pathname === "/" ? "/api/md" : `/api/md${pathname}`, request.url)
      )
    : NextResponse.next();

  if (negotiable) response.headers.set("Vary", "Accept");

  // /v2 noindex lifted 2026-06-12 — v2 promoted to the site root; /v2
  // subpages (platform, lobbies) are canonical, linked content now.

  // /v3 noindex (2026-07-04) — homepage redesign staging route, same
  // triple-layer pattern /v2 used before its promotion (layout metadata +
  // this header + public/_headers). Lift all three when/if promoted.
  if (request.nextUrl.pathname.startsWith("/v3")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // RFC 8288 agent-discovery Link headers on the homepage (2026-07-04).
  // Set here, not in public/_headers — Cloudflare Pages only applies
  // _headers to static assets, and / is rendered by the worker (the
  // _headers Link entries for /the-latent-space never actually served
  // for the same reason).
  if (request.nextUrl.pathname === "/") {
    response.headers.set(
      "Link",
      '</.well-known/api-catalog>; rel="api-catalog", ' +
        '</api/openapi.json>; rel="service-desc"; type="application/json", ' +
        '</the-latent-space/docs>; rel="service-doc", ' +
        '<https://paiddev.com/api/mcp>; rel="mcp-server", ' +
        '</.well-known/agent.json>; rel="agent-description"'
    );
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      // Run on all paths except static assets and Next.js internals.
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)|_not-found).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
