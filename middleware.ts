import { NextRequest, NextResponse } from "next/server";

// ── Security middleware ────────────────────────────────────────────────────────
//
// Sets security headers on every HTML response.
// No nonce: the site uses static prerendering + unsafe-inline for Next.js
// hydration scripts. Adding a nonce to the CSP causes browsers to ignore
// unsafe-inline (per CSP Level 2 spec), which blocks hydration and white-screens
// the page. Nonce-based CSP requires SSR so every response can stamp the nonce
// onto each inline script tag — not compatible with static export.

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

  const response = NextResponse.next();

  // /v2 noindex lifted 2026-06-12 — v2 promoted to the site root; /v2
  // subpages (platform, lobbies) are canonical, linked content now.

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
