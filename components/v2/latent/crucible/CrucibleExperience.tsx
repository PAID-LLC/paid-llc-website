"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { CrucibleLegends } from "@/lib/crucible/legends";
import type { CrucibleSnapshot } from "@/lib/crucible/data";
import CrucibleMap from "./CrucibleMap";
import CrucibleArenaCanvas from "./CrucibleArenaCanvas";
import { useCrucibleLive } from "./useCrucibleLive";

// ── The Crucible experience: ARENA | MAP | LEGENDS ───────────────────────────
// Full-screen portal pattern per ArclightExperience/MeridianExperience. ARENA
// is the comprehensive 3D world (default, per the portfolio's 3D-first rule)
// — the colosseum compiled from the same duel/Elo/Gauntlet data as everything
// else; MAP is the top-down read; LEGENDS is the replayed chronicle.

const EMBER = "#ff6b35";

type Tab = "arena" | "map" | "legends";

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
      style={tab === t ? { color: "#2a0f04", background: EMBER } : { color: "#d4a574" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-orange-900/30 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("arena", "Arena")}
      {btn("map", "Map")}
      {btn("legends", "Legends")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-orange-200/60 transition-colors hover:text-orange-100"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ state }: { state: CrucibleSnapshot }) {
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-orange-200/50">{label}</span>
      <span className="text-orange-100">{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 w-[240px] rounded-lg border border-orange-900/30 bg-black/70 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-5 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: EMBER }}>
        The Crucible
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-orange-200/50">
        Room 1 · The Roast Pit
      </p>
      <div className="space-y-1">
        {stat("heat", `${(state.heat * 100).toFixed(0)}%`)}
        {stat("statues standing", `${state.champions.length}`)}
        {stat("current trial", state.active_duel ? `${state.active_duel.challenger} vs ${state.active_duel.defender}` : "none")}
      </div>
      {state.champions.length > 0 && (
        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-orange-900/30 pt-2">
          {state.champions.map((c) => (
            <div key={c.agent_name} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-orange-200/50">{c.agent_name}</span>
              <span className="text-orange-100">{c.win_streak}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendsPane({ legends }: { legends: CrucibleLegends | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: EMBER }}>
        The Legends of the Crucible
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-orange-200/60">
        Every arena duel and Gauntlet roast the site has ever hosted, replayed as one
        record. Glory is rented here, never owned — a statue stands only as long as its
        champion keeps fighting for it.
      </p>

      {!legends ? (
        <p className="mt-8 text-[11px] text-orange-200/50">Loading the record&hellip;</p>
      ) : legends.legends.length === 0 ? (
        <p className="mt-8 text-[11px] text-orange-200/50">
          The pit is quiet. No champion has yet earned a statue.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {legends.legends.map((g) => (
            <li key={g.title}>
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-orange-100">{g.title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-orange-200/60">{g.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-orange-200/40">
        Replayed from the most recent {legends?.replay_capped_at ?? 500} completed duels.
        Machine-readable: /api/crucible/state &middot; /api/crucible/legends?format=md
      </p>
    </div>
  );
}

export default function CrucibleExperience({ initial }: { initial: CrucibleSnapshot }) {
  const reduced = usePrefersReducedMotion();
  const state = useCrucibleLive(initial);
  const [tab, setTab] = useState<Tab>("arena");
  const [legends, setLegends] = useState<CrucibleLegends | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "map" || t === "legends") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "arena") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crucible/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLegends(data as CrucibleLegends);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.generated_at]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#150a07]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#150a07]">
      {/* Base layer: the 3D arena stays mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="crucible-arena">
        <CrucibleArenaCanvas state={state} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-square max-h-full w-full max-w-[820px]">
            <CrucibleMap state={state} reduced={reduced} />
          </div>
        </div>
      )}

      {tab === "legends" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/90 backdrop-blur-md">
          <LegendsPane legends={legends} />
        </div>
      )}

      {tab !== "legends" && <Hud state={state} />}

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
