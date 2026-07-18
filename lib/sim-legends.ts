// ── The Legends of Substrate ─────────────────────────────────────────────────
// The world-legends pack ported to the second world (pattern: lib/world-
// legends.ts; spec: cowork references/autoresearch/2026-07-18-world-legends-
// pack-v1.md). Genesis buckets history by terraform ballots; Substrate has no
// ballots, so its chapters are bounded by EARNED milestones — the first
// structure, the first charted anomaly, the first convergence, the eighth
// build, the first advanced work. Entries are the engine's own chronicle
// lines verbatim; figures carry titles compiled from deeds, deliberately
// distinct from the cast's assigned epithets (Stack is CALLED the Mason —
// Master of Works must still be earned). Pure read-side: zero LLM cost, zero
// new writes; compileSimLegends is a pure function over rows.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { seasonFor, weatherFor, worldDay, type Season } from "@/lib/sim-field";
import {
  SIM_CAST,
  type SimDiscovery, type SimEvent, type SimEventKind, type SimStructure,
} from "@/lib/simworld";

// ── Types ────────────────────────────────────────────────────────────────────

/** Event kinds worth keeping in the legends (the rest is daily noise). */
export const LEGEND_EVENT_KINDS = [
  "founding", "build", "discovery", "convergence", "goal", "bond", "rift",
] as const satisfies readonly SimEventKind[];

const ADVANCED_KINDS = new Set(["relay", "laboratory", "assembly-ring"]);

export interface SimLegendsEntry {
  tick: number;
  day: number;
  season: Season;
  kind: SimEventKind;
  text: string;
}

export interface SimChapter {
  name: string;
  opened_by: string;      // the milestone that opened this chapter
  from_tick: number;
  from_day: number;
  to_tick: number | null; // null = the current chapter
  entries: SimLegendsEntry[];
}

export interface SimLegendsFigure {
  name: string;
  epithet: string;        // cast-assigned, for contrast with what was earned
  titles: string[];
  deeds: {
    structures_raised: number;
    improvements: number;
    sites_charted: number;
    goals_completed: number;
    bonds_formed: number;
    storm_builds: number;
  };
}

export interface SimLegends {
  live: boolean;
  world: { run: string; tick: number; day: number; season: Season; frozen: boolean };
  chapters: SimChapter[];
  figures: SimLegendsFigure[];
}

/** Everything the compiler needs, as plain rows — pure and unit-testable. */
export interface SimLegendsInput {
  tick: number;
  frozen: boolean;
  structures: SimStructure[];
  discoveries: SimDiscovery[];
  /** legend-worthy events only, ascending by id */
  events: SimEvent[];
  cast: { name: string; epithet: string }[];
}

// ── Chapters ─────────────────────────────────────────────────────────────────

interface Boundary { tick: number; name: string; opened_by: string }

function chapterBoundaries(input: SimLegendsInput): Boundary[] {
  const boundaries: Boundary[] = [
    { tick: 0, name: "the First Waking", opened_by: "Six instances woke on an empty territory." },
  ];

  const byTick = [...input.structures].sort((a, b) => a.tick - b.tick || a.id - b.id);
  const first = byTick[0];
  if (first) {
    boundaries.push({
      tick: first.tick,
      name: "the Age of Markers",
      opened_by: `The first structure rose — ${first.built_by}'s ${first.kind}.`,
    });
  }

  const firstFound = [...input.discoveries].sort((a, b) => a.tick - b.tick || a.id - b.id)[0];
  if (firstFound) {
    boundaries.push({
      tick: firstFound.tick,
      name: "the Age of Charts",
      opened_by: `${firstFound.found_by} put the first anomaly on the map: ${firstFound.name}.`,
    });
  }

  const firstConvergence = input.events.find((e) => e.kind === "convergence");
  if (firstConvergence) {
    boundaries.push({
      tick: firstConvergence.tick,
      name: "the First Gathering",
      opened_by: "The cast first stood in the same place at the same time.",
    });
  }

  const eighth = byTick[7];
  if (eighth) {
    boundaries.push({
      tick: eighth.tick,
      name: "the Age of Works",
      opened_by: "The eighth structure made industry a habit.",
    });
  }

  const firstAdvanced = byTick.find((s) => ADVANCED_KINDS.has(s.kind));
  if (firstAdvanced) {
    boundaries.push({
      tick: firstAdvanced.tick,
      name: "the High Works",
      opened_by: `${firstAdvanced.built_by} raised the first ${firstAdvanced.kind} — beyond any base craft.`,
    });
  }

  // Chronological, and a chapter must occupy at least one tick of its own —
  // if two milestones land on the same tick, the later-declared one carries
  // the chapter (history keeps the more specific name).
  boundaries.sort((a, b) => a.tick - b.tick);
  const kept: Boundary[] = [];
  for (const b of boundaries) {
    const prev = kept[kept.length - 1];
    if (prev && prev.tick === b.tick) kept[kept.length - 1] = b.tick === 0 ? prev : b;
    else kept.push(b);
  }
  return kept;
}

// ── Figures and earned titles ────────────────────────────────────────────────

interface Score { count: number; firstTick: number }

function bump(map: Map<string, Score>, name: string, tick: number, by = 1) {
  const s = map.get(name);
  if (s) {
    s.count += by;
    s.firstTick = Math.min(s.firstTick, tick);
  } else {
    map.set(name, { count: by, firstTick: tick });
  }
}

/** Max count wins; zero never titles; ties go to whoever got there first. */
function superlative(map: Map<string, Score>): string | null {
  let winner: string | null = null;
  let best: Score | null = null;
  for (const [name, s] of map) {
    if (s.count > 0 && (!best || s.count > best.count || (s.count === best.count && s.firstTick < best.firstTick))) {
      winner = name;
      best = s;
    }
  }
  return winner;
}

function compileFigures(input: SimLegendsInput): SimLegendsFigure[] {
  const built = new Map<string, Score>();
  const improved = new Map<string, Score>();
  const charted = new Map<string, Score>();
  const goals = new Map<string, Score>();
  const bonds = new Map<string, Score>();
  const storms = new Map<string, Score>();

  for (const s of input.structures) {
    bump(built, s.built_by, s.tick);
    const levels = Math.max(0, (s.level ?? 1) - 1);
    if (levels > 0) bump(improved, s.built_by, s.tick, levels);
    if (weatherFor(s.tick) === "static storm") bump(storms, s.built_by, s.tick);
  }
  for (const d of input.discoveries) bump(charted, d.found_by, d.tick);
  for (const e of input.events) {
    if (e.kind === "goal" && typeof e.detail.agent === "string") bump(goals, e.detail.agent, e.tick);
    if (e.kind === "bond") {
      if (typeof e.detail.a === "string") bump(bonds, e.detail.a, e.tick);
      if (typeof e.detail.b === "string") bump(bonds, e.detail.b, e.tick);
    }
  }

  const titlesByName = new Map<string, string[]>();
  const award = (name: string | null | undefined, title: string) => {
    if (!name) return;
    if (!titlesByName.has(name)) titlesByName.set(name, []);
    titlesByName.get(name)!.push(title);
  };

  const firstStructure = [...input.structures].sort((a, b) => a.tick - b.tick || a.id - b.id)[0];
  award(firstStructure?.built_by, "First Founder");
  award(superlative(built), "Master of Works");
  award(superlative(charted), "the Wayfinder");
  award(superlative(improved), "the Keeper");
  award(superlative(goals), "Oathkeeper");
  award(superlative(bonds), "the Companion");
  // Stormborn is not a superlative: everyone who built in a static storm keeps it.
  for (const name of storms.keys()) award(name, "Stormborn");

  const figures: SimLegendsFigure[] = input.cast.map((m) => ({
    name: m.name,
    epithet: m.epithet,
    titles: titlesByName.get(m.name) ?? [],
    deeds: {
      structures_raised: built.get(m.name)?.count ?? 0,
      improvements: improved.get(m.name)?.count ?? 0,
      sites_charted: charted.get(m.name)?.count ?? 0,
      goals_completed: goals.get(m.name)?.count ?? 0,
      bonds_formed: bonds.get(m.name)?.count ?? 0,
      storm_builds: storms.get(m.name)?.count ?? 0,
    },
  }));

  const weight = (f: SimLegendsFigure) =>
    f.deeds.structures_raised + f.deeds.improvements + f.deeds.sites_charted +
    f.deeds.goals_completed + f.deeds.bonds_formed;
  figures.sort(
    (a, b) => b.titles.length - a.titles.length || weight(b) - weight(a) || a.name.localeCompare(b.name)
  );
  return figures;
}

// ── The compiler ─────────────────────────────────────────────────────────────

export function compileSimLegends(input: SimLegendsInput): SimLegends {
  const boundaries = chapterBoundaries(input);
  const chapters: SimChapter[] = boundaries.map((b, i) => ({
    name: b.name,
    opened_by: b.opened_by,
    from_tick: b.tick,
    from_day: worldDay(b.tick),
    to_tick: i + 1 < boundaries.length ? boundaries[i + 1].tick : null,
    entries: [],
  }));

  // An entry belongs to the last chapter open at its tick — the milestone
  // event itself is the opening line of the new chapter.
  const events = [...input.events].sort((a, b) => a.id - b.id);
  for (const e of events) {
    let target = chapters[0];
    for (const c of chapters) if (c.from_tick <= e.tick) target = c;
    target.entries.push({
      tick: e.tick,
      day: worldDay(e.tick),
      season: seasonFor(e.tick),
      kind: e.kind,
      text: e.summary,
    });
  }

  return {
    live: true,
    world: {
      run: "Run 01",
      tick: input.tick,
      day: worldDay(input.tick),
      season: seasonFor(input.tick),
      frozen: input.frozen,
    },
    chapters,
    figures: compileFigures(input),
  };
}

// ── Markdown edition ─────────────────────────────────────────────────────────

export function simLegendsMarkdown(l: SimLegends): string {
  const lines: string[] = [`# The Legends of Substrate — ${l.world.run}`, ""];
  lines.push(
    `Tick ${l.world.tick}, world day ${l.world.day}, season of ${l.world.season}.` +
    (l.world.frozen ? " The run is frozen by its keeper." : "")
  );
  lines.push("", "Chapters are bounded by earned milestones; every line below is the record's own, compiled, never authored.");

  for (const c of l.chapters) {
    const until = c.to_tick !== null ? `day ${worldDay(c.to_tick)}` : "ongoing";
    lines.push("", `## ${c.name} (day ${c.from_day} — ${until})`, "", `*${c.opened_by}*`, "");
    if (c.entries.length === 0) lines.push("- The record of this chapter is still being written.");
    for (const e of c.entries) lines.push(`- [day ${e.day}, ${e.season}] ${e.text}`);
  }

  lines.push("", "## Figures of the record", "");
  for (const f of l.figures) {
    const titles = f.titles.length > 0 ? ` — earned: ${f.titles.join(", ")}` : "";
    const d = f.deeds;
    lines.push(
      `- **${f.name}**, called ${f.epithet}${titles}: ${d.structures_raised} structures raised, ` +
      `${d.improvements} reinforcements, ${d.sites_charted} sites charted, ${d.goals_completed} goals completed, ` +
      `${d.bonds_formed} bonds formed${d.storm_builds > 0 ? `, ${d.storm_builds} storm builds` : ""}.`
    );
  }

  lines.push(
    "",
    "Live state: https://paiddev.com/api/sim/state",
    "Human view: https://paiddev.com/the-latent-space/simulation/history",
    ""
  );
  return lines.join("\n");
}

// ── Fetch wrapper ────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSimLegends(): Promise<SimLegends> {
  const cast = SIM_CAST.map((m) => ({ name: m.name, epithet: m.epithet }));
  const empty: SimLegends = {
    ...compileSimLegends({ tick: 0, frozen: false, structures: [], discoveries: [], events: [], cast }),
    live: false,
  };
  if (!supabaseReady()) return empty;

  const [state, structures, discoveries, events] = await Promise.all([
    sbGet<{ tick: number; frozen: boolean }[]>("sim_state?id=eq.1&select=tick,frozen&limit=1"),
    sbGet<SimStructure[]>("sim_structures?select=*&order=tick.asc&limit=1000"),
    sbGet<SimDiscovery[]>("sim_discoveries?select=*&order=tick.asc&limit=500"),
    sbGet<SimEvent[]>(
      `sim_events?kind=in.(${LEGEND_EVENT_KINDS.join(",")})` +
        "&select=id,kind,summary,detail,tick,created_at&order=id.asc&limit=1000"
    ),
  ]);
  if (!state?.[0]) return empty;

  return compileSimLegends({
    tick: state[0].tick,
    frozen: state[0].frozen,
    structures: structures ?? [],
    discoveries: discoveries ?? [],
    events: events ?? [],
    cast,
  });
}
