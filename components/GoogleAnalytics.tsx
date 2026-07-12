import Script from "next/script";

export default function GoogleAnalytics({ nonce }: { nonce?: string }) {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      {/* lazyOnload, not afterInteractive: afterInteractive makes Next emit a
          rel="preload" Link RESPONSE header for gtag.js during SSR, and in the
          next-on-pages assembly that render-time Link replaces the RFC 8288
          agent-discovery Link set by middleware/config (CF Agent Readiness
          regression). lazyOnload injects client-side on idle — no SSR preload
          header, GA still records the pageview. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="lazyOnload"
        nonce={nonce}
      />
      <Script id="ga-init" strategy="lazyOnload" nonce={nonce}>{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${id}');
      `}</Script>
    </>
  );
}
