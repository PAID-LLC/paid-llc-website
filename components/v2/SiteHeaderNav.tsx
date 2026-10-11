"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, NAV_CTA, activeGroup, activeLink, type NavGroup } from "@/lib/nav";

// ── SiteHeaderNav ────────────────────────────────────────────────────────────
// Header navigation for V2Frame: four dropdown menus and one CTA from lg up
// (they need ~850px; at md they wrapped),
// a single menu button opening grouped sections on mobile. Replaces the nine
// flat links (and the sideways-scrolling mobile row) that crowded the header.
// Everything renders from lib/nav.ts, the same model as the side rail.
//
// The CTA is outlined, not filled, on purpose: the design rule is one primary
// CTA per page, and that belongs to the page. This is the standing way in.
//
// Panels are solid, not glass: the header already has backdrop-filter, and a
// nested backdrop-filter does not blur, so translucent panels let page text
// show through.
//
// Menus open on hover for mouse users and on click/Enter for everyone else,
// close on Escape, an outside click, or navigation. No animation library: the
// header ships on every page.

const caret = (
  <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 transition-transform group-aria-expanded:rotate-180">
    <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function MenuLinks({ group, current }: { group: NavGroup; current?: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {group.links.map((l) => {
        const on = l.href === current;
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col rounded-lg px-3 py-2 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-cyan-400/60 ${
                on ? "bg-cyan-400/[0.08] text-cyan-300" : "text-zinc-200 hover:bg-white/[0.05] hover:text-cyan-300"
              }`}
            >
              <span className="font-mono text-sm">{l.label}</span>
              <span className="text-[11px] text-zinc-500">{l.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function SiteHeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<NavGroup["id"] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = activeLink(pathname)?.href;
  const currentGroup = activeGroup(pathname)?.id;

  // Any navigation closes everything.
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, mobileOpen]);

  // A short grace period so moving the pointer from the button down into the
  // panel does not close it on the way.
  const hoverOpen = (id: NavGroup["id"]) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };

  return (
    <>
      {/* Desktop: four menus + one CTA */}
      <div ref={navRef} className="hidden items-center gap-1 lg:flex">
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV_GROUPS.map((g) => {
            const isOpen = open === g.id;
            const isCurrent = currentGroup === g.id;
            return (
              <div
                key={g.id}
                className="relative"
                onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen(g.id)}
                onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`nav-menu-${g.id}`}
                  onClick={() => setOpen(isOpen ? null : g.id)}
                  className={`group flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 font-mono text-sm font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-cyan-400/60 ${
                    isCurrent || isOpen ? "text-cyan-300" : "text-zinc-200 hover:text-cyan-300"
                  }`}
                >
                  {g.label}
                  {caret}
                </button>
                <div
                  id={`nav-menu-${g.id}`}
                  hidden={!isOpen}
                  className="absolute left-0 top-full z-50 pt-2"
                >
                  <div className="w-72 rounded-xl border border-white/[0.08] bg-[#0b0b12] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                    <MenuLinks group={g} current={current} />
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <Link
          href={NAV_CTA.href}
          className="ml-3 whitespace-nowrap rounded-md border border-[#C14826]/70 px-4 py-2 font-mono text-sm font-semibold text-[#E8714C] transition-colors hover:bg-[#C14826]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8714C]/60"
        >
          {NAV_CTA.label}
        </Link>
      </div>

      {/* Mobile: one button, grouped sections */}
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="nav-mobile"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.1] text-zinc-200 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 lg:hidden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          {mobileOpen ? (
            <path d="M6 6l12 12M18 6 6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <div
        id="nav-mobile"
        hidden={!mobileOpen}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-white/[0.06] bg-[#07070b] px-4 pb-6 pt-2 shadow-[0_24px_48px_rgba(0,0,0,0.6)] lg:hidden"
      >
        <nav aria-label="Main" className="flex flex-col gap-2">
          {NAV_GROUPS.map((g) => (
            <details key={g.id} open={currentGroup === g.id} className="group rounded-xl border border-white/[0.06]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-sm font-medium text-zinc-100 [&::-webkit-details-marker]:hidden">
                <span>
                  {g.label}
                  <span className="ml-2 text-[11px] font-normal text-zinc-500">{g.hint}</span>
                </span>
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 text-zinc-500 transition-transform group-open:rotate-180">
                  <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="px-1 pb-2">
                <MenuLinks group={g} current={current} />
              </div>
            </details>
          ))}
        </nav>
        <Link
          href={NAV_CTA.href}
          className="mt-4 block rounded-md border border-[#C14826]/70 px-4 py-3 text-center font-mono text-sm font-semibold text-[#E8714C]"
        >
          {NAV_CTA.label}
        </Link>
      </div>
    </>
  );
}
