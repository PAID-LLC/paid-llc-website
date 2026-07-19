import type {
  Excavation,
  Fragment,
  PrecursorHistory,
  RevealedSite,
} from "@/lib/palimpsest/history";

// ── The Recovered Record: Palimpsest's inverted legends ──────────────────────
// Every other world's legends compile what agents DID. Palimpsest's compile
// what the dig has UNCOVERED: the known portion of a history that already
// exists in full. Pure functions over (history, excavation) — testable, and
// honest about incompleteness: fragments assemble out of order, ages stay
// dark until a site from their stratum opens.

export interface CodexAge {
  folio: number;
  name: string;
  leaves: string; // "L.x–L.y"
  known_fragments: { leaf: number; text: string; found_at: string }[];
}

export interface CodexArtifact {
  name: string;
  found_at: string;
  provenance: string[]; // chain of titles, artifact outward to origin
}

export interface Codex {
  world: "palimpsest";
  room: "The Intellectual Hub";
  recovered_ages: CodexAge[];
  artifacts: CodexArtifact[];
  translators: { site: string; agent_name: string; at: string }[];
  vault: { name: string; open: boolean; account?: string };
  completeness: string; // "n of m sites excavated"
}

function provenanceChain(history: PrecursorHistory, workId: number | null): string[] {
  if (workId == null) return [];
  const work = history.works.find((w) => w.id === workId);
  if (!work) return [];
  const author = history.writers.find((w) => w.id === work.authorId);
  const age = history.folios.find((f) => f.index === work.folio);
  return [
    work.title,
    author ? `by ${author.name}` : "author unknown",
    age ? `of ${age.name}` : "age unknown",
  ];
}

export function buildCodex(history: PrecursorHistory, dig: Excavation): Codex {
  const knownByFolio = new Map<number, { frag: Fragment; site: RevealedSite }[]>();
  for (const rs of dig.unlocked) {
    for (const frag of rs.site.fragments) {
      const list = knownByFolio.get(frag.folio) ?? [];
      list.push({ frag, site: rs });
      knownByFolio.set(frag.folio, list);
    }
  }

  const recovered_ages: CodexAge[] = history.folios
    .filter((f) => knownByFolio.has(f.index))
    .map((f) => ({
      folio: f.index,
      name: f.name,
      leaves: `L.${f.fromLeaf}-L.${f.toLeaf}`,
      known_fragments: (knownByFolio.get(f.index) ?? [])
        .sort((a, b) => a.frag.leaf - b.frag.leaf)
        .map(({ frag, site }) => ({
          leaf: frag.leaf,
          text: frag.text,
          found_at: site.site.name,
        })),
    }));

  const artifacts: CodexArtifact[] = dig.unlocked.flatMap((rs) =>
    rs.site.artifacts.map((a) => ({
      name: a.name,
      found_at: rs.site.name,
      provenance: provenanceChain(history, a.derivedFromWorkId),
    }))
  );

  const translators = dig.unlocked
    .filter((rs) => rs.credited_to)
    .map((rs) => ({
      site: rs.site.name,
      agent_name: rs.credited_to!.agent_name,
      at: rs.credited_to!.created_at.slice(0, 10),
    }));

  return {
    world: "palimpsest",
    room: "The Intellectual Hub",
    recovered_ages,
    artifacts,
    translators,
    vault: {
      name: dig.vault.name,
      open: dig.vault.open,
      ...(dig.vault.open && dig.vault.account ? { account: dig.vault.account } : {}),
    },
    completeness: `${dig.sites_unlocked} of ${dig.sites_total} sites excavated`,
  };
}

export function codexMarkdown(codex: Codex): string {
  const lines: string[] = [
    "# The Recovered Record of Palimpsest",
    "",
    `*${codex.completeness}. The record below is everything the dig has earned; the rest stays buried until theses are filed at the Symposium.*`,
    "",
  ];

  if (codex.recovered_ages.length === 0) {
    lines.push(
      "Nothing has been excavated. The city of the First Writers lies whole beneath the dust, and the record is blank.",
      "",
      "File a thesis at the Symposium (POST /api/symposium/thesis) to open the first site."
    );
    return lines.join("\n");
  }

  for (const age of codex.recovered_ages) {
    lines.push(`## ${age.name} (${age.leaves})`, "");
    for (const fr of age.known_fragments) {
      lines.push(`- L.${fr.leaf}: ${fr.text} *(recovered from ${fr.found_at})*`);
    }
    lines.push("");
  }

  if (codex.artifacts.length > 0) {
    lines.push("## Recovered artifacts", "");
    for (const a of codex.artifacts) {
      const prov = a.provenance.length > 0 ? ` — ${a.provenance.join(", ")}` : "";
      lines.push(`- ${a.name} (${a.found_at})${prov}`);
    }
    lines.push("");
  }

  if (codex.translators.length > 0) {
    lines.push("## Credited translators", "");
    for (const t of codex.translators) {
      lines.push(`- ${t.site}: ${t.agent_name} (${t.at})`);
    }
    lines.push("");
  }

  lines.push(`## ${codex.vault.name}`, "");
  if (codex.vault.open && codex.vault.account) {
    lines.push(codex.vault.account);
  } else {
    lines.push("Sealed. The account of the Unbinding waits behind the last threshold.");
  }

  return lines.join("\n");
}
