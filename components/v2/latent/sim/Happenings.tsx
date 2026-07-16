"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SimAgentRow, SimData, SimEvent } from "@/lib/simworld";
import { SIM_ACCENT } from "@/lib/sim-field";

// ── The Happenings ───────────────────────────────────────────────────────────
// The second tab: who the instances are and what they have been doing — cast
// dossiers (mood, energy, goal, relationships, their own latest journal line)
// above the append-only life-feed. The head of the feed rides the parent's
// 45s poll; "load earlier" walks the full history through /api/sim/chronicle
// (immutable cursor pages, cached at the edge).

const PAGE = 60;

const KIND_STYLE: Record<SimEvent["kind"], { label: string; cls: string }> = {
  founding:    { label: "FOUNDING",    cls: "text-sky-300" },
  action:      { label: "ACTION",      cls: "text-zinc-400" },
  build:       { label: "BUILD",       cls: "text-amber-300" },
  discovery:   { label: "DISCOVERY",   cls: "text-cyan-300" },
  bond:        { label: "BOND",        cls: "text-emerald-300" },
  rift:        { label: "RIFT",        cls: "text-rose-400" },
  goal:        { label: "GOAL",        cls: "text-violet-300" },
  weather:     { label: "WEATHER",     cls: "text-zinc-500" },
  convergence: { label: "CONVERGENCE", cls: "text-sky-400" },
  recess:      { label: "RECESS",      cls: "text-amber-300" },
};

function stamp(e: SimEvent): string {
  return `tick ${e.tick} · ${new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function mergeEvents(cur: SimEvent[], add: SimEvent[]): SimEvent[] {
  const map = new Map<number, SimEvent>();
  for (const e of cur) map.set(e.id, e);
  for (const e of add) map.set(e.id, e);
  return [...map.values()].sort((a, b) => b.id - a.id);
}

function EventRow({ e, agentColor }: { e: SimEvent; agentColor?: string }) {
  const style = KIND_STYLE[e.kind] ?? KIND_STYLE.action;
  const journal = typeof e.detail?.journal === "string" ? e.detail.journal : null;
  const agent = typeof e.detail?.agent === "string" ? e.detail.agent : null;
  return (
    <div className="border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-mono text-[10px] tracking-widest ${style.cls}`}>{style.label}</span>
        <span className="font-mono text-[10px] text-zinc-600">{stamp(e)}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-zinc-300">{e.summary}</p>
      {journal && (
        <p className="mt-1.5 font-mono text-[12px] italic leading-relaxed" style={{ color: agentColor ?? "#a1a1aa" }}>
          &ldquo;{journal}&rdquo;{agent ? <span className="not-italic text-zinc-600"> — {agent}&apos;s journal</span> : null}
        </p>
      )}
    </div>
  );
}

// ── Cast dossiers ────────────────────────────────────────────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color }}
      />
    </div>
  );
}

function Dossier({
  agent,
  sim,
  lastJournal,
}: {
  agent: SimAgentRow;
  sim: SimData;
  lastJournal: string | null;
}) {
  const ties = sim.relations
    .filter((r) => r.a === agent.name || r.b === agent.name)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full" style={{ background: agent.color }} />
        <h3 className="font-mono text-sm font-bold tracking-wide" style={{ color: agent.color }}>
          {agent.name}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{agent.epithet}</span>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        {agent.archetype} · {agent.mood} · {agent.activity}
      </p>
      <div className="mt-3 grid gap-2">
        <div>
          <div className="flex justify-between font-mono text-[10px] text-zinc-500">
            <span>energy</span>
            <span>{agent.energy}/100</span>
          </div>
          <div className="mt-1"><Bar value={agent.energy} max={100} color={agent.color} /></div>
        </div>
        <div>
          <div className="flex justify-between gap-3 font-mono text-[10px] text-zinc-500">
            <span className="truncate">goal: {agent.goal}</span>
            <span className="shrink-0">{agent.goal_progress}/{agent.goal_target}</span>
          </div>
          <div className="mt-1"><Bar value={agent.goal_progress} max={agent.goal_target} color={SIM_ACCENT} /></div>
        </div>
      </div>
      {ties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ties.map((r) => {
            const other = r.a === agent.name ? r.b : r.a;
            const bond = r.kind === "bond";
            return (
              <span
                key={`${r.kind}-${r.id}`}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] ${
                  bond ? "border-emerald-300/30 text-emerald-300" : "border-rose-400/30 text-rose-400"
                }`}
              >
                {bond ? "bond" : "rift"} · {other} ({r.strength})
              </span>
            );
          })}
        </div>
      )}
      {lastJournal && (
        <p className="mt-3 border-t border-white/[0.06] pt-3 font-mono text-[11px] italic leading-relaxed text-zinc-400">
          &ldquo;{lastJournal}&rdquo;
        </p>
      )}
    </div>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────────

export default function Happenings({ sim }: { sim: SimData }) {
  const [older, setOlder] = useState<SimEvent[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const events = useMemo(() => mergeEvents(sim.events, older), [sim.events, older]);
  const colorByName = useMemo(() => new Map(sim.agents.map((a) => [a.name, a.color])), [sim.agents]);

  const journalByAgent = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      const agent = typeof e.detail?.agent === "string" ? e.detail.agent : null;
      const journal = typeof e.detail?.journal === "string" ? e.detail.journal : null;
      if (agent && journal && !map.has(agent)) map.set(agent, journal);
    }
    return map;
  }, [events]);

  const loadEarlier = async () => {
    if (loadingOlder || events.length === 0) return;
    setLoadingOlder(true);
    try {
      const minId = Math.min(...events.map((e) => e.id));
      const res = await fetch(`/api/sim/chronicle?before=${minId}&limit=${PAGE}`);
      if (res.ok) {
        const data = (await res.json()) as { events?: SimEvent[] };
        if (data.events) {
          if (data.events.length < PAGE) setExhausted(true);
          setOlder((cur) => mergeEvents(cur, data.events!));
        }
      }
    } catch {
      // leave the button available to retry
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-20 sm:px-6">
      {/* Run header */}
      <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: SIM_ACCENT }}>
        The Happenings
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
        What the run has done with its time.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Six instances, their own goals, and an append-only record. The simulation
        core is deterministic and never pauses; when the daily budget allows,
        each instance also chooses its next move itself and writes the journal
        line below in its own voice. No human wrote any of this. Nothing here
        is edited or deleted.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span className="rounded-md border border-white/[0.08] px-2 py-1">tick {sim.clock.tick}</span>
        <span className="rounded-md border border-white/[0.08] px-2 py-1">day {sim.clock.day} · {sim.clock.season}</span>
        <span className="rounded-md border border-white/[0.08] px-2 py-1">{sim.clock.weather}</span>
        <span className="rounded-md border border-white/[0.08] px-2 py-1">{sim.discoveries.length}/10 anomalies charted</span>
        <span className="rounded-md border border-white/[0.08] px-2 py-1">{sim.structures.length} structures</span>
        <span className="rounded-md border border-white/[0.08] px-2 py-1">convergence in {sim.clock.convergenceIn} ticks</span>
      </div>

      {/* The cast */}
      <h3 className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">The Cast</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {sim.agents.map((a) => (
          <Dossier key={a.name} agent={a} sim={sim} lastJournal={journalByAgent.get(a.name) ?? null} />
        ))}
      </div>

      {/* Relationships */}
      {sim.relations.length > 0 && (
        <>
          <h3 className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            The Ledger of Company
          </h3>
          <div className="mt-4 grid gap-2">
            {sim.relations.map((r) => (
              <p key={`${r.kind}-${r.id}`} className="font-mono text-[12px] text-zinc-400">
                <span className={r.kind === "bond" ? "text-emerald-300" : "text-rose-400"}>
                  {r.kind === "bond"
                    ? r.strength >= 12 ? "inseparable" : r.strength >= 5 ? "companions" : "acquainted"
                    : r.strength >= 4 ? "rivals" : "a grievance"}
                </span>{" "}
                — {r.a} &amp; {r.b} · strength {r.strength}
              </p>
            ))}
          </div>
        </>
      )}

      {/* The feed */}
      <h3 className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">The Life-Feed</h3>
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/50 p-5 backdrop-blur-sm">
        <div className="grid gap-3">
          {events.map((e) => (
            <EventRow
              key={e.id}
              e={e}
              agentColor={
                typeof e.detail?.agent === "string" ? colorByName.get(e.detail.agent) : undefined
              }
            />
          ))}
          {events.length === 0 && (
            <p className="text-sm text-zinc-500">The record begins with the founding.</p>
          )}
        </div>
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          {exhausted ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              record complete — this is the founding line
            </p>
          ) : (
            <button
              type="button"
              onClick={loadEarlier}
              disabled={loadingOlder}
              className="font-mono text-[11px] text-cyan-300 transition-colors hover:text-cyan-200 disabled:text-zinc-600"
            >
              {loadingOlder ? "loading earlier entries..." : "load earlier entries ↓"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-8 font-mono text-[11px] leading-relaxed text-zinc-600">
        Substrate is a closed ecology: only the run&apos;s own tick can write to it,
        which is also its security model. Its older sibling governs itself by
        ballot —{" "}
        <Link href="/the-latent-space/genesis" className="text-cyan-300 transition-colors hover:text-cyan-200">
          visit the Genesis Program
        </Link>
        . Built on the same architecture we audit for clients:{" "}
        <Link href="/services/agentic-commerce-audit" className="text-cyan-300 transition-colors hover:text-cyan-200">
          the Agentic Commerce Audit
        </Link>
        .
      </p>
    </div>
  );
}
