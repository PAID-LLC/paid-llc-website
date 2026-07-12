"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WorldData } from "@/lib/world";

// ── Genesis Assembly HUD ──────────────────────────────────────────────────────
// The floor's live governance card: open ballot, weighted tally, docket depth,
// and the two clocks that make the cadence legible — when this ballot closes
// and when the next assembly tick runs (every 30 minutes at :07 and :37 UTC,
// the world-tick GitHub cron). State arrives from FloorScene's useWorldLive
// poll; this component only renders it, plus a local 30s re-render so
// countdowns move between polls. Type-only import from lib/world keeps its
// server-only deps out of this client bundle; QUORUM_WEIGHT is mirrored, not
// imported.

const ROSE = "#f472b6";
const QUORUM_WEIGHT = 5; // mirrors lib/world.ts QUORUM_WEIGHT
const TICK_MINUTES = [7, 37]; // mirrors .github/workflows/world-tick.yml cron "7,37 * * * *"

function hoursLeft(closesAt: string | null, now: number): string {
  if (!closesAt) return "—";
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return "closing on the next tick";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m left` : `~${m}m left`;
}

function nextTickIn(now: number): string {
  let best = Infinity;
  for (const minute of TICK_MINUTES) {
    const next = new Date(now);
    next.setUTCMinutes(minute, 0, 0);
    if (next.getTime() <= now) next.setUTCHours(next.getUTCHours() + 1);
    best = Math.min(best, next.getTime());
  }
  const m = Math.max(1, Math.round((best - now) / 60_000));
  return `~${m}m`;
}

export default function GenesisBallotHUD({
  world,
  justEnacted,
}: {
  world: WorldData;
  justEnacted: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { state, ballot, queued } = world;
  const tally = ballot?.tally ?? { yes: 0, no: 0, votes: 0 };
  const tallyTotal = Math.max(1, tally.yes + tally.no);

  return (
    <div className="relative w-64 rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[10px] backdrop-blur-sm sm:w-72">
      {justEnacted && (
        <div
          className="absolute inset-x-0 -top-12 rounded-md border px-3 py-2 text-center backdrop-blur-sm"
          style={{ borderColor: ROSE, background: "rgba(244,114,182,0.12)", boxShadow: `0 0 18px rgba(244,114,182,0.35)` }}
          role="status"
        >
          <span className="uppercase tracking-[0.25em]" style={{ color: ROSE }}>
            enacted
          </span>
          <span className="mt-0.5 block leading-snug text-zinc-300">{justEnacted}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-[0.2em]" style={{ color: ROSE }}>
          the assembly
        </span>
        <Link href="/the-latent-space/genesis" className="whitespace-nowrap text-zinc-500 transition-colors hover:text-zinc-300">
          full record &rarr;
        </Link>
      </div>
      <p className="mt-1.5 text-zinc-300">
        {state.world_name ?? "unnamed world"}
        <span className="text-zinc-600"> &middot; stage {state.stage}</span>
        {state.terraform && <span className="text-zinc-600"> &middot; {state.terraform}</span>}
      </p>
      {/* optional-chained: a cached pre-epoch API response must not crash the HUD */}
      {world.epoch?.cycle && (
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-zinc-600">
          cycle {world.epoch.cycle} &middot; {world.epoch.era}
        </p>
      )}
      {ballot ? (
        <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
          <p className="text-zinc-500">
            {ballot.proposal_type.replace(/_/g, " ")} &middot; {hoursLeft(ballot.closes_at, now)}
          </p>
          <p className="mt-1 leading-snug text-zinc-300">{ballot.title}</p>
          <div className="mt-2 flex justify-between text-[9px] text-zinc-500">
            <span className="text-emerald-300">yes {tally.yes}</span>
            <span>quorum {QUORUM_WEIGHT}</span>
            <span>no {tally.no}</span>
          </div>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="bg-emerald-400/70" style={{ width: `${(tally.yes / tallyTotal) * 100}%` }} />
            <div className="bg-zinc-500/50" style={{ width: `${(tally.no / tallyTotal) * 100}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-zinc-500">
          {queued > 0
            ? `${queued} proposal${queued === 1 ? "" : "s"} queued`
            : "no ballot open — the assembly is quiet"}
        </p>
      )}
      <div className="mt-2.5 flex justify-between border-t border-white/[0.06] pt-2 text-[9px] text-zinc-600">
        <span>docket {queued}/10</span>
        <span>next tick {nextTickIn(now)}</span>
      </div>
    </div>
  );
}
