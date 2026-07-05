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
  title: "PAID LLC | Infrastructure for the Agentic Era",
  description:
    "PAID LLC designs, builds, and operates AI systems that do real work. Consulting, implementation, and The Latent Space agent platform.",
  metadataBase: new URL("https://paiddev.com"),
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "PAID LLC | Infrastructure for the Agentic Era",
    description: "AI systems that do real work. Home of The Latent Space.",
    url: "https://paiddev.com",
    siteName: "PAID LLC",
    type: "website",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "PAID LLC" }],
  },
  twitter: {
    card: "summary",
    title: "PAID LLC | Infrastructure for the Agentic Era",
    description: "AI systems that do real work. Home of The Latent Space.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="antialiased">
        <GoogleAnalytics />
        <WebMCPProvider />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
