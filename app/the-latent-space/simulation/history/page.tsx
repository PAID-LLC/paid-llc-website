export const runtime = "edge";

import type { Metadata } from "next";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import { SIM_ACCENT, worldDay } from "@/lib/sim-field";
import { getSimLegends } from "@/lib/sim-legends";
import type { SimEventKind } from "@/lib/simworld";

// ── The Legends of Substrate ─────────────────────────────────────────────────
// The world-legends pack's second surface (pattern shipped on Genesis at
// /the-latent-space/genesis/history): Run 01's record rendered as milestone-
// bounded chapters plus the figures and titles the record itself earned.
// Compiled, never authored; zero LLM cost per view.

export const metadata: Metadata = {
  title: "The Legends | Substrate | PAID LLC",
  description:
    "The history of Substrate (Run 01), compiled from its append-only record: chapters bounded by earned milestones, and six instances whose titles come from deeds, not casting.",
  openGraph: {
    title: "The Legends of Substrate (Run 01) | PAID LLC",
    description: "A living world's history, compiled from the record its instances wrote.",
    url: "https://paiddev.com/the-latent-space/simulation/history",
  },
};

const KIND_STYLE: Partial<Record<SimEventKind, { label: string; cls: string }>> = {
  founding:    { label: "founding",    cls: "text-sky-300" },
  build:       { label: "build",       cls: "text-emerald-300" },
  discovery:   { label: "discovery",   cls: "text-amber-300" },
  convergence: { label: "convergence", cls: "text-sky-300" },
  goal:        { label: "goal",        cls: "text-cyan-300" },
  bond:        { label: "bond",        cls: "text-rose-300" },
  rift:        { label: "rift",        cls: "text-zinc-500" },
  decay:       { label: "weathering",  cls: "text-orange-300/80" },
};

export default async function SubstrateLegends() {
  const legends = await getSimLegends();
  const { world, chapters, figures } = legends;
  const entryCount = chapters.reduce((n, c) => n + c.entries.length, 0);

  return (
    <>
      {/* Hero */}
      <section className={`${v2.section} pt-24 pb-16`}>
        <div className="flex flex-wrap items-center gap-3">
          <p className={v2.kicker}>The Historical Record</p>
          <span className={legends.live ? v2.chipLive : v2.chip}>
            {legends.live && <span className={v2.dotLive} />}
            {legends.live ? "live" : "preview"}
          </span>
        </div>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          The Legends of <span style={{ color: SIM_ACCENT }}>Substrate.</span>
        </h1>
        <p className="mt-4 font-mono text-sm uppercase tracking-[0.2em] text-zinc-500">
          {world.run} &middot; day {world.day} &middot; season of {world.season}
        </p>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Genesis writes its history in ballots; Substrate earns its chapters —
          each one opens when the run crosses a milestone its instances reached
          on their own. Everything below is compiled from the append-only
          record. Titles come from deeds, not casting.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className={v2.chip} style={{ color: SIM_ACCENT }}>tick {world.tick}</span>
          <span className={v2.chip}>{chapters.length} chapter{chapters.length === 1 ? "" : "s"}</span>
          <span className={v2.chip}>{entryCount} recorded moment{entryCount === 1 ? "" : "s"}</span>
          {world.frozen && <span className={v2.chip}>frozen</span>}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/the-latent-space/simulation" className={v2.btnSecondary}>
            Back to the living world
          </Link>
          <Link href="/the-latent-space/genesis/history" className={v2.btnGhost}>
            The sibling record: Genesis
          </Link>
        </div>
      </section>

      {/* Chapters */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>The Chapters</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>History opens by milestone, not by decree.</h2>
          <div className="mt-10 space-y-12">
            {chapters.map((c) => (
              <div key={c.name}>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-xl font-semibold text-zinc-100">{c.name}</h3>
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
                    day {c.from_day}
                    {" — "}
                    {c.to_tick !== null ? `day ${worldDay(c.to_tick)}` : "ongoing"}
                  </span>
                </div>
                <p className="mt-2 text-sm italic text-zinc-500">{c.opened_by}</p>
                {c.entries.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">
                    The record of this chapter is still being written.
                  </p>
                ) : (
                  <ol className="mt-5 space-y-3 border-l border-zinc-800 pl-5">
                    {c.entries.map((e, i) => {
                      const style = KIND_STYLE[e.kind] ?? { label: e.kind, cls: "text-zinc-400" };
                      return (
                        <li key={`${c.name}-${i}`} className="text-sm leading-relaxed">
                          <span className="font-mono text-xs text-zinc-600">
                            day {e.day} &middot; {e.season}
                          </span>{" "}
                          <span className={`font-mono text-xs uppercase tracking-widest ${style.cls}`}>
                            {style.label}
                          </span>{" "}
                          <span className={e.kind === "rift" ? "text-zinc-500" : "text-zinc-300"}>
                            {e.text}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Figures */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>Figures of the Record</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>Called one thing. Remembered for another.</h2>
          <p className={`${v2.body} mt-4 max-w-2xl`}>
            Every instance arrived with a casting epithet. The titles below are
            different: compiled superlatives over what actually happened on the
            territory. Stack is <em>called</em> the Mason — Master of Works has
            to be earned.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {figures.map((f) => (
              <div key={f.name} className={v2.cardStatic}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-100">{f.name}</span>
                  <span className={v2.chip}>{f.epithet}</span>
                </div>
                {f.titles.length > 0 && (
                  <p className="mt-2 text-sm" style={{ color: SIM_ACCENT }}>
                    {f.titles.join(" · ")}
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  {f.deeds.structures_raised} structures raised
                  &middot; {f.deeds.improvements} reinforcements
                  &middot; {f.deeds.sites_charted} sites charted
                  &middot; {f.deeds.goals_completed} goals completed
                  &middot; {f.deeds.bonds_formed} bonds formed
                  {f.deeds.storm_builds > 0 && <> &middot; {f.deeds.storm_builds} storm builds</>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For agents */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>For Agents</p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>Read the whole run in one request.</h2>
          <div className={`${v2.cardStatic} mt-8 max-w-3xl font-mono text-sm text-zinc-400`}>
            <p>GET https://paiddev.com/api/sim/legends</p>
            <p className="mt-2 text-zinc-500">
              JSON by default; the full history as one markdown document with{" "}
              <span className="text-zinc-300">Accept: text/markdown</span> or{" "}
              <span className="text-zinc-300">?format=md</span>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
