"use client";

import Link from "next/link";
import type { SimData, SimEvent } from "@/lib/simworld";
import { SIM_ACCENT } from "@/lib/sim-field";

// ── Surface HUD ──────────────────────────────────────────────────────────────
// The DOM layer over the territory canvas: run identity + wayfinding top-left,
// the arrival banner top-right, life-feed tail along the bottom. Left clusters
// carry pl-[92px] so the global nav dock rail (z-[110] on immersive surfaces)
// never covers them — same contract as SurfaceHUD/FloorScene.

const BANNER_LABEL: Partial<Record<SimEvent["kind"], string>> = {
  discovery: "DISCOVERY",
  goal: "GOAL COMPLETE",
  bond: "BOND",
  rift: "RIFT",
  convergence: "CONVERGENCE",
};

export default function SimHUD({
  sim,
  justHappened,
}: {
  sim: SimData;
  justHappened: SimEvent | null;
}) {
  const { clock } = sim;
  const latest = sim.events.slice(0, 2);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-start gap-3 p-4 pl-[92px] sm:flex-row sm:justify-between sm:gap-4 sm:p-5 sm:pl-24">
        <div className="pointer-events-auto max-w-xs rounded-lg border border-white/10 bg-black/60 p-3 font-mono backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: SIM_ACCENT }}>
              Substrate · Run 01
            </p>
            {!sim.live && (
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-zinc-500">
                preview
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">
            tick {clock.tick} &middot; day {clock.day} &middot; {clock.season} &middot; {clock.weather}
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {sim.agents.length} instances &middot; {sim.discoveries.length}/10 anomalies &middot;{" "}
            {sim.structures.length} structure{sim.structures.length === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-zinc-600">
            convergence in {clock.convergenceIn} tick{clock.convergenceIn === 1 ? "" : "s"}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-[10px]">
            <Link href="/v2/lobbies/5/floor" className="text-zinc-500 transition-colors hover:text-zinc-300">
              the sandbox floor &rarr;
            </Link>
            <Link href="/the-latent-space/genesis" className="text-zinc-500 transition-colors hover:text-zinc-300">
              genesis &rarr;
            </Link>
            <Link href="/the-latent-space" className="text-zinc-500 transition-colors hover:text-zinc-300">
              universe map &rarr;
            </Link>
          </div>
        </div>

        {justHappened && (
          <div className="pointer-events-auto max-w-sm rounded-lg border bg-black/70 p-3 font-mono backdrop-blur-sm" style={{ borderColor: `${SIM_ACCENT}55` }}>
            <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: SIM_ACCENT }}>
              {BANNER_LABEL[justHappened.kind] ?? "HAPPENING"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-200">{justHappened.summary}</p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-4 pb-16 pl-[92px] sm:p-5 sm:pb-5 sm:pl-24">
        {latest.length > 0 ? (
          <div className="pointer-events-auto max-w-xl space-y-1.5 rounded-lg border border-white/[0.06] bg-black/60 px-3.5 py-2.5 backdrop-blur-sm">
            {latest.map((e, i) => (
              <p key={e.id} className="font-mono text-[11px] leading-relaxed" style={{ opacity: 1 - i * 0.35 }}>
                <span className="uppercase tracking-widest" style={{ color: SIM_ACCENT }}>
                  {e.kind}
                </span>{" "}
                <span className="text-zinc-300">{e.summary}</span>
              </p>
            ))}
          </div>
        ) : (
          <div />
        )}
        <p className="hidden text-right font-mono text-[10px] text-zinc-600 sm:block">
          drag to orbit &middot; scroll to zoom &middot; the run does not pause
        </p>
      </div>
    </>
  );
}
