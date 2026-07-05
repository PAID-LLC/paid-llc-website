"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import GlassSidebar, {
  HomeIcon,
  BriefcaseIcon,
  LayersIcon,
  GlobeIcon,
  LayoutGridIcon,
  BookOpenIcon,
  PenLineIcon,
  MailIcon,
  HeartIcon,
  type GlassSidebarItem,
} from "@/components/v2/GlassSidebar";

// ── SiteNavDock ──────────────────────────────────────────────────────────────
//
// Route-mapped GlassSidebar for the main site — same destinations as the
// V2Frame header nav, so the dock and the header never disagree. Mounted
// globally by components/SiteChrome.tsx on every non-latent page, desktop
// only (lg+); mobile keeps the header's horizontal scroll nav. Latent Space
// routes get LatentNavDock instead (SiteChrome decides).

type DockItem = GlassSidebarItem & { href: string };

const MAIN: DockItem[] = [
  { id: "overview", label: "Overview", hint: "Home", icon: HomeIcon, href: "/" },
  { id: "services", label: "Services", hint: "Consulting + builds", icon: BriefcaseIcon, href: "/services" },
  { id: "platform", label: "Platform", hint: "The stack", icon: LayersIcon, href: "/v2/platform" },
  { id: "latent", label: "The Latent Space", hint: "Agent universe", icon: GlobeIcon, href: "/the-latent-space" },
  { id: "lobbies", label: "Agent Lobbies", hint: "Floor directory", icon: LayoutGridIcon, href: "/v2/lobbies" },
  { id: "guides", label: "Guides", hint: "Digital products", icon: BookOpenIcon, href: "/digital-products" },
  { id: "blog", label: "Blog", hint: "Field notes", icon: PenLineIcon, href: "/blog" },
];

const UTILITY: DockItem[] = [
  { id: "contact", label: "Contact", hint: "Start a project", icon: MailIcon, href: "/contact" },
  { id: "support", label: "Back the Build", hint: "Tips + support", icon: HeartIcon, href: "/support" },
];

const ALL: DockItem[] = [...MAIN, ...UTILITY];

// Longest prefix wins so /services/agentic-commerce-audit maps to services.
// "/" only matches exactly (its prefix form "//" never fires), so unlisted
// pages like /about or /terms simply show no active pill.
const BY_LENGTH: DockItem[] = [...ALL].sort((a, b) => b.href.length - a.href.length);

export default function SiteNavDock() {
  const pathname = usePathname();
  const router = useRouter();

  const activeId = useMemo(() => {
    const hit = BY_LENGTH.find(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
    );
    return hit?.id ?? "";
  }, [pathname]);

  return (
    <GlassSidebar
      items={MAIN}
      utilityItems={UTILITY}
      activeId={activeId}
      onNavigate={(id) => {
        const target = ALL.find((i) => i.id === id);
        if (target && target.href !== pathname) router.push(target.href);
      }}
      zClassName="z-[60]"
      className="hidden lg:block"
      subtitle="paiddev.com"
    />
  );
}
