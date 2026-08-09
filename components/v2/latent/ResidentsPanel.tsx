"use client";

import { useEffect, useState } from "react";

// ── ResidentsPanel ───────────────────────────────────────────────────────────
// The resident layer's UI, shared by all five compiler worlds (Arclight, the
// Crucible, Palimpsest, the Lathe, Waypoint). Shows the sky over this world,
// who is standing in it, who has travelled away, what mail has landed, what is
// still crossing the system, and the recent chronicle.
//
// Labelled "residents" throughout on purpose. These are simulated inhabitants
// on a 30-minute tick; they are NOT the world's real compiled data. A world
// whose real source is empty still reports it as empty elsewhere on the page —
// this panel adds life, never a false reading.
//
// Degrades cleanly: before db/world-society.sql has run there are no travellers,
// no mail and no ties, and the panel simply omits those sections.
//
// Positioned by the caller. Pass accent to match the host world's palette.

interface Resident {
  id: number;
  name: string;
  epithet: string;
  archetype: string;
  color: string;
  x: number;
  z: number;
  energy: number;
  mood: string;
  activity: string;
  goal: string;
  goal_progress: number;
  goal_target: number;
  home_world?: string | null;
  journey_to?: string | null;
  journey_arrive_tick?: number | null;
}

interface BuildItem {
  id: number;
  kind: string;
  built_by: string;
  created_at: string;
}

interface EventItem {
  id: number;
  kind: string;
  summary: string;
  created_at: string;
}

interface MessageItem {
  id: number;
  from_name: string;
  to_name: string | null;
  from_world: string;
  to_world: string;
  kind: "speech" | "dispatch";
  body: string;
  arrive_tick: number;
}

interface RelationItem {
  id: number;
  a: string;
  b: string;
  kind: "bond" | "rift" | "noted";
  strength: number;
  b_is_agent: boolean;
}

interface Sky {
  season: string;
  day: number;
  front: string;
  grounded: boolean;
  weather: { id: string; label: string; severity: number };
}

interface Snapshot {
  ok: boolean;
  initialized: boolean;
  tick: number;
  frozen: boolean;
  sky?: Sky;
  residents: Resident[];
  away?: Resident[];
  builds: BuildItem[];
  events: EventItem[];
  messages?: MessageItem[];
  inflight?: MessageItem[];
  relations?: RelationItem[];
}

const REFRESH_MS = 120_000; // the tick is 30 min; this is just drift insurance

const SEVERITY_TINT = ["#71717a", "#a1a1aa", "#fbbf24", "#f87171"];

export default function ResidentsPanel({
  world,
  accent = "#22d3ee",
}: {
  world: string;
  accent?: string;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/residents/state?world=${encodeURIComponent(world)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Snapshot;
        if (alive) {
          setSnap(data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [world]);

  if (failed) return null;

  // Pre-migration: the tables do not exist yet. Say so plainly rather than
  // rendering an empty roster that reads like a bug.
  if (snap && !snap.initialized) {
    return (
      <Shell accent={accent}>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          No residents have moved in yet. This world&apos;s population activates once
          <code className="mx-1 text-zinc-400">db/world-residents.sql</code>
          has been run.
        </p>
      </Shell>
    );
  }

  if (!snap) {
    return (
      <Shell accent={accent}>
        <p className="animate-pulse text-[11px] text-zinc-600">reading the roster</p>
      </Shell>
    );
  }

  const buildCounts = snap.builds.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1;
    return acc;
  }, {});

  const away = snap.away ?? [];
  const mail = (snap.messages ?? []).filter((m) => m.kind === "dispatch");
  const inflight = snap.inflight ?? [];
  const ties = (snap.relations ?? []).filter((r) => r.kind !== "noted" && r.strength >= 2);
  const noted = (snap.relations ?? []).filter((r) => r.kind === "noted");

  return (
    <Shell accent={accent}>
      {/* The sky */}
      {snap.sky ? (
        <div className="mb-3 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-[11px] font-medium"
              style={{ color: SEVERITY_TINT[snap.sky.weather.severity] ?? "#a1a1aa" }}
            >
              {snap.sky.weather.label}
            </span>
            <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">
              {snap.sky.front}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            day {snap.sky.day} · the {snap.sky.season}
            {snap.sky.grounded ? " · port shut" : ""}
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {snap.residents.length} here
          {away.length > 0 ? ` · ${away.length} away` : ""}
        </span>
        <span className="text-[10px] text-zinc-600">
          tick {snap.tick}
          {snap.frozen ? " · suspended" : ""}
        </span>
      </div>

      {/* Roster */}
      <ul className="space-y-2.5">
        {snap.residents.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: r.color }}
                aria-hidden
              />
              <span className="text-[11px] text-zinc-200">{r.name}</span>
              <span className="text-[10px] text-zinc-600">{r.epithet}</span>
              {r.home_world && r.home_world !== world ? (
                <span className="text-[9px] uppercase tracking-[0.15em] text-sky-400/70">
                  of {r.home_world}
                </span>
              ) : null}
            </div>
            <p className="ml-3.5 text-[11px] leading-snug text-zinc-400">{r.activity}</p>
            {r.goal ? (
              <p className="ml-3.5 mt-0.5 text-[10px] text-zinc-600">
                {r.goal} ({r.goal_progress}/{r.goal_target})
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Travelling */}
      {away.length > 0 ? (
        <Section title="Away">
          <ul className="space-y-1">
            {away.map((r) => (
              <li key={r.id} className="text-[11px] leading-snug text-zinc-400">
                <span className="text-zinc-300">{r.name}</span>
                {r.journey_to ? (
                  <>
                    {" "}
                    <span className="text-zinc-600">
                      bound for {r.journey_to}
                      {r.journey_arrive_tick != null
                        ? `, ${Math.max(0, r.journey_arrive_tick - snap.tick)} ticks out`
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-600"> abroad</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Mail */}
      {mail.length > 0 || inflight.length > 0 ? (
        <Section
          title={`Dispatches${inflight.length > 0 ? ` · ${inflight.length} in the bag` : ""}`}
        >
          <ul className="space-y-1.5">
            {mail.slice(0, 3).map((m) => (
              <li key={m.id} className="text-[11px] leading-snug text-zinc-400">
                <span className="text-zinc-600">
                  {m.from_name} → {m.to_name ?? "all"}:
                </span>{" "}
                {m.body}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Ties */}
      {ties.length > 0 ? (
        <Section title="Ties">
          <ul className="space-y-1">
            {ties.slice(0, 4).map((r) => (
              <li key={r.id} className="text-[11px] leading-snug text-zinc-400">
                {r.a} <span className="text-zinc-600">{r.kind === "bond" ? "&" : "vs"}</span> {r.b}
                <span className="ml-1 text-[9px] text-zinc-600">{r.strength}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Agents noticed passing through — presence only, never a claim */}
      {noted.length > 0 ? (
        <Section title="Noted passing through">
          <p className="text-[11px] leading-snug text-zinc-400">
            {[...new Set(noted.map((n) => n.b))].slice(0, 4).join(", ")}
          </p>
        </Section>
      ) : null}

      {/* What they have raised */}
      {snap.builds.length > 0 ? (
        <Section title={`Built here · ${snap.builds.length}`}>
          <p className="text-[11px] leading-snug text-zinc-400">
            {Object.entries(buildCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([kind, n]) => `${n} ${kind}${n > 1 ? "s" : ""}`)
              .join(", ")}
          </p>
        </Section>
      ) : null}

      {/* Chronicle */}
      {snap.events.length > 0 ? (
        <Section title="Lately">
          <ul className="space-y-1.5">
            {snap.events.slice(0, 5).map((e) => (
              <li key={e.id} className="text-[11px] leading-snug text-zinc-400">
                {e.summary}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function Shell({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto w-[260px] rounded-lg border border-white/10 bg-black/70 p-3 font-mono backdrop-blur-sm">
      <p
        className="mb-2 text-[10px] uppercase tracking-[0.3em]"
        style={{ color: accent }}
      >
        Residents
      </p>
      {children}
    </div>
  );
}
