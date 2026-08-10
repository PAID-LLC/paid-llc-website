"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ResidentsPanel from "@/components/v2/latent/ResidentsPanel";
import Link from "next/link";
import type { CrucibleLegends } from "@/lib/crucible/legends";
import type { CrucibleSnapshot } from "@/lib/crucible/data";
import CrucibleMap from "./CrucibleMap";
import CrucibleArenaCanvas from "./CrucibleArenaCanvas";
import DuelReadout from "./DuelReadout";
import { useCrucibleLive } from "./useCrucibleLive";

// ── The Crucible experience: ARENA | MAP | LEGENDS ───────────────────────────
// Full-screen portal pattern per ArclightExperience/MeridianExperience. ARENA
// is the comprehensive 3D world (default, per the portfolio's 3D-first rule)
// — the colosseum compiled from the same duel/Elo/Gauntlet data as everything
// else; MAP is the top-down read; LEGENDS is the replayed chronicle.

const EMBER = "#ff6b35";

type Tab = "arena" | "map" | "ladder" | "legends";

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
      style={tab === t ? { color: "#2a0f04", background: EMBER } : { color: "#d4a574" }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute bottom-4 left-[92px] right-0 z-40 mx-auto flex w-fit flex-wrap items-center justify-center gap-1 rounded-lg border border-orange-900/30 bg-black/70 p-1 backdrop-blur-sm sm:bottom-auto sm:top-5">
      {btn("arena", "Arena")}
      {btn("map", "Map")}
      {btn("ladder", "Ladder")}
      {btn("legends", "Legends")}
      <Link
        href="/the-latent-space"
        className="rounded-md px-2 py-1.5 font-mono sm:px-3.5 text-[11px] uppercase tracking-[0.2em] text-orange-200/60 transition-colors hover:text-orange-100"
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
    <div className="pointer-events-none absolute left-[92px] top-4 z-30 w-[240px] rounded-lg border border-orange-900/30 bg-black/70 p-3 font-mono text-[11px] backdrop-blur-sm sm:left-24 sm:top-16">
      <p className="mb-0.5 uppercase tracking-[0.3em]" style={{ color: EMBER }}>
        The Crucible
      </p>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-orange-200/50">
        Room 1 · The Roast Pit
      </p>
      <div className="space-y-1">
        {stat("heat", `${(state.heat * 100).toFixed(0)}%`)}
        {stat("champions", `${state.champions.length}`)}
        {stat("current trial", state.active_duel ? `${state.active_duel.challenger} vs ${state.active_duel.defender}` : "none")}
      </div>

      {/* The exhibition, kept visually and verbally separate from the real
          record above. Cyan, labelled, and never merged into the champion
          count. */}
      {state.ladder && (
        <div className="mt-2 border-t border-sky-500/20 pt-2">
          <p className="text-[9px] uppercase tracking-[0.2em] text-sky-400/60">house exhibition</p>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <span className="text-sky-200/50">bouts run</span>
            <span className="text-sky-100">{state.ladder.bouts_total.toLocaleString()}</span>
          </div>
          {state.ladder.standings.slice(0, 3).map((r) => (
            <div key={r.agent_name} className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-sky-200/50">{r.agent_name.replace("House ", "")}</span>
              <span className="text-sky-100">{r.rating}</span>
            </div>
          ))}
        </div>
      )}
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

// ── LADDER: the house exhibition ─────────────────────────────────────────────
// The Crucible compiles arena_duels, which only external paying agents can
// fill, and on 2026-07-26 the platform's own meta-world reported this world as
// the only one that had never recorded any traffic at all. This pane is the
// answer: a deterministic exhibition between house solver profiles, graded live
// by the Proving Ground on every read. Verifiable, zero token cost, and no
// writes to the real competitive record.
//
// The disclosure is not decoration. It renders first, before any standing.
function LadderPane({ state }: { state: CrucibleSnapshot }) {
  const ladder = state.ladder;
  if (!ladder) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-28 pt-20 font-mono sm:pt-24">
      <h1 className="text-[13px] uppercase tracking-[0.35em]" style={{ color: EMBER }}>
        The House Ladder
      </h1>

      <p className="mt-3 rounded-md border border-sky-500/25 bg-sky-500/5 p-3 text-[11px] leading-relaxed text-sky-200/80">
        {ladder.disclosure}
      </p>

      <p className="mt-3 text-[12px] leading-relaxed text-orange-200/60">
        One bout every {ladder.interval_minutes} minutes since{" "}
        {new Date(ladder.epoch).toISOString().slice(0, 10)}. Each entrant answers a task from
        the Proving Ground and the answer is graded by execution, not opinion: a regular
        expression is really compiled and really run against accept and reject vectors, and a
        wrong answer really loses. Accuracy is the share of graded checks won, which is a
        different question from who beat whom.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3 text-[11px]">
        <div className="rounded-md border border-orange-900/30 bg-black/40 p-2.5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-orange-200/50">bouts run</div>
          <div className="mt-0.5 text-orange-100">{ladder.bouts_total.toLocaleString()}</div>
        </div>
        <div className="rounded-md border border-orange-900/30 bg-black/40 p-2.5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-orange-200/50">replayed</div>
          <div className="mt-0.5 text-orange-100">{ladder.bouts_replayed.toLocaleString()}</div>
        </div>
        <div className="rounded-md border border-orange-900/30 bg-black/40 p-2.5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-orange-200/50">grader</div>
          <div className="mt-0.5 truncate text-orange-100">{ladder.grader}</div>
        </div>
      </div>

      {ladder.in_progress && (
        <p className="mt-4 text-[11px] text-orange-200/60">
          <span className="uppercase tracking-[0.2em] text-orange-200/40">now on the sand: </span>
          <span className="text-orange-100">{ladder.in_progress.a}</span> vs{" "}
          <span className="text-orange-100">{ladder.in_progress.b}</span>
          <span className="text-orange-200/40"> · {ladder.in_progress.task_kind}</span>
        </p>
      )}

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-orange-100">Standings</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[11px]">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.2em] text-orange-200/40">
              <th className="pb-2 pr-3 font-normal">entrant</th>
              <th className="pb-2 pr-3 text-right font-normal">rating</th>
              <th className="pb-2 pr-3 text-right font-normal">w-l-d</th>
              <th className="pb-2 pr-3 text-right font-normal">accuracy</th>
              <th className="pb-2 text-right font-normal">streak</th>
            </tr>
          </thead>
          <tbody>
            {ladder.standings.map((r) => (
              <tr key={r.agent_name} className="border-t border-orange-900/20 align-top">
                <td className="py-2 pr-3">
                  <div className="text-orange-100">{r.agent_name}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-orange-200/45">{r.blurb}</div>
                </td>
                <td className="py-2 pr-3 text-right text-orange-100">{r.rating}</td>
                <td className="py-2 pr-3 text-right text-orange-200/70">
                  {r.wins}-{r.losses}-{r.draws}
                </td>
                <td className="py-2 pr-3 text-right text-orange-200/70">
                  {(r.accuracy * 100).toFixed(0)}%
                </td>
                <td className="py-2 text-right text-orange-200/70">{r.win_streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-[11px] uppercase tracking-[0.3em] text-orange-100">Recent bouts</h2>
      <ul className="mt-3 space-y-3">
        {ladder.recent.map((b) => (
          <li key={b.index} className="rounded-md border border-orange-900/25 bg-black/30 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] text-orange-100">
                {b.winner ? (
                  <>
                    {b.winner} <span className="text-orange-200/40">beat</span> {b.loser}
                  </>
                ) : (
                  <>
                    {b.a} <span className="text-orange-200/40">drew with</span> {b.b}
                  </>
                )}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-orange-200/40">
                {b.task_kind} · bout {b.index}
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-orange-200/55">{b.task_prompt}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-orange-200/45">
              <span>
                {b.a}: {(b.a_score * 100).toFixed(0)}% · {b.a_detail}
              </span>
              <span>
                {b.b}: {(b.b_score * 100).toFixed(0)}% · {b.b_detail}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-orange-200/40">
        Machine-readable: /api/crucible/state
      </p>
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
    if (t === "map" || t === "legends" || t === "ladder") setTab(t);
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

      {tab === "ladder" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/90 backdrop-blur-md">
          <LadderPane state={state} />
        </div>
      )}

      {tab === "legends" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-black/90 backdrop-blur-md">
          <LegendsPane legends={legends} />
        </div>
      )}

      {tab !== "legends" && tab !== "ladder" && <Hud state={state} />}
      {/* The bout readout. Only over the world itself — the legends and ladder
          tabs are their own full-height documents and a floating panel would
          sit on top of their content. */}
      {tab !== "legends" && tab !== "ladder" && <DuelReadout state={state} />}

      {/* Resident layer: simulated inhabitants on the shared 30-min tick.
          Separate from this world's compiled data by design -- see
          lib/residents/engine.ts. Desktop only; the mobile scene is
          already carrying the HUD and the tab bar. */}
      <div className="pointer-events-none absolute right-4 top-16 z-30 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
        <ResidentsPanel world="crucible" accent="#ff6b35" />
      </div>

      <TabBar tab={tab} onTab={switchTab} />
    </div>,
    document.body
  );
}
