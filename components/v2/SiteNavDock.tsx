"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import GlassSidebar, {
  HomeIcon,
  BriefcaseIcon,
  GlobeIcon,
  BookOpenIcon,
  UsersIcon,
  MailIcon,
  type GlassSidebarItem,
} from "@/components/v2/GlassSidebar";
import { NAV_GROUPS, NAV_CTA, activeGroup, activeLink, type NavGroup } from "@/lib/nav";

// ── SiteNavDock ──────────────────────────────────────────────────────────────
//
// Route-mapped GlassSidebar for the main site, rendered from lib/nav.ts — the
// same model as the header menus, so the two never disagree. Collapsed it is
// five icons (home + the four groups); expanded, each group opens to its
// pages, and the current page's group opens by itself. Mounted globally by
// components/SiteChrome.tsx on every non-latent page, desktop only (lg+);
// mobile uses the header's menu button. Latent Space routes get
// LatentNavDock instead (SiteChrome decides).

const GROUP_ICON: Record<NavGroup["id"], GlassSidebarItem["icon"]> = {
  services: BriefcaseIcon,
  latent: GlobeIcon,
  resources: BookOpenIcon,
  company: UsersIcon,
};

const MAIN: GlassSidebarItem[] = [
  { id: "home", label: "Overview", hint: "Home", icon: HomeIcon, href: "/" },
  ...NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    hint: g.hint,
    icon: GROUP_ICON[g.id],
    href: g.href,
    children: g.links.map((l) => ({ id: l.href, label: l.label, hint: l.hint, icon: GROUP_ICON[g.id], href: l.href })),
  })),
];

const UTILITY: GlassSidebarItem[] = [
  { id: "cta", label: NAV_CTA.label, hint: NAV_CTA.hint, icon: MailIcon, href: NAV_CTA.href },
];

export default function SiteNavDock() {
  const pathname = usePathname();
  const router = useRouter();

  const activeId = useMemo(
    () => (pathname === "/" ? "home" : activeGroup(pathname)?.id ?? ""),
    [pathname],
  );
  const activeChildHref = useMemo(() => activeLink(pathname)?.href, [pathname]);

  return (
    <GlassSidebar
      items={MAIN}
      utilityItems={UTILITY}
      activeId={activeId}
      activeChildHref={activeChildHref}
      onNavigate={(id) => {
        const target = [...MAIN, ...UTILITY].find((i) => i.id === id);
        if (target?.href && target.href !== pathname) router.push(target.href);
      }}
      zClassName="z-[60]"
      className="hidden lg:block"
      subtitle="paiddev.com"
    />
  );
}
