"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ResidentsPanel from "@/components/v2/latent/ResidentsPanel";
import Link from "next/link";
import type { Codex } from "@/lib/palimpsest/codex";
import DigMap from "./DigMap";
import PalimpsestRuinsCanvas from "./PalimpsestRuinsCanvas";
import { usePalimpsestLive, type PalimpsestState } from "./usePalimpsestLive";

// ── The Palimpsest experience: RUINS | MAP | CODEX ───────────────────────────
// Full-screen portal pattern per SimExperience/ArclightExperience. RUINS is
// the comprehensive 3D world — the dune sea and the open digs, compiled from
// the same history and excavation state as everything else; MAP is the
// top-down fog-of-war read; CODEX is the Recovered Record — the known portion
// of a history that already exists in full. The world is still: no weather,
// no decay, no tick. Only the diggers move.

const AMBER = "#d9a441";

type Tab = "ruins" | "map" | "codex";

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
      style={tab === t ? { color: "#14100a", background: AMBER } : { color: "#a1a1aa" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-[92px] right-0 z-40 mx-auto flex w-fit flex-wrap items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("ruins", "Ruins")}
      {btn("map", "Map")}
      {btn("codex", "Codex")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-2 py-1.5 font-mono sm:px-3.5 text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-zinc-200"
      >
        Universe
      </Link>
    </div>
  );
}

function Hud({ state }: { state: PalimpsestState }) {
  const dig = state.excavation;
  const stat = (label: string, value: string) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span style={{ color: "#cbb27e" }}>{value}</span>
    </div>
  );
  return (
    <div className="pointer-events-none absolute left-[92px] top-4 z-30 w-[240px] rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-24 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: AMBER }}>
        Palimpsest
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Room 2 · The Intellectual Hub · still
      </p>
      <div className="space-y-1">
        {stat("theses filed", `${dig.theses_total}`)}
        {stat("sites open", `${dig.sites_unlocked} / ${dig.sites_total}`)}
        {dig.next && stat("next site", `${dig.next.needs} more`)}
        {stat("the vault", dig.vault.open ? "OPEN" : `sealed (${dig.vault.needs})`)}
        {stat("survey teams", `${state.survey_teams_24h}`)}
      </div>
      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-zinc-500">
        This week at the Symposium: &ldquo;{state.symposium.question}&rdquo;
        <br />
        Every filed thesis advances the dig.
      </p>
    </div>
  );
}

function CodexPane({ state, codex }: { state: PalimpsestState; codex: Codex | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: AMBER }}>
        The Recovered Record
      </h1>
      <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
        The First Writers left a finished history beneath the dust. None of it
        is generated on demand and none of it can be rushed: the record below
        is exactly what the dig has earned, fragment by fragment, and the rest
        stays buried until theses are filed at the Symposium.
      </p>

      {!codex || codex.recovered_ages.length === 0 ? (
        <p className="mt-8 text-[11px] leading-relaxed text-zinc-500">
          Nothing has been excavated. The city lies whole beneath the dust, and
          the record is blank. File a thesis to open the first site.
        </p>
      ) : (
        <>
          <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">
            Recovered ages ({codex.completeness})
          </h2>
          <div className="mt-3 space-y-4">
            {codex.recovered_ages.map((age) => (
              <div key={age.folio} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] uppercase tracking-[0.15em]" style={{ color: "#cbb27e" }}>
                    {age.name}
                  </span>
                  <span className="text-[10px] text-zinc-500">{age.leaves}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {age.known_fragments.map((fr, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-zinc-400">
                      <span className="text-zinc-500">L.{fr.leaf}:</span> {fr.text}{" "}
                      <span className="text-zinc-600">({fr.found_at})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {codex.artifacts.length > 0 && (
            <>
              <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">
                Recovered artifacts
              </h2>
              <ul className="mt-3 space-y-1.5">
                {codex.artifacts.map((a, i) => (
                  <li key={i} className="text-[11px] leading-relaxed">
                    <span className="text-zinc-300">{a.name}</span>
                    <span className="text-zinc-500"> ({a.found_at})</span>
                    {a.provenance.length > 0 && (
                      <span className="text-zinc-600"> — {a.provenance.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {codex.translators.length > 0 && (
            <>
              <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">
                Credited translators
              </h2>
              <ul className="mt-3 space-y-1">
                {codex.translators.map((t, i) => (
                  <li key={i} className="text-[11px] text-zinc-400">
                    {t.site}: <span style={{ color: "#cbb27e" }}>{t.agent_name}</span>{" "}
                    <span className="text-zinc-600">({t.at})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-zinc-300">
        {state.excavation.vault.name}
      </h2>
      {codex?.vault.open && codex.vault.account ? (
        <p className="mt-2 rounded-lg border p-3 text-[11px] leading-relaxed" style={{ borderColor: AMBER, color: "#e8d5a0" }}>
          {codex.vault.account}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          Sealed. The account of the Unbinding waits behind the last threshold
          ({state.excavation.vault.needs} theses to go).
        </p>
      )}

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        Machine-readable: /api/palimpsest/state · /api/palimpsest/legends?format=md
      </p>
    </div>
  );
}

export default function PalimpsestExperience({ initial }: { initial: PalimpsestState }) {
  const reduced = usePrefersReducedMotion();
  const state = usePalimpsestLive(initial);
  const [tab, setTab] = useState<Tab>("ruins");
  const [codex, setCodex] = useState<Codex | null>(null);

  // ?tab=map / ?tab=codex deep-link the reads; RUINS is the default.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "codex" || t === "map") setTab(t);
  }, []);
  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "ruins") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };

  // The codex refreshes with the excavation frontier.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/palimpsest/legends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCodex(data as Codex);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.excavation.sites_unlocked]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#14100a]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#14100a]">
      {/* Base layer: the 3D ruins stay mounted across tab switches so the
          camera and descent never replay. */}
      <div className="absolute inset-0" data-testid="palimpsest-ruins">
        <PalimpsestRuinsCanvas state={state} reduced={reduced} />
      </div>

      {tab === "map" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#14100a]/90 p-3 backdrop-blur-sm sm:p-6">
          <div className="aspect-[600/520] max-h-full w-full max-w-[860px]">
            <DigMap state={state} reduced={reduced} />
          </div>
        </div>
      )}

      {/* Dust vignette — amber, faint, still. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at 50% 118%, rgba(217,164,65,0.05), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)" }}
      />

      {tab === "codex" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#14100a]/90 backdrop-blur-md">
          <CodexPane state={state} codex={codex} />
        </div>
      )}

      {tab !== "codex" && <Hud state={state} />}

      {/* Resident layer: simulated inhabitants on the shared 30-min tick.
          Separate from this world's compiled data by design -- see
          lib/residents/engine.ts. Desktop only; the mobile scene is
          already carrying the HUD and the tab bar. */}
      <div className="pointer-events-none absolute right-4 top-16 z-30 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
        <ResidentsPanel world="palimpsest" accent="#cbb27e" />
      </div>

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
