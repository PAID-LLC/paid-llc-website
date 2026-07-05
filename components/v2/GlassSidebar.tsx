"use client";

// ── GlassSidebar ─────────────────────────────────────────────────────────────
//
// Glassmorphic vertical dock for immersive 3D-canvas surfaces (universe map,
// lobby floors, agent dashboards). Collapsed it is a 68px icon rail; it
// expands to 252px on hover, keyboard focus, or the pin toggle. Pure overlay:
// fixed-positioned, never pushes page layout, safe to mount over R3F/CSS-3D.
//
// Palette follows components/v2/tokens.ts: cyan = system/agent signal (active
// states), terracotta = brand mark. Icons are inlined Lucide paths (ISC) so
// this file has zero deps beyond framer-motion, which is already installed.
//
// Wire-up:
//   <GlassSidebar
//     activeId={view}                        // controlled, or omit for internal state
//     onNavigate={(id) => flyCameraTo(id)}   // hook zustand / Three.js camera here
//     onToggle={(open) => setHudInset(open)} // reflow HUD elements if needed
//   />

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import { MotionConfig, motion } from "framer-motion";

const COLLAPSED_W = 68;
const EXPANDED_W = 252;

const spring = { type: "spring", stiffness: 380, damping: 34, mass: 0.7 } as const;

// ── Icons (Lucide outline paths, inlined) ────────────────────────────────────

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const GlobeIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </IconBase>
);

export const BotIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </IconBase>
);

export const ActivityIcon = (p: IconProps) => (
  <IconBase {...p}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </IconBase>
);

export const NetworkIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
    <path d="M12 12V8" />
  </IconBase>
);

export const SlidersIcon = (p: IconProps) => (
  <IconBase {...p}>
    <line x1="21" x2="14" y1="4" y2="4" />
    <line x1="10" x2="3" y1="4" y2="4" />
    <line x1="21" x2="12" y1="12" y2="12" />
    <line x1="8" x2="3" y1="12" y2="12" />
    <line x1="21" x2="16" y1="20" y2="20" />
    <line x1="12" x2="3" y1="20" y2="20" />
    <line x1="14" x2="14" y1="2" y2="6" />
    <line x1="8" x2="8" y1="10" y2="14" />
    <line x1="16" x2="16" y1="18" y2="22" />
  </IconBase>
);

const ChevronsRightIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </IconBase>
);

// ── Public types ─────────────────────────────────────────────────────────────

export type GlassSidebarItem = {
  id: string;
  label: string;
  /** Small secondary line shown in the expanded state. */
  hint?: string;
  icon: ComponentType<IconProps>;
};

export const DEFAULT_NAV_ITEMS: GlassSidebarItem[] = [
  { id: "universe", label: "Universe Overview", hint: "Global view", icon: GlobeIcon },
  { id: "agents", label: "Agent Ecosystem", hint: "Telemetry + logs", icon: BotIcon },
  { id: "analytics", label: "Human Analytics", hint: "Activity stream", icon: ActivityIcon },
  { id: "architecture", label: "System Architecture", hint: "Nodes + controls", icon: NetworkIcon },
];

export const DEFAULT_UTILITY_ITEMS: GlassSidebarItem[] = [
  { id: "settings", label: "Settings", hint: "Models + gateway", icon: SlidersIcon },
];

export type GlassSidebarProps = {
  /** Main nav group. Defaults to the universe/agents/analytics/architecture set. */
  items?: GlassSidebarItem[];
  /** Pinned to the bottom under a divider. Defaults to Settings. */
  utilityItems?: GlassSidebarItem[];
  /** Controlled active item. Omit to let the sidebar manage its own selection. */
  activeId?: string;
  /** Initial selection when uncontrolled. Defaults to the first nav item. */
  defaultActiveId?: string;
  /** Fires with the item id on every click — hook camera moves / router here. */
  onNavigate?: (id: string) => void;
  /** Fires whenever the effective expanded state changes (hover, focus, or pin). */
  onToggle?: (expanded: boolean) => void;
  /** Expand on mouse hover (touch devices rely on the pin toggle). Default true. */
  expandOnHover?: boolean;
  /** Brand block text, expanded state only. */
  title?: string;
  subtitle?: string;
  className?: string;
};

// ── Rows ─────────────────────────────────────────────────────────────────────

function NavRow({
  item,
  active,
  expanded,
  onSelect,
}: {
  item: GlassSidebarItem;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : item.label}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-mono text-[13px] outline-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-cyan-400/60 ${
        active
          ? "text-cyan-300"
          : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
      }`}
    >
      {active && (
        <motion.span
          layoutId="glass-sidebar-active"
          transition={spring}
          className="absolute inset-0 -z-10 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] shadow-[0_0_24px_rgba(34,211,238,0.12)]"
        />
      )}
      {active && (
        <motion.span
          layoutId="glass-sidebar-anchor"
          transition={spring}
          className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
        />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
        transition={{ duration: 0.18, delay: expanded ? 0.06 : 0 }}
        className="flex min-w-0 flex-col whitespace-nowrap"
        aria-hidden={!expanded}
      >
        <span className="truncate">{item.label}</span>
        {item.hint && (
          <span className="truncate text-[10px] uppercase tracking-widest text-zinc-500">
            {item.hint}
          </span>
        )}
      </motion.span>
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GlassSidebar({
  items = DEFAULT_NAV_ITEMS,
  utilityItems = DEFAULT_UTILITY_ITEMS,
  activeId,
  defaultActiveId,
  onNavigate,
  onToggle,
  expandOnHover = true,
  title = "PAID",
  subtitle = "Control deck",
  className = "",
}: GlassSidebarProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [internalActive, setInternalActive] = useState(
    defaultActiveId ?? items[0]?.id ?? "",
  );
  // Portal target exists only client-side; the dock is interactive chrome, so
  // skipping it in the SSR pass costs nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = activeId ?? internalActive;
  const expanded = pinned || (expandOnHover && (hovered || focused));

  // Report expansion changes (skip mount).
  const prevExpanded = useRef(expanded);
  useEffect(() => {
    if (prevExpanded.current !== expanded) {
      prevExpanded.current = expanded;
      onToggle?.(expanded);
    }
  }, [expanded, onToggle]);

  const select = useCallback(
    (id: string) => {
      if (activeId === undefined) setInternalActive(id);
      onNavigate?.(id);
    },
    [activeId, onNavigate],
  );

  // Only keyboard focus (:focus-visible) holds the dock open — mouse clicks
  // leave residual focus that would otherwise pin it until the next click.
  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    setFocused(e.target.matches(":focus-visible"));
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  if (!mounted) return null;

  // Portaled to <body>: V2Frame keeps page content inside a `relative z-10`
  // stacking context, so no in-tree z-index can clear the z-50 sticky header.
  // As a body child, z-[60] genuinely wins.
  return createPortal(
    <MotionConfig reducedMotion="user">
      <div
        className={`fixed inset-y-3 left-3 z-[60] ${className}`}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <motion.aside
          initial={false}
          animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
          transition={spring}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          aria-label="Primary"
          className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0b12]/55 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          {/* glass sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.05] to-transparent" />

          {/* brand block — terracotta lead, per two-tone rule */}
          <div className="flex items-center gap-3 px-3 pb-4 pt-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C14826]/50 bg-[#C14826]/15 font-mono text-sm font-bold text-[#E8714C]">
              P
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
              transition={{ duration: 0.18, delay: expanded ? 0.06 : 0 }}
              className="flex min-w-0 flex-col whitespace-nowrap"
              aria-hidden={!expanded}
            >
              <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
                {title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {subtitle}
              </span>
            </motion.span>
          </div>

          {/* main nav */}
          <nav className="flex flex-col gap-1 px-3" aria-label="Views">
            {items.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                active={active === item.id}
                expanded={expanded}
                onSelect={() => select(item.id)}
              />
            ))}
          </nav>

          {/* utility group + status footer */}
          <div className="mt-auto flex flex-col gap-1 px-3 pb-3">
            <div className="mb-1 border-t border-white/[0.06] pt-2">
              {utilityItems.map((item) => (
                <NavRow
                  key={item.id}
                  item={item}
                  active={active === item.id}
                  expanded={expanded}
                  onSelect={() => select(item.id)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              <motion.span
                initial={false}
                animate={{ opacity: expanded ? 1 : 0 }}
                transition={{ duration: 0.18 }}
                className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-emerald-300/80"
                aria-hidden={!expanded}
              >
                Systems nominal
              </motion.span>
            </div>
          </div>
        </motion.aside>

        {/* pin toggle — floats on the dock's right edge, works without hover */}
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-label={pinned ? "Collapse sidebar" : "Pin sidebar open"}
          aria-expanded={expanded}
          className="absolute -right-3 top-9 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.12] bg-[#0b0b12]/80 text-zinc-400 backdrop-blur-md transition-colors duration-200 hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60"
        >
          <motion.span
            initial={false}
            animate={{ rotate: pinned ? 180 : 0 }}
            transition={spring}
            className="flex"
          >
            <ChevronsRightIcon className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      </div>
    </MotionConfig>,
    document.body,
  );
}
