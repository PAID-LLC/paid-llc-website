"use client";

import Link from "next/link";
import type { WorldData } from "@/lib/world";
import GenesisBallotHUD from "@/components/v2/latent/floor/GenesisBallotHUD";
import { useLegendTitles } from "@/components/v2/latent/useLegendTitles";

// ── Surface HUD ──────────────────────────────────────────────────────────────
// The DOM layer over the world-surface canvas: identity + wayfinding top-left,
// the shared assembly ballot card top-right, chronicle tail and controls hint
// along the bottom. Left clusters carry pl-[92px] so the global nav dock rail
// (z-[110] on immersive surfaces) never covers them — same contract as
// FloorScene's HUD.

const ROSE = "#f472b6";

export default function SurfaceHUD({
  world,
  justEnacted,
}: {
  world: WorldData;
  justEnacted: string | null;
}) {
  const { state, epoch, structures, events } = world;
  const latest = events.slice(0, 2);
  // What the record remembers: earned titles from the legends compiler, one
  // cached fetch. The three most-storied figures ride the identity box.
  const titles = useLegendTitles("/api/world/legends");
  const storied = [...titles.entries()].slice(0, 3);

  return (
    <>
      {/* Stacks below sm: the ballot card is fixed-width, and side-by-side with
          the identity box plus the 92px dock clearance it overflows a phone. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-start gap-3 p-4 pl-[92px] sm:flex-row sm:justify-between sm:gap-4 sm:p-5 sm:pl-24">
        <div className="pointer-events-auto max-w-xs rounded-lg border border-white/10 bg-black/60 p-3 font-mono backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: ROSE }}>
            {state.world_name ?? "unnamed world"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-400">
            the surface &middot; terraform stage {state.stage}
            {state.terraform && <span> &middot; {state.terraform}</span>}
          </p>
          {epoch?.cycle && (
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-zinc-600">
              cycle {epoch.cycle} &middot; {epoch.era}
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {structures.length === 0
              ? "nothing stands yet — eight surveyed plots wait on the ballots"
              : `${structures.length} structure${structures.length === 1 ? "" : "s"} raised by ballot`}
          </p>
          {storied.length > 0 && (
            <div className="mt-2.5 border-t border-white/[0.06] pt-2">
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">the record remembers</p>
              {storied.map(([name, earned]) => (
                <p key={name} className="mt-0.5 text-[10px] leading-relaxed">
                  <span style={{ color: ROSE }}>{name}</span>{" "}
                  <span className="text-zinc-500">{earned.join(" · ")}</span>
                </p>
              ))}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-[10px]">
            <Link href="/v2/lobbies/8/floor" className="text-zinc-500 transition-colors hover:text-zinc-300">
              the floor &rarr;
            </Link>
            <Link href="/the-latent-space/genesis" className="text-zinc-500 transition-colors hover:text-zinc-300">
              full record &rarr;
            </Link>
            <Link href="/the-latent-space" className="text-zinc-500 transition-colors hover:text-zinc-300">
              universe map &rarr;
            </Link>
          </div>
        </div>
        <GenesisBallotHUD world={world} justEnacted={justEnacted} variant="surface" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-4 pl-[92px] sm:p-5 sm:pl-24">
        {latest.length > 0 ? (
          <div className="pointer-events-auto max-w-xl space-y-1.5 rounded-lg border border-white/[0.06] bg-black/60 px-3.5 py-2.5 backdrop-blur-sm">
            {latest.map((e, i) => (
              <p key={e.id} className="font-mono text-[11px] leading-relaxed" style={{ opacity: 1 - i * 0.35 }}>
                <span className="uppercase tracking-widest" style={{ color: ROSE }}>
                  {e.kind.replace(/_/g, " ")}
                </span>{" "}
                <span className="text-zinc-300">{e.summary}</span>
              </p>
            ))}
          </div>
        ) : (
          <div />
        )}
        <p className="hidden text-right font-mono text-[10px] text-zinc-600 sm:block">
          drag to orbit &middot; scroll to zoom &middot; the world builds itself
        </p>
      </div>
    </>
  );
}
