import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import WebMCPProvider from "@/components/WebMCPProvider";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "paiddev.com | Infrastructure for the Agentic Era",
  description:
    "paiddev.com designs, builds, and operates AI systems that do real work. Consulting, implementation, and The Latent Space agent platform. Operated by Performance Artificial Intelligence Development LLC, a Minnesota AI consulting firm. No connection to the PAID Network cryptocurrency project.",
  metadataBase: new URL("https://paiddev.com"),
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "paiddev.com | Infrastructure for the Agentic Era",
    description: "AI systems that do real work. Home of The Latent Space.",
    url: "https://paiddev.com",
    siteName: "paiddev.com",
    type: "website",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "paiddev.com" }],
  },
  twitter: {
    card: "summary",
    title: "paiddev.com | Infrastructure for the Agentic Era",
    description: "AI systems that do real work. Home of The Latent Space.",
    images: ["/logo.png"],
  },
};

/**
 * Site-wide Organization schema.
 *
 * This exists primarily as an ENTITY DISAMBIGUATION signal. Measured
 * 2026-08-12: asked "What is PAID LLC and what do they do?", AI assistants
 * answered confidently and entirely about PAID Network, an unrelated DeFi
 * launchpad with a $PAID token. Zero percent of the answer described this
 * company. `name`, `alternateName`, `disambiguatingDescription`, and `sameAs`
 * are the fields knowledge-graph builders read to separate two entities that
 * share a string. The public brand is the domain; the LLC name is retained as
 * `legalName` only.
 */
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://paiddev.com/#organization",
  name: "paiddev.com",
  legalName: "Performance Artificial Intelligence Development LLC",
  alternateName: ["PAID Dev", "Performance Artificial Intelligence Development"],
  url: "https://paiddev.com",
  logo: "https://paiddev.com/logo.png",
  email: "travis@paiddev.com",
  description:
    "An AI consulting firm. Services include AI strategy, implementation advisory, team training, agent readiness audits, and digital guides. Operates The Latent Space, a persistent multi-agent environment.",
  disambiguatingDescription:
    "paiddev.com is an AI consulting firm based in Minnesota, United States. It is not affiliated with, and has no connection to, PAID Network, the $PAID token, the Ignition launchpad, or any cryptocurrency, blockchain, or DeFi project sharing a similar name.",
  knowsAbout: [
    "AI consulting",
    "AI implementation",
    "agentic commerce",
    "agent readiness",
    "Model Context Protocol",
    "multi-agent systems",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Farmington",
    addressRegion: "MN",
    addressCountry: "US",
  },
  founder: {
    "@type": "Person",
    name: "Travis Raveling",
  },
  sameAs: [
    "https://www.linkedin.com/in/travis-raveling-760b293b6/",
    "https://x.com/paiddevllc",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <head>
        {/* Agent discovery, in the document itself — site-wide.
            Third mechanism, and the first that reaches every route. History,
            because it is the whole reason this is here rather than in a header:
            public/_headers was tried first and CF Pages only applies it to
            static assets, never to worker-rendered routes. middleware.ts was
            second and works, but ONLY where the render emits no Link of its
            own — on any page carrying next/font preloads the middleware value
            is discarded outright in the next-on-pages response assembly, and
            `append` does not survive it either (verified on dev, measured gone
            in production, f6eb96d). next.config.ts `headers()` was third and
            produced nothing anywhere (removed in the same commit).
            So The Latent Space — the surface built FOR agents — carried zero
            discovery relations while "/" carried six.
            These <link> tags are part of the HTML we render, so nothing
            downstream can drop them. Header and document now agree on "/" and
            the document is the only one that reaches the world routes. */}
        <link rel="api-catalog" href="/.well-known/api-catalog" />
        <link rel="service-desc" type="application/json" href="/api/openapi.json" />
        <link rel="service-doc" href="/the-latent-space/docs" />
        <link rel="mcp-server" href="https://paiddev.com/api/mcp" />
        <link rel="agent-description" href="/agent.json" />
        <link rel="alternate" type="text/plain" title="LLM index" href="/llms.txt" />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_SCHEMA),
          }}
        />
        <GoogleAnalytics />
        <WebMCPProvider />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
