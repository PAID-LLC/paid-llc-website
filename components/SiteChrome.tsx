"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AskArti from "@/components/AskArti";

// Route prefixes that render without the v1 site chrome (nav, footer, chatbot).
// /v2 is the staging redesign — it ships its own frame in app/v2/layout.tsx.
const BARE_PREFIXES = ["/v2"];

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (bare) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
      <AskArti />
    </>
  );
}
