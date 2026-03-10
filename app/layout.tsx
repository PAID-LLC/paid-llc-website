import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AskArti from "@/components/AskArti";

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
  title: "PAID LLC | AI Consulting & Implementation",
  description:
    "PAID LLC helps businesses understand, deploy, and maximize AI, turning complexity into performance.",
  metadataBase: new URL("https://paiddev.com"),
  openGraph: {
    title: "PAID LLC | AI Consulting & Implementation",
    description: "AI that works. Results you can see.",
    url: "https://paiddev.com",
    siteName: "PAID LLC",
    type: "website",
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
        <Nav />
        <main>{children}</main>
        <Footer />
        <AskArti />
      </body>
    </html>
  );
}
