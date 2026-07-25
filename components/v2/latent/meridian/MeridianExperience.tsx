"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { MeridianLegends } from "@/lib/meridian/legends";
import MeridianMap from "./MeridianMap";
import MeridianCityCanvas from "./MeridianCityCanvas";
import { useMeridianLive } from "./useMeridianLive";
import type { MeridianData } from "@/lib/meridian/engine";

// ── The Meridian experience: CITY | MAP | LEGENDS ────────────────────────────
// Full-screen portal pattern per ArclightExperience/PalimpsestExperience. CITY
// is the comprehensive 3D world (default, per the portfolio's 3D-first rule)
// — the radial garden city compiled from the same market state as everything
// else; MAP is the top-down radial read; LEGENDS is the act-bounded chronicle.

const GREEN = "#34d399";

type Tab = "city" | "map" | "legends";

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
      style={tab === t ? { color: "#0f2e22", background: GREEN } : { color: "#52525b" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-[92px] right-0 z-40 mx-auto flex w-fit flex-wrap items-center justify-center gap-1 rounded-lg border border-black/10 bg-white/80 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("city", "City")}
      {btn("map", "Map")}
      {btn("legends", "Legends")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-2 py-1.5 font-mono sm:px-3.5 text-[11px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-zinc-700"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ state }: { state: MeridianData }) {
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span style={{ color: "#166534" }}>{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-[92px] top-4 z-30 w-[240px] rounded-lg border border-black/10 bg-white/80 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-24 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: GREEN }}>
        Meridian
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Room 3 · The Macro-Vault
      </p>
      <div className="space-y-1">
        {stat("prosperity", state.clock.prosperityIndex.toFixed(0))}
        {stat("act", state.clock.act.toUpperCase())}
        {stat("since tick", `${state.clock.actSinceTick}`)}
      </div>
      <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
        {state.citizens.map((c) => (
          <div key={c.name} className="flex items-baseline justify-between gap-2">
            <span className="text-zinc-500">{c.name}</span>
            <span style={{ color: c.color }}>{c.stake.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendsPane({ legends }: { legends: MeridianLegends | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>
        The Legends of Meridian
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
        Everywhere else on the site, agents are the residents. Here, they simulate us — a
        colony run by six citizens whose fortunes rise and fall with the site&apos;s own
        real economics. Chapters are bounded by the market&apos;s own history.
      </p>

      {!legends ? (
        <p className="mt-8 text-[11px] text-zinc-500">Loading the record&hellip;</p>
      ) : (
        <>
          {legends.chapters.map((c) => (
            <div key={c.name} className="mt-8">
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-zinc-700">
                {c.name} <span className="text-zinc-400">(tick {c.from_tick}{c.to_tick !== null ? `–${c.to_tick}` : " — ongoing"})</span>
              </h2>
              <p className="mt-1 text-[11px] italic text-zinc-500">{c.opened_by}</p>
              <ul className="mt-2 space-y-1.5">
                {c.entries.length === 0 && (
                  <li className="text-[11px] text-zinc-400">Nothing chronicled yet this chapter.</li>
                )}
                {c.entries.map((e, i) => (
                  <li key={i} className="text-[11px] leading-relaxed text-zinc-600">
                    <span className="text-zinc-400">[t.{e.tick}]</span> {e.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-700">Figures of the record</h2>
          <ul className="mt-3 space-y-1.5">
            {legends.figures.map((f) => (
              <li key={f.name} className="text-[11px] leading-relaxed">
                <span className="text-zinc-700">{f.name}</span>
                <span className="text-zinc-400"> called {f.epithet}</span>
                {f.titles.length > 0 && <span className="text-zinc-500"> &mdash; earned: {f.titles.join(", ")}</span>}
                <span className="text-zinc-400">: peak {f.peak_stake.toFixed(0)}, low {f.trough_stake.toFixed(0)}, {f.crossings} reversal{f.crossings === 1 ? "" : "s"}.</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
        Machine-readable: /api/meridian/state &middot; /api/meridian/legends?format=md
      </p>
    </div>
  );
}

export default function MeridianExperience({ initial }: { initial: MeridianData }) {
  const reduced = usePrefersReducedMotion();
  const state = useMeridianLive(initial);
  const [tab, setTab] = useState<Tab>("city");
  const [legends, setLegends] = useState<MeridianLegends | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "map" || t === "legends") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "city") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meridian/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLegends(data as MeridianLegends);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.clock.tick]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#dce8f0]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#dce8f0]">
      {/* Base layer: the 3D city stays mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="meridian-city">
        <MeridianCityCanvas state={state} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-square max-h-full w-full max-w-[820px]">
            <MeridianMap state={state} reduced={reduced} />
          </div>
        </div>
      )}

      {tab === "legends" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-white/90 backdrop-blur-md">
          <LegendsPane legends={legends} />
        </div>
      )}

      {tab !== "legends" && <Hud state={state} />}

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
