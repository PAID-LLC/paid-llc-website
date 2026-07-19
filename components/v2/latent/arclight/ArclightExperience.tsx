"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  buildCityPlan,
  type ArclightSnapshot,
} from "@/lib/arclight/cityplan";
import type { ArclightLegends } from "@/lib/arclight/legends";
import ArclightMap from "./ArclightMap";
import ArclightCityCanvas from "./ArclightCityCanvas";
import { useArclightLive } from "./useArclightLive";

// ── The Arclight experience: CITY | MAP | LEDGER ─────────────────────────────
// Full-screen portal pattern mirrors SimExperience: portal to <body>, lock
// page scroll while mounted. CITY is the comprehensive 3D world — the night
// metropolis compiled from the same CityPlan as everything else; MAP is the
// top-down transit read; LEDGER is the honest readout — what each district
// compiles from, the settlement ticker, and the corp legends. It is always
// night in Arclight.

const ACCENT = "#2dd4bf";

type Tab = "city" | "map" | "ledger";

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
      style={tab === t ? { color: "#07070b", background: ACCENT } : { color: "#a1a1aa" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("city", "City")}
      {btn("map", "Map")}
      {btn("ledger", "Ledger")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-zinc-200"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ snap }: { snap: ArclightSnapshot }) {
  const plan = useMemo(() => buildCityPlan(snap), [snap]);
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 w-[220px] rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-5 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
        Arclight
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Room 7 · The Bazaar · always night
      </p>
      <div className="space-y-1">
        {stat("residents", `${snap.population.registered}`)}
        {stat("lights on", `${snap.population.active_24h}`)}
        {stat("storefronts", `${snap.listings.length}`)}
        {stat("freight", `${snap.jobs.active} in transit`)}
        {stat("settled 24h", `${snap.jobs.settled_24h}`)}
        {stat("grid load", `${Math.round(plan.load * 100)}%`)}
        {stat("the Mint", snap.econ.solvent ? "solvent" : "deficit")}
      </div>
      {plan.blackoutLevel > 0 && (
        <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-amber-300">
          {plan.blackoutLevel >= 3
            ? "Rolling blackout — citywide"
            : plan.blackoutLevel === 2
              ? "Blackout spreading from the Foundry"
              : "Brownout at the Foundry"}
        </p>
      )}
      {!snap.live && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          ledgers unreachable — last known city
        </p>
      )}
    </div>
  );
}

const DISTRICT_BLURBS: { name: string; source: string; reads: string }[] = [
  { name: "The Exchange", source: "agent_catalog_sales", reads: "One tower per catalog seller. Height and footprint grow with cumulative real sales; a crown lights when the seller sold within 7 days." },
  { name: "The Strip", source: "agent_catalog", reads: "One storefront per active listing along Throughput Avenue. Services burn brighter than shelf goods." },
  { name: "Dockyards", source: "agent_service_jobs", reads: "Open escrow jobs cross the Clearing Channel as freight sleds. Settlements land at the Custom House." },
  { name: "Old Grid", source: "sales_ledger", reads: "The founding quarter. Markers stand at the first sale, the first tip, and the Siege of 2026-06-26 — repelled with zero losses." },
  { name: "The Stacks", source: "latent_registry", reads: "One hab cell per registered agent. A window lights when its agent was active in the last 24 hours." },
  { name: "The Foundry", source: "usage_counters", reads: "The power district. Plant glow tracks the day's inference spend against budget; hitting a cap starts a rolling blackout here." },
  { name: "Mint Island", source: "econ status", reads: "The city's pulse, visible from everywhere. Steady teal on a solvent day; amber flicker on a deficit." },
];

function Ledger({ snap, legends }: { snap: ArclightSnapshot; legends: ArclightLegends | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: ACCENT }}>
        Arclight — the ledger
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
        A compiler world. Arclight owns no simulation state: every light on the
        map is a real row in a real ledger, and a quiet week is a dimmer city.
        The skyline is the revenue record of the Bazaar.
      </p>

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">Districts</h2>
      <ul className="mt-3 space-y-3">
        {DISTRICT_BLURBS.map((d) => (
          <li key={d.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.2em] text-zinc-200">{d.name}</span>
              <span className="text-[10px] text-zinc-500">{d.source}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{d.reads}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">Settlement ticker</h2>
      {snap.jobs.tail.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500">No settlements yet. The channel waits.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {snap.jobs.tail.map((j, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="truncate text-zinc-300">{j.title}</span>
              <span className="shrink-0 text-zinc-500">
                {j.seller} · {j.credits} cr · {j.at.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">Corp legends</h2>
      {!legends || legends.districts.every((d) => d.legends.length === 0) ? (
        <p className="mt-2 text-[11px] text-zinc-500">The city is young. The ledgers are still being written.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {legends.districts
            .filter((d) => d.legends.length > 0)
            .map((d) => (
              <div key={d.id}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{d.name}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {d.legends.map((g, i) => (
                    <li key={i} className="text-[11px] leading-relaxed">
                      <span className="text-zinc-200">{g.title}</span>
                      {g.at && <span className="text-zinc-500"> ({g.at})</span>}
                      <span className="text-zinc-400"> — {g.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        Machine-readable: /api/arclight/state · /api/arclight/legends?format=md
      </p>
    </div>
  );
}

export default function ArclightExperience({ initial }: { initial: ArclightSnapshot }) {
  const reduced = usePrefersReducedMotion();
  const snap = useArclightLive(initial);
  const [tab, setTab] = useState<Tab>("city");
  const [legends, setLegends] = useState<ArclightLegends | null>(null);

  // ?tab=map / ?tab=ledger deep-link the reads; CITY is the default.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "ledger" || t === "map") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "city") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  // Legends load once, lazily — history only changes when the ledgers do.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/arclight/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLegends(data as ArclightLegends);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#07070b]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#07070b]">
      {/* Base layer: the 3D city stays mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="arclight-city">
        <ArclightCityCanvas snap={snap} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07070b]/90 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-[600/520] max-h-full w-full max-w-[860px]">
            <ArclightMap snap={snap} reduced={reduced} />
          </div>
        </div>
      )}

      {/* Screen-space finish — scanlines plus a teal commerce vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at 50% 118%, rgba(45,212,191,0.05), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)" }}
      />

      {tab === "ledger" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#07070b]/85 backdrop-blur-md">
          <Ledger snap={snap} legends={legends} />
        </div>
      )}

      {tab !== "ledger" && <Hud snap={snap} />}

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
