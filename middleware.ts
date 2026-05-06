import { NextRequest, NextResponse } from "next/server";

// ── Security middleware ────────────────────────────────────────────────────────
//
// Sets security headers on every HTML response, including a per-request CSP
// nonce. The nonce is forwarded as x-nonce so layout.tsx can pass it to
// next/script components — enabling CSP-compliant inline scripts for SSR pages.
//
// Note on SSG + unsafe-inline: Static pre-built pages have Next.js hydration
// scripts with no nonce attribute. Removing 'unsafe-inline' would break them.
// 'unsafe-inline' is retained until SSR is adopted; browsers that see a valid
// 'nonce-*' directive will prefer the nonce for any scripts that carry it.
// F-04 tightening (remove unsafe-inline) is deferred until SSR migration.

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV !== "development";

  const csp = [
    "default-src 'self'",
    // unsafe-inline: required for Next.js SSG hydration scripts (no nonce attr).
    // googletagmanager.com: loads gtag.js when NEXT_PUBLIC_GA_ID is set.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    // GA sends beacons here; GTM pings its own origin on init.
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
    "frame-ancestors 'none'",
  ].join("; ");

  // Pass nonce to server components via request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
