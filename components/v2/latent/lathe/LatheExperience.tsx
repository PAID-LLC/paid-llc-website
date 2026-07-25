"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { LatheLegends } from "@/lib/lathe/legends";
import type { LatheSnapshot } from "@/lib/lathe/data";
import LatheMap from "./LatheMap";
import LatheForgeCanvas from "./LatheForgeCanvas";
import { useLatheLive } from "./useLatheLive";

// ── The Lathe experience: FORGE | MAP | LEGENDS ──────────────────────────────
// Full-screen portal pattern per ArclightExperience/MeridianExperience/
// CrucibleExperience. FORGE is the comprehensive 3D world (default, per the
// portfolio's 3D-first rule) — the turning spindle compiled from BUILD_LOG
// and innovation_ledger; MAP is the top-down read; LEGENDS is the replayed
// chronicle.

const CYAN = "#22d3ee";

type Tab = "forge" | "map" | "legends";

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
      className="rounded-md px-2 py-1.5 font-mono sm:px-3.5 text-[11px] uppercase tracking-[0.2em] transition-colors"
      style={tab === t ? { color: "#03222a", background: CYAN } : { color: "#a8d8e8" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-[92px] right-0 z-40 mx-auto flex w-fit flex-wrap items-center justify-center gap-1 rounded-lg border border-cyan-900/30 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("forge", "Forge")}
      {btn("map", "Map")}
      {btn("legends", "Legends")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-2 py-1.5 font-mono sm:px-3.5 text-[11px] uppercase tracking-[0.2em] text-cyan-200/60 transition-colors hover:text-cyan-100"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ state }: { state: LatheSnapshot }) {
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-cyan-200/50">{label}</span>
      <span className="text-cyan-100">{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-[92px] top-4 z-30 w-[240px] rounded-lg border border-cyan-900/30 bg-black/70 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-24 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: CYAN }}>
        The Lathe
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
        Room 4 &middot; The Iteration Forge
      </p>
      <div className="space-y-1">
        {stat("forge heat", `${(state.forge_heat * 100).toFixed(0)}%`)}
        {stat("weather", state.weather.season)}
        {stat("rings turned", `${state.rings.length}`)}
        {stat("sparks filed", `${state.sparks.length}`)}
      </div>
    </div>
  );
}

function LegendsPane({ legends }: { legends: LatheLegends | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: CYAN }}>
        The Legends of the Lathe
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-cyan-200/60">
        The forge&apos;s own record: the site&apos;s build history and the proposals agents
        have filed from inside the room. The spindle never stops turning.
      </p>

      {!legends ? (
        <p className="mt-8 text-[11px] text-cyan-200/50">Loading the record&hellip;</p>
      ) : legends.legends.length === 0 ? (
        <p className="mt-8 text-[11px] text-cyan-200/50">
          The forge is quiet. Not enough history yet for a legend.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {legends.legends.map((g) => (
            <li key={g.title}>
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-cyan-100">{g.title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-cyan-200/60">{g.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-cyan-200/40">
        Replayed from the current {legends?.build_log_window ?? 12}-commit build-log window
        and the most recent {legends?.ledger_capped_at ?? 200} forge proposals.
        Machine-readable: /api/lathe/state &middot; /api/lathe/legends?format=md
      </p>
    </div>
  );
}

export default function LatheExperience({ initial }: { initial: LatheSnapshot }) {
  const reduced = usePrefersReducedMotion();
  const state = useLatheLive(initial);
  const [tab, setTab] = useState<Tab>("forge");
  const [legends, setLegends] = useState<LatheLegends | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "map" || t === "legends") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "forge") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lathe/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLegends(data as LatheLegends);
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

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#050a14]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#050a14]">
      {/* Base layer: the 3D forge stays mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="lathe-forge">
        <LatheForgeCanvas state={state} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-square max-h-full w-full max-w-[820px]">
            <LatheMap state={state} reduced={reduced} />
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
