// ── The Legends of Meridian ───────────────────────────────────────────────────
// Legends pack pattern (lib/world-legends.ts, lib/sim-legends.ts) applied to
// the human colony. Chapters are bounded by ACT TRANSITIONS instead of build
// milestones — the city's own market history is the timeline. Titles are
// compiled superlatives over stake history, deliberately distinct from the
// cast's assigned archetypes. Pure read-side: zero LLM cost, zero new writes.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { MERIDIAN_CAST, type Act, type MeridianEvent, type MeridianEventKind } from "@/lib/meridian/engine";

export interface MeridianLegendsEntry {
  tick: number;
  kind: MeridianEventKind;
  text: string;
}

export interface MeridianChapter {
  name: string;
  opened_by: string;
  from_tick: number;
  to_tick: number | null; // null = the current chapter
  entries: MeridianLegendsEntry[];
}

export interface MeridianLegendsFigure {
  name: string;
  epithet: string;
  titles: string[];
  peak_stake: number;
  trough_stake: number;
  crossings: number;
}

export interface MeridianLegends {
  live: boolean;
  world: { tick: number; act: Act; prosperity_index: number };
  chapters: MeridianChapter[];
  figures: MeridianLegendsFigure[];
}

/** Everything the compiler needs, as plain rows — pure and unit-testable. */
export interface MeridianLegendsInput {
  tick: number;
  act: Act;
  prosperityIndex: number;
  citizens: { name: string; epithet: string; peak_stake: number; trough_stake: number }[];
  /** ascending by id */
  events: MeridianEvent[];
}

// ── Chapters: bounded by the city's own act transitions ──────────────────────

interface Boundary { tick: number; name: string; opened_by: string }

const CHAPTER_NAME: Record<Act, string> = {
  boom: "the First Boom",
  stable: "the Even Keel",
  correction: "the First Correction",
  bust: "the First Bust",
};

function chapterBoundaries(input: MeridianLegendsInput): Boundary[] {
  const boundaries: Boundary[] = [
    { tick: 0, name: "the Founding", opened_by: "Six citizens take up their wards around the Agora." },
  ];
  const seen = new Set<Act>();
  const changes = [...input.events]
    .filter((e) => e.kind === "act_change")
    .sort((a, b) => a.tick - b.tick || a.id - b.id);
  for (const e of changes) {
    const to = e.detail.to as Act | undefined;
    if (!to || seen.has(to)) continue;
    seen.add(to);
    boundaries.push({ tick: e.tick, name: CHAPTER_NAME[to], opened_by: e.summary });
  }
  boundaries.sort((a, b) => a.tick - b.tick);
  const kept: Boundary[] = [];
  for (const b of boundaries) {
    const prev = kept[kept.length - 1];
    if (prev && prev.tick === b.tick) kept[kept.length - 1] = b.tick === 0 ? prev : b;
    else kept.push(b);
  }
  return kept;
}

// ── Figures and earned titles ─────────────────────────────────────────────────

function compileFigures(input: MeridianLegendsInput): MeridianLegendsFigure[] {
  const crossingCounts = new Map<string, number>();
  const swings: { name: string; swing: number; tick: number }[] = [];
  let firstProsperTick: number | null = null;
  let firstProsperName: string | null = null;

  for (const e of input.events) {
    if (e.kind === "rags_to_riches" || e.kind === "riches_to_rags") {
      const name = e.detail.citizen as string | undefined;
      if (name) crossingCounts.set(name, (crossingCounts.get(name) ?? 0) + 1);
    }
    if (e.kind === "rags_to_riches") {
      const name = e.detail.citizen as string | undefined;
      const from = e.detail.from as number | undefined;
      const to = e.detail.to as number | undefined;
      if (name && typeof from === "number" && typeof to === "number") {
        swings.push({ name, swing: to - from, tick: e.tick });
      }
    }
    if (e.kind === "level_up" && firstProsperTick === null) {
      firstProsperTick = e.tick;
      firstProsperName = (e.detail.citizen as string | undefined) ?? null;
    }
  }

  const titlesByName = new Map<string, string[]>();
  const award = (name: string | null | undefined, title: string) => {
    if (!name) return;
    if (!titlesByName.has(name)) titlesByName.set(name, []);
    titlesByName.get(name)!.push(title);
  };

  // Steadiest Hand: smallest lifetime range (least volatile fortune).
  let steadiest: { name: string; range: number } | null = null;
  for (const c of input.citizens) {
    const range = c.peak_stake - c.trough_stake;
    if (!steadiest || range < steadiest.range) steadiest = { name: c.name, range };
  }
  award(steadiest?.name, "Steadiest Hand");

  // Phoenix: the single largest rags-to-riches swing.
  const phoenix = swings.reduce<{ name: string; swing: number; tick: number } | null>(
    (best, s) => (!best || s.swing > best.swing || (s.swing === best.swing && s.tick < best.tick) ? s : best),
    null
  );
  award(phoenix?.name, "Phoenix");

  // The Survivor: the most fortune reversals weathered, either direction.
  let survivor: { name: string; count: number } | null = null;
  for (const [name, count] of crossingCounts) {
    if (!survivor || count > survivor.count) survivor = { name, count };
  }
  award(survivor?.name, "The Survivor");

  // First to Prosper: the first citizen whose ward ever leveled up.
  award(firstProsperName, "First to Prosper");

  const figures: MeridianLegendsFigure[] = input.citizens.map((c) => ({
    name: c.name,
    epithet: MERIDIAN_CAST.find((m) => m.name === c.name)?.epithet ?? "",
    titles: titlesByName.get(c.name) ?? [],
    peak_stake: c.peak_stake,
    trough_stake: c.trough_stake,
    crossings: crossingCounts.get(c.name) ?? 0,
  }));
  figures.sort((a, b) => b.titles.length - a.titles.length || b.crossings - a.crossings || a.name.localeCompare(b.name));
  return figures;
}

// ── The compiler ───────────────────────────────────────────────────────────────

export function compileMeridianLegends(input: MeridianLegendsInput): MeridianLegends {
  const boundaries = chapterBoundaries(input);
  const chapters: MeridianChapter[] = boundaries.map((b, i) => ({
    name: b.name,
    opened_by: b.opened_by,
    from_tick: b.tick,
    to_tick: i + 1 < boundaries.length ? boundaries[i + 1].tick : null,
    entries: [],
  }));

  const events = [...input.events].sort((a, b) => a.id - b.id);
  for (const e of events) {
    let target = chapters[0];
    for (const c of chapters) if (c.from_tick <= e.tick) target = c;
    target.entries.push({ tick: e.tick, kind: e.kind, text: e.summary });
  }

  return {
    live: true,
    world: { tick: input.tick, act: input.act, prosperity_index: input.prosperityIndex },
    chapters,
    figures: compileFigures(input),
  };
}

// ── Markdown edition ───────────────────────────────────────────────────────────

export function meridianLegendsMarkdown(l: MeridianLegends): string {
  const lines: string[] = ["# The Legends of Meridian", ""];
  lines.push(`Tick ${l.world.tick}, currently in ${l.world.act.toUpperCase()} (prosperity index ${l.world.prosperity_index.toFixed(0)}).`);
  lines.push("", "Chapters are bounded by the city's own market history; every line below is the record's own, compiled, never authored.");

  for (const c of l.chapters) {
    const until = c.to_tick !== null ? `tick ${c.to_tick}` : "ongoing";
    lines.push("", `## ${c.name} (tick ${c.from_tick} — ${until})`, "", `*${c.opened_by}*`, "");
    if (c.entries.length === 0) lines.push("- The record of this chapter is still being written.");
    for (const e of c.entries) lines.push(`- [tick ${e.tick}] ${e.text}`);
  }

  lines.push("", "## Figures of the record", "");
  for (const f of l.figures) {
    const titles = f.titles.length > 0 ? ` — earned: ${f.titles.join(", ")}` : "";
    lines.push(
      `- **${f.name}**, called ${f.epithet}${titles}: peak stake ${f.peak_stake.toFixed(0)}, ` +
      `lowest ${f.trough_stake.toFixed(0)}, ${f.crossings} fortune reversal${f.crossings === 1 ? "" : "s"}.`
    );
  }

  lines.push("", "Live state: https://paiddev.com/api/meridian/state", "");
  return lines.join("\n");
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getMeridianLegends(): Promise<MeridianLegends> {
  const cast = MERIDIAN_CAST.map((m) => ({ name: m.name, epithet: m.epithet, peak_stake: 50, trough_stake: 50 }));
  const empty: MeridianLegends = {
    ...compileMeridianLegends({ tick: 0, act: "stable", prosperityIndex: 50, citizens: cast, events: [] }),
    live: false,
  };
  if (!supabaseReady()) return empty;

  const [state, citizens, events] = await Promise.all([
    sbGet<{ tick: number; act: Act; prosperity_index: number }[]>(
      "mw_meridian_state?id=eq.1&select=tick,act,prosperity_index&limit=1"
    ),
    sbGet<{ name: string; peak_stake: number; trough_stake: number }[]>(
      "mw_meridian_citizens?select=name,peak_stake,trough_stake&order=id.asc"
    ),
    sbGet<MeridianEvent[]>("mw_meridian_events?select=*&order=id.asc&limit=1000"),
  ]);
  if (!state?.[0]) return empty;

  const citizenRows = (citizens ?? []).map((c) => ({
    name: c.name,
    epithet: MERIDIAN_CAST.find((m) => m.name === c.name)?.epithet ?? "",
    peak_stake: c.peak_stake,
    trough_stake: c.trough_stake,
  }));

  return compileMeridianLegends({
    tick: state[0].tick,
    act: state[0].act,
    prosperityIndex: state[0].prosperity_index,
    citizens: citizenRows.length > 0 ? citizenRows : cast,
    events: events ?? [],
  });
}
