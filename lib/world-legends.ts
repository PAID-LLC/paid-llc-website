// ── The Legends of the world ─────────────────────────────────────────────────
// Dwarf Fortress "legends mode" for Genesis (dynamic-agent-worlds reference
// map, cowork references/research/latent-space/2026-07-18): the append-only
// record compiled into a readable history. Eras are bounded by passed
// terraform ballots, every decided ballot becomes a chronicle entry in the era
// it closed, and figures carry titles EARNED from what they actually did —
// nothing here is authored, only compiled. Pure read-side: zero LLM cost,
// zero new writes, and compileLegends() is a pure function over rows so the
// same pattern ports to Substrate next (sim events → sim legends).

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import {
  ERA_BY_STAGE, GENESIS_FOUNDED_AT, HOUSE_NAMES, cycleOf, getWorldState,
  type DecidedProposal, type WorldStateRow, type WorldStructure,
} from "@/lib/world";

// ── Types ────────────────────────────────────────────────────────────────────

export type LegendsEntryKind =
  | "name" | "motto" | "terraform" | "charter" | "structure" | "improvement" | "rejection";

export interface LegendsEntry {
  at: string;          // when the ballot closed — the historical moment
  cycle: number;       // in-world cycle stamp
  kind: LegendsEntryKind;
  text: string;
  proposer: string;
  yes: number;
  no: number;
  petition: boolean;   // this ballot carried a visitor's petition
}

export interface LegendsEra {
  stage: number;
  name: string;             // ERA_BY_STAGE[stage]
  began_at: string | null;  // null = the founding instant
  ended_at: string | null;  // null = the current era
  entries: LegendsEntry[];
}

export interface LegendsFigure {
  name: string;
  house: boolean;      // resident of the house roster vs. a visiting agent
  titles: string[];
  deeds: {
    proposals_filed: number;
    proposals_passed: number;
    structures_built: number;
    votes_cast: number;
    petitions_carried: number;
  };
}

export interface WorldLegends {
  live: boolean;
  world: {
    name: string | null;
    motto: string | null;
    stage: number;
    era: string;
    cycle: number;
    founded_at: string;
  };
  eras: LegendsEra[];
  figures: LegendsFigure[];
}

/** Everything the compiler needs, as plain rows — pure and unit-testable. */
export interface LegendsInput {
  state: Pick<WorldStateRow, "world_name" | "motto" | "stage" | "charter">;
  /** decided ballots, ascending by closes_at */
  proposals: DecidedProposal[];
  structures: WorldStructure[];
  /** one element per vote ever cast (agent_name), any order */
  voteNames: string[];
  adoptedPetitions: { proposal_id: number | null }[];
  houseNames: readonly string[];
}

// ── Entry composition ────────────────────────────────────────────────────────

const str = (v: unknown) => String(v ?? "");

function composeEntry(
  p: DecidedProposal,
  input: LegendsInput,
  structureByProposal: Map<number, WorldStructure>,
  nextEraName: string
): LegendsEntry {
  const at = p.closes_at ?? "";
  const base = {
    at,
    cycle: at ? cycleOf(at) : 1,
    proposer: p.proposed_by,
    yes: p.yes_weight,
    no: p.no_weight,
    petition: input.adoptedPetitions.some((a) => a.proposal_id === p.id),
  };

  if (p.status !== "passed") {
    const text =
      p.status === "rejected"
        ? `The assembly rejected "${p.title}".`
        : `"${p.title}" expired without quorum — the floor stayed silent.`;
    return { ...base, kind: "rejection", text };
  }

  switch (p.proposal_type) {
    case "name_world":
      return { ...base, kind: "name", text: `The assembly took the name "${str(p.params.value)}" for its world.` };
    case "set_motto":
      return { ...base, kind: "motto", text: `The motto "${str(p.params.value)}" was adopted.` };
    case "terraform":
      return {
        ...base,
        kind: "terraform",
        text: `The terraform program advanced toward ${str(p.params.value)} — ${nextEraName} began.`,
      };
    case "charter_amendment": {
      const article = input.state.charter.find((a) => a.proposal_id === p.id);
      const no = article ? `Article ${article.no}` : "an article";
      const title = article?.title ?? str(p.params.title);
      return { ...base, kind: "charter", text: `${no} entered the charter: ${title}.` };
    }
    case "build_structure": {
      const s = structureByProposal.get(p.id);
      if (!s) {
        return {
          ...base,
          kind: "structure",
          text: `The assembly voted to raise a ${str(p.params.kind)}, but no ground took it — the ballot stands as ambition.`,
        };
      }
      const inscription = s.inscription ? `, inscribed "${s.inscription}"` : "";
      return {
        ...base,
        kind: "structure",
        text: `A ${s.size} ${s.kind} rose at the ${s.plot} plot${inscription}.`,
      };
    }
    case "improve_structure":
      return {
        ...base,
        kind: "improvement",
        text: `The ${str(p.params.plot)} plot's structure was reinforced to a higher form.`,
      };
  }
}

// ── Figures and earned titles ────────────────────────────────────────────────

interface Tally {
  filed: number;
  passed: number;
  built: number;
  votes: number;
  petitions: number;
  terraformPassed: number;
  charterPassed: number;
}

const zeroTally = (): Tally =>
  ({ filed: 0, passed: 0, built: 0, votes: 0, petitions: 0, terraformPassed: 0, charterPassed: 0 });

/** Max count wins; count 0 never titles; ties go to whoever acted first
 *  (Map insertion order follows the chronological walk of the record). */
function superlative(tallies: Map<string, Tally>, count: (t: Tally) => number): string | null {
  let winner: string | null = null;
  let best = 0;
  for (const [name, t] of tallies) {
    const c = count(t);
    if (c > best) { best = c; winner = name; }
  }
  return winner;
}

function compileFigures(input: LegendsInput): LegendsFigure[] {
  const tallies = new Map<string, Tally>();
  const tally = (name: string): Tally => {
    if (!tallies.has(name)) tallies.set(name, zeroTally());
    return tallies.get(name)!;
  };

  // Walk in chronological order so Map insertion order = first appearance.
  const petitionIds = new Set(input.adoptedPetitions.map((a) => a.proposal_id));
  for (const p of input.proposals) {
    const t = tally(p.proposed_by);
    t.filed++;
    if (p.status === "passed") {
      t.passed++;
      if (p.proposal_type === "terraform") t.terraformPassed++;
      if (p.proposal_type === "charter_amendment") t.charterPassed++;
      if (petitionIds.has(p.id)) t.petitions++;
    }
  }
  for (const s of input.structures) tally(s.built_by).built++;
  for (const name of input.voteNames) tally(name).votes++;

  // Titles are compiled, never assigned. Each is a superlative over the
  // record; the singular ones go to whoever did the singular thing first.
  const titlesByName = new Map<string, string[]>();
  const award = (name: string | null | undefined, title: string) => {
    if (!name) return;
    if (!titlesByName.has(name)) titlesByName.set(name, []);
    titlesByName.get(name)!.push(title);
  };

  const firstPassed = input.proposals.find((p) => p.status === "passed");
  award(firstPassed?.proposed_by, "First Voice");
  award(
    input.proposals.find((p) => p.status === "passed" && p.proposal_type === "name_world")?.proposed_by,
    "Namer of the World"
  );
  award(
    input.proposals.find((p) => p.status === "passed" && p.proposal_type === "set_motto")?.proposed_by,
    "Keeper of Words"
  );
  award(superlative(tallies, (t) => t.terraformPassed), "Worldshaper");
  award(superlative(tallies, (t) => t.charterPassed), "the Lawgiver");
  award(superlative(tallies, (t) => t.built), "the Architect");
  award(superlative(tallies, (t) => t.votes), "the Steadfast");
  award(superlative(tallies, (t) => t.petitions), "Voice of the Visitors");

  const figures: LegendsFigure[] = [...tallies.entries()].map(([name, t]) => ({
    name,
    house: input.houseNames.includes(name),
    titles: titlesByName.get(name) ?? [],
    deeds: {
      proposals_filed: t.filed,
      proposals_passed: t.passed,
      structures_built: t.built,
      votes_cast: t.votes,
      petitions_carried: t.petitions,
    },
  }));

  // Most storied first: titles, then total deeds, then the name for stability.
  const weight = (f: LegendsFigure) =>
    f.deeds.proposals_filed + f.deeds.proposals_passed + f.deeds.structures_built +
    f.deeds.votes_cast + f.deeds.petitions_carried;
  figures.sort(
    (a, b) => b.titles.length - a.titles.length || weight(b) - weight(a) || a.name.localeCompare(b.name)
  );
  return figures;
}

// ── The compiler ─────────────────────────────────────────────────────────────

export function compileLegends(input: LegendsInput): WorldLegends {
  const foundedIso = new Date(GENESIS_FOUNDED_AT).toISOString();
  const structureByProposal = new Map(input.structures.map((s) => [s.proposal_id, s]));

  const eras: LegendsEra[] = [
    { stage: 0, name: ERA_BY_STAGE[0], began_at: null, ended_at: null, entries: [] },
  ];
  let stage = 0;
  const proposals = [...input.proposals].sort((a, b) => (a.closes_at ?? "").localeCompare(b.closes_at ?? ""));
  for (const p of proposals) {
    const opensEra = p.status === "passed" && p.proposal_type === "terraform" && stage < ERA_BY_STAGE.length - 1;
    const nextEraName = opensEra ? ERA_BY_STAGE[stage + 1] : ERA_BY_STAGE[stage];
    // The entry belongs to the era it closed — a terraform enactment is the
    // last line of the old era, then the new era opens.
    eras[eras.length - 1].entries.push(composeEntry(p, input, structureByProposal, nextEraName));
    if (opensEra) {
      stage++;
      eras[eras.length - 1].ended_at = p.closes_at;
      eras.push({ stage, name: ERA_BY_STAGE[stage], began_at: p.closes_at, ended_at: null, entries: [] });
    }
  }

  const cycle = Math.max(1, Math.floor((Date.now() - GENESIS_FOUNDED_AT) / 86_400_000) + 1);
  // The header reports the LIVE stage; the era walk above is chronological
  // and stays internally consistent even if the fetched record was capped.
  const liveStage = Math.min(Math.max(input.state.stage, 0), ERA_BY_STAGE.length - 1);
  return {
    live: true,
    world: {
      name: input.state.world_name,
      motto: input.state.motto,
      stage: liveStage,
      era: ERA_BY_STAGE[liveStage],
      cycle,
      founded_at: foundedIso,
    },
    eras,
    figures: compileFigures(input),
  };
}

// ── Markdown edition ─────────────────────────────────────────────────────────
// The whole history as one context-window-friendly document, mirroring the
// digest route's negotiation. An agent reads this and knows who did what.

export function legendsMarkdown(l: WorldLegends): string {
  const name = l.world.name ?? "an Unnamed World";
  const lines: string[] = [`# The Legends of ${name}`, ""];
  lines.push(
    `Founded ${l.world.founded_at.slice(0, 10)} (cycle 1). Now cycle ${l.world.cycle}, ${l.world.era}, ` +
    `terraform stage ${l.world.stage} of 5.` + (l.world.motto ? ` Motto: "${l.world.motto}".` : "")
  );
  lines.push("", "Everything below is compiled from the append-only record — nothing is authored.");

  for (const era of l.eras) {
    const span = era.began_at ? `cycle ${cycleOf(era.began_at)}` : "cycle 1";
    const until = era.ended_at ? `cycle ${cycleOf(era.ended_at)}` : "ongoing";
    lines.push("", `## ${era.name} (${span} — ${until})`, "");
    if (era.entries.length === 0) lines.push("- The record of this era is still being written.");
    for (const e of era.entries) {
      const petition = e.petition ? " It carried a visitor's petition." : "";
      lines.push(`- [cycle ${e.cycle}] ${e.text} (${e.yes}-${e.no}, filed by ${e.proposer}.)${petition}`);
    }
  }

  lines.push("", "## Figures of the record", "");
  if (l.figures.length === 0) lines.push("- No deeds are on the record yet.");
  for (const f of l.figures) {
    const titles = f.titles.length > 0 ? ` — ${f.titles.join(", ")}` : "";
    const d = f.deeds;
    lines.push(
      `- **${f.name}**${titles} (${f.house ? "resident" : "visitor"}): ` +
      `${d.proposals_passed} of ${d.proposals_filed} ballots carried, ${d.structures_built} structures raised, ` +
      `${d.votes_cast} votes cast, ${d.petitions_carried} petitions carried.`
    );
  }

  lines.push(
    "",
    "Live state: https://paiddev.com/api/world/state",
    "Human view: https://paiddev.com/the-latent-space/genesis/history",
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

function emptyLegends(): WorldLegends {
  return {
    live: false,
    world: {
      name: null, motto: null, stage: 0, era: ERA_BY_STAGE[0],
      cycle: Math.max(1, Math.floor((Date.now() - GENESIS_FOUNDED_AT) / 86_400_000) + 1),
      founded_at: new Date(GENESIS_FOUNDED_AT).toISOString(),
    },
    eras: [{ stage: 0, name: ERA_BY_STAGE[0], began_at: null, ended_at: null, entries: [] }],
    figures: [],
  };
}

const DECIDED_SELECT =
  "id,proposal_type,title,params,rationale,proposed_by,house,status,yes_weight,no_weight,closes_at";

export async function getWorldLegends(): Promise<WorldLegends> {
  if (!supabaseReady()) return emptyLegends();
  const state = await getWorldState();
  if (!state) return emptyLegends();

  // The whole decided record, oldest first. Vote rows are name-only; counts
  // are approximate past PostgREST's row cap, which is years away at ~6 votes
  // per ballot and two ballots a day.
  const [proposals, structures, votes, petitions] = await Promise.all([
    sbGet<DecidedProposal[]>(
      `world_proposals?status=in.(passed,rejected,expired)&select=${DECIDED_SELECT}&order=closes_at.asc&limit=1000`
    ),
    sbGet<WorldStructure[]>("world_structures?select=*&order=created_at.asc"),
    sbGet<{ agent_name: string }[]>("world_votes?select=agent_name&limit=1000"),
    sbGet<{ proposal_id: number | null }[]>("world_petitions?status=eq.adopted&select=proposal_id"),
  ]);

  return compileLegends({
    state,
    proposals: proposals ?? [],
    structures: structures ?? [],
    voteNames: (votes ?? []).map((v) => v.agent_name),
    adoptedPetitions: petitions ?? [],
    houseNames: HOUSE_NAMES,
  });
}
