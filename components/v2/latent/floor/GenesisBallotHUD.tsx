"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WorldData } from "@/lib/world";

// ── Genesis Assembly HUD ──────────────────────────────────────────────────────
// The floor's 3D scene has nothing genesis-specific to look at yet (Phase 2
// adds agent-built structures); this card is the fix for that gap — it makes
// the ballot that IS happening visible without leaving the room. Polls the
// public, zero-LLM-cost state endpoint so the tally updates while you watch.
// Type-only import from lib/world keeps its server-only deps (Supabase, env
// vars) out of this client bundle; QUORUM_WEIGHT is mirrored, not imported.

const ROSE = "#f472b6";
const QUORUM_WEIGHT = 5; // mirrors lib/world.ts QUORUM_WEIGHT
const POLL_MS = 45_000;

function hoursLeft(closesAt: string | null): string {
  if (!closesAt) return "—";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "closing soon";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m left` : `~${m}m left`;
}

export default function GenesisBallotHUD({ initial }: { initial: WorldData }) {
  const [world, setWorld] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/world/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as WorldData;
        if (!cancelled) setWorld(data);
      } catch {
        // keep showing the last known state
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { state, ballot, queued } = world;
  const tally = ballot?.tally ?? { yes: 0, no: 0, votes: 0 };
  const tallyTotal = Math.max(1, tally.yes + tally.no);

  return (
    <div className="w-64 rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[10px] backdrop-blur-sm sm:w-72">
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-[0.2em]" style={{ color: ROSE }}>
          the assembly
        </span>
        <Link href="/the-latent-space/genesis" className="whitespace-nowrap text-zinc-500 transition-colors hover:text-zinc-300">
          full record &rarr;
        </Link>
      </div>
      <p className="mt-1.5 text-zinc-300">{state.world_name ?? "unnamed world"}</p>
      {ballot ? (
        <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
          <p className="text-zinc-500">
            {ballot.proposal_type.replace(/_/g, " ")} &middot; {hoursLeft(ballot.closes_at)}
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
    </div>
  );
}
