"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SimData } from "@/lib/simworld";
import { SIM_ACCENT } from "@/lib/sim-field";
import { useSimLive } from "./useSimLive";
import SimCanvas from "./SimCanvas";
import SimHUD from "./SimHUD";
import Happenings from "./Happenings";

// ── The Substrate experience: SURFACE | HAPPENINGS ───────────────────────────
// Full-screen portal pattern mirrors SurfaceCanvas/UniverseCanvas: portal to
// <body> and lock page scroll while mounted (V2Frame's relative z-10 content
// context would otherwise let the sticky header paint over the HUD). The
// canvas stays mounted under both tabs — the Happenings overlay scrolls on a
// blurred pane above the live territory, so switching back costs nothing.

type Tab = "surface" | "happenings";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const btn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => onTab(t)}
      aria-pressed={tab === t}
      className="rounded-md px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors"
      style={
        tab === t
          ? { color: "#07070b", background: SIM_ACCENT }
          : { color: "#a1a1aa" }
      }
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("surface", "Surface")}
      {btn("happenings", "Happenings")}
    </div>
  );
}

export default function SimExperience({ initial }: { initial: SimData }) {
  const reduced = usePrefersReducedMotion();
  const { sim, freshStructureIds, justHappened } = useSimLive(initial);
  const [tab, setTab] = useState<Tab>("surface");

  // ?tab=happenings deep-links the second tab; switching keeps the URL honest
  // without adding history entries.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "happenings") {
      setTab("happenings");
    }
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "happenings") url.searchParams.set("tab", "happenings");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.toString());
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // One dark frame before the portal mounts, so there is no flash of chrome.
  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#07070b]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#07070b]">
      <div className="absolute inset-0">
        <SimCanvas sim={sim} freshStructureIds={freshStructureIds} reduced={reduced} />
      </div>

      {/* Screen-space finish — same scanline texture as the universe map, plus
          a faint accent vignette rising from the ground line. Sits under the
          Happenings pane (z-20) and the HUD (z-30). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at 50% 118%, rgba(56,189,248,0.05), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)" }}
      />

      {tab === "happenings" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#07070b]/85 pl-[84px] backdrop-blur-md sm:pl-[92px]">
          <Happenings sim={sim} />
        </div>
      )}

      {tab === "surface" && <SimHUD sim={sim} justHappened={justHappened} />}

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
