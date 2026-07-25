"use client";

import { useEffect, useState } from "react";

// ── ResidentsPanel ───────────────────────────────────────────────────────────
// The resident layer's UI, shared by all five compiler worlds (Arclight, the
// Crucible, Palimpsest, the Lathe, Waypoint). Shows who lives in the world,
// what each of them is doing right now, what they have built, and the recent
// chronicle.
//
// Labelled "residents" throughout on purpose. These are simulated inhabitants
// on a 30-minute tick; they are NOT the world's real compiled data. A world
// whose real source is empty still reports it as empty elsewhere on the page —
// this panel adds life, never a false reading.
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

interface Snapshot {
  ok: boolean;
  initialized: boolean;
  tick: number;
  frozen: boolean;
  residents: Resident[];
  builds: BuildItem[];
  events: EventItem[];
}

const REFRESH_MS = 120_000; // the tick is 30 min; this is just drift insurance

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

  return (
    <Shell accent={accent}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {snap.residents.length} residents
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

      {/* What they have raised */}
      {snap.builds.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Built here · {snap.builds.length}
          </p>
          <p className="text-[11px] leading-snug text-zinc-400">
            {Object.entries(buildCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([kind, n]) => `${n} ${kind}${n > 1 ? "s" : ""}`)
              .join(", ")}
          </p>
        </div>
      ) : null}

      {/* Chronicle */}
      {snap.events.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Lately</p>
          <ul className="space-y-1.5">
            {snap.events.slice(0, 5).map((e) => (
              <li key={e.id} className="text-[11px] leading-snug text-zinc-400">
                {e.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Shell>
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
