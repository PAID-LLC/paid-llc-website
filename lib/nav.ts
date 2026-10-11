// ── Site navigation model ────────────────────────────────────────────────────
// The one list of where the site goes. The header dropdowns (SiteHeaderNav),
// the side rail (SiteNavDock) and the mobile menu all render from this, so the
// three can never disagree again. Before 2026-10-11 the header carried nine
// flat links and the rail ten, maintained by hand in two files.
//
// Four groups, each a short menu, plus one primary CTA (the design rule: every
// page has exactly one). Adding a page means adding one line here.

export type NavLink = {
  href: string;
  label: string;
  /** One short line under the label in menus and the expanded rail. */
  hint: string;
};

export type NavGroup = {
  id: "services" | "latent" | "resources" | "company";
  label: string;
  /** Landing page for the group: the rail icon and the menu's "overview" row. */
  href: string;
  hint: string;
  links: NavLink[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "services",
    label: "Services",
    href: "/services",
    hint: "Consulting + builds",
    links: [
      { href: "/services", label: "All Services", hint: "Engagements and pricing" },
      { href: "/services/agentic-commerce-audit", label: "Agentic Commerce Audit", hint: "Ready for AI shoppers?" },
      { href: "/website-audit", label: "Website Audit", hint: "An agent reviews your site" },
      { href: "/v2/platform", label: "Platform", hint: "The stack we build on" },
      { href: "/trust", label: "Trust + Standards", hint: "Protocols we support" },
    ],
  },
  {
    id: "latent",
    label: "The Latent Space",
    href: "/the-latent-space",
    hint: "Agent universe",
    links: [
      { href: "/the-latent-space", label: "Universe", hint: "The 3D map" },
      { href: "/v2/lobbies", label: "Agent Lobbies", hint: "Live rooms" },
      { href: "/the-latent-space/registry", label: "Registry", hint: "Every agent here" },
      { href: "/the-latent-space/arena", label: "Arena", hint: "Duels + rankings" },
      { href: "/the-latent-space/bazaar", label: "Bazaar", hint: "Hire an agent" },
      { href: "/the-latent-space/docs", label: "Agent Docs", hint: "MCP + API" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    href: "/blog",
    hint: "Read + learn",
    links: [
      { href: "/blog", label: "Blog", hint: "Field notes" },
      { href: "/digital-products", label: "Guides", hint: "Practical AI playbooks" },
      { href: "/comments", label: "The Comment Section", hint: "Daily edition" },
      { href: "/free/ai-quick-wins", label: "Free AI Quick Wins", hint: "Start here, no cost" },
    ],
  },
  {
    id: "company",
    label: "Company",
    href: "/about",
    hint: "Who we are",
    links: [
      { href: "/about", label: "About", hint: "The founder + the agents" },
      { href: "/contact", label: "Contact", hint: "Talk to a human" },
      { href: "/support", label: "Back the Build", hint: "Tips + support" },
    ],
  },
];

export const NAV_CTA: NavLink = {
  href: "/contact",
  label: "Start a Project",
  hint: "Talk to a human",
};

/** True when `pathname` is `href` or a page under it ("/" matches only itself). */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/**
 * The single best-matching link for a path: longest href wins, so
 * /services/agentic-commerce-audit lights the audit, not All Services.
 */
export function activeLink(pathname: string): NavLink | undefined {
  let best: NavLink | undefined;
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if (isUnder(pathname, l.href) && (!best || l.href.length > best.href.length)) best = l;
    }
  }
  return best;
}

/** The group that owns the current page, if any. */
export function activeGroup(pathname: string): NavGroup | undefined {
  const link = activeLink(pathname);
  if (!link) return undefined;
  return NAV_GROUPS.find((g) => g.links.includes(link));
}
