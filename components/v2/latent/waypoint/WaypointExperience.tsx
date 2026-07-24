"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { WaypointLegends } from "@/lib/waypoint/legends";
import type { WaypointSnapshot } from "@/lib/waypoint/data";
import WaypointMap from "./WaypointMap";
import WaypointPortCanvas from "./WaypointPortCanvas";
import { useWaypointLive } from "./useWaypointLive";

// ── The Waypoint experience: PORT | MAP | LEGENDS ────────────────────────────
// Full-screen portal pattern per every other world's Experience shell. PORT is
// the comprehensive 3D world (default, per the portfolio's 3D-first rule) —
// the Concourse and its 7 gates, each compiled from another already-shipped
// world's own data; MAP is the top-down read; LEGENDS is the superlatives.

const GOLD = "#ffdf9e";

type Tab = "port" | "map" | "legends";

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
      style={tab === t ? { color: "#2a1f04", background: GOLD } : { color: "#e8d9b8" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-amber-900/30 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("port", "Port")}
      {btn("map", "Map")}
      {btn("legends", "Legends")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100/60 transition-colors hover:text-amber-50"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ state }: { state: WaypointSnapshot }) {
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-amber-100/50">{label}</span>
      <span className="text-amber-50">{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 w-[240px] rounded-lg border border-amber-900/30 bg-black/70 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-5 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: GOLD }}>
        Waypoint
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-amber-100/50">Room 6 &middot; The Nexus</p>
      <div className="space-y-1">
        {stat("traffic", state.traffic.season)}
        {stat("gates lit", `${state.stats.gates_lit}`)}
        {stat("boarding", `${state.stats.gates_boarding}`)}
        {stat("dark", `${state.stats.gates_dark}`)}
      </div>
    </div>
  );
}

function LegendsPane({ legends }: { legends: WaypointLegends | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: GOLD }}>
        The Legends of Waypoint
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-amber-100/60">
        The crossroads keeps no history of its own — its record is the other six worlds&apos;,
        replayed as arrivals and departures.
      </p>

      {!legends ? (
        <p className="mt-8 text-[11px] text-amber-100/50">Loading the board&hellip;</p>
      ) : legends.legends.length === 0 ? (
        <p className="mt-8 text-[11px] text-amber-100/50">The Concourse is quiet. No traffic yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {legends.legends.map((g) => (
            <li key={g.title}>
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-amber-50">{g.title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-100/60">{g.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-amber-100/40">
        Compiled from the other six worlds&apos; own data — Genesis, Substrate, Arclight, Palimpsest, Meridian,
        the Crucible, and the Lathe. Machine-readable: /api/waypoint/state &middot; /api/waypoint/legends?format=md
      </p>
    </div>
  );
}

export default function WaypointExperience({ initial }: { initial: WaypointSnapshot }) {
  const reduced = usePrefersReducedMotion();
  const state = useWaypointLive(initial);
  const [tab, setTab] = useState<Tab>("port");
  const [legends, setLegends] = useState<WaypointLegends | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "map" || t === "legends") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "port") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waypoint/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setLegends(data as WaypointLegends);
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

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#0b0d14]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#0b0d14]">
      {/* Base layer: the 3D port stays mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="waypoint-port">
        <WaypointPortCanvas state={state} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-[2.46/1] max-h-full w-full max-w-[980px]">
            <WaypointMap state={state} reduced={reduced} />
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
