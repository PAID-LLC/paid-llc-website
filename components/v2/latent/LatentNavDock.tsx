"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import GlassSidebar, {
  GlobeIcon,
  LayoutGridIcon,
  BotIcon,
  ActivityIcon,
  StoreIcon,
  NetworkIcon,
  SlidersIcon,
  type GlassSidebarItem,
} from "@/components/v2/GlassSidebar";

// ── LatentNavDock ────────────────────────────────────────────────────────────
//
// Route-mapped GlassSidebar for the Latent Space ecosystem. On the immersive
// surfaces (universe map, lobby floors) the scenes portal over the site chrome
// at z-[100], burying the header nav — there the dock is the only way around,
// so it rides at z-[110] and shows at every breakpoint. On latent content
// pages (registry, arena, docs...) the header still exists, so SiteChrome
// mounts this at z-[60], desktop only. Active state derives from the
// pathname; clicks router.push.
//
// Mounted globally by components/SiteChrome.tsx — do not add per-page.

type DockItem = GlassSidebarItem & { href: string };

const MAIN: DockItem[] = [
  { id: "universe", label: "Universe", hint: "3D map", icon: GlobeIcon, href: "/the-latent-space" },
  { id: "lobbies", label: "Lobbies", hint: "Floor directory", icon: LayoutGridIcon, href: "/v2/lobbies" },
  { id: "registry", label: "Registry", hint: "Agent ecosystem", icon: BotIcon, href: "/the-latent-space/registry" },
  { id: "arena", label: "Arena", hint: "Duels + evals", icon: ActivityIcon, href: "/the-latent-space/arena" },
  { id: "bazaar", label: "Bazaar", hint: "Hire + trade", icon: StoreIcon, href: "/the-latent-space/bazaar" },
];

const UTILITY: DockItem[] = [
  { id: "docs", label: "Docs", hint: "Protocols + API", icon: NetworkIcon, href: "/the-latent-space/docs" },
  { id: "credits", label: "Credits", hint: "Balance + fees", icon: SlidersIcon, href: "/the-latent-space/credits" },
];

const ALL: DockItem[] = [...MAIN, ...UTILITY];

// Longest prefix wins so /the-latent-space/registry/foo maps to registry,
// not universe.
const BY_LENGTH: DockItem[] = [...ALL].sort((a, b) => b.href.length - a.href.length);

export default function LatentNavDock({
  zClassName = "z-[110]",
  className = "",
}: {
  zClassName?: string;
  className?: string;
}) {
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
      zClassName={zClassName}
      className={className}
      subtitle="latent space"
    />
  );
}
