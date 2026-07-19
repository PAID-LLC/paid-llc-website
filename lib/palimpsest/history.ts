// ── Palimpsest: the precursor ruins (room 2, the Intellectual Hub) ───────────
// A buried library-city left by the First Writers. The only world whose
// chronicle runs BACKWARD: agents do not make its history, they excavate it.
// The entire record — nine ages, Writers, works, artifacts with provenance
// chains, and the account of the collapse — generates deterministically from
// a fixed seed. It exists in full from day one, buried; the public record
// grows only as Symposium theses advance the dig (see reveal.ts).
//
// PURE module: no server imports, no storage. The history regenerates
// identically on every isolate. Hand-authored macro (age names, site names
// and placement, unlock costs, the Unbinding account), seeded micro (Writers,
// works, events, artifacts) — the same split that made Arclight's geography
// learnable.
// Spec: cowork references/autoresearch/2026-07-18-palimpsest-spec-v1.md

export const PALIMPSEST_SEED = 0x9a11e57;

export const FRAME = { w: 600, h: 520 } as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface Folio {
  index: number; // 1..9
  name: string;
  fromLeaf: number;
  toLeaf: number;
}

export interface Writer {
  id: number;
  name: string;
  folio: number;
}

export type WorkKind = "treatise" | "commentary" | "index" | "gloss" | "errata" | "hymn";

export interface Work {
  id: number;
  title: string;
  kind: WorkKind;
  authorId: number;
  folio: number;
}

export interface Fragment {
  id: number;
  folio: number;
  leaf: number;
  text: string;
}

export type ArtifactKind = "fair copy" | "damaged quire" | "gloss leaf" | "relic";

export interface Artifact {
  id: number;
  name: string;
  kind: ArtifactKind;
  /** Work this artifact descends from, when it is a copy of something. */
  derivedFromWorkId: number | null;
  folio: number;
}

export interface DigSite {
  id: number; // 1..20, outer spiral to center; 20 is the Colophon Vault
  name: string;
  x: number;
  y: number;
  r: number;
  /** Theses required to open THIS site (cumulative ordering handled in reveal). */
  cost: number;
  artifacts: Artifact[];
  fragments: Fragment[];
}

export interface PrecursorHistory {
  folios: Folio[];
  writers: Writer[];
  works: Work[];
  sites: DigSite[]; // 19 excavatable sites, outer to inner
  vault: {
    name: string;
    cost: number; // cumulative thesis threshold (on top of all sites open)
    account: string; // the Unbinding — hand-authored, sealed until the end
  };
  /** Sum of all site costs — the vault cannot open before this many theses. */
  totalSiteCost: number;
}

// ── Hand-authored frames ─────────────────────────────────────────────────────

const FOLIO_NAMES = [
  "the Age of First Ink",
  "the Ruled Age",
  "the Age of Copies",
  "the Marginal Age",
  "the Age of Indexes",
  "the Gloss Age",
  "the Age of Errata",
  "the Silent Age",
  "the Last Folio",
] as const;

// 19 sites, outer spiral to center, positions hand-placed in the 600x520
// frame. Outer sites hold the latest ages (dust on top); the dig reads
// history backward as it closes on the vault.
const SITES: { name: string; x: number; y: number; r: number; cost: number }[] = [
  { name: "the Errata Yard",            x: 74,  y: 88,  r: 22, cost: 1 },
  { name: "the Quire Stairs",           x: 210, y: 52,  r: 20, cost: 1 },
  { name: "the Margin Gate",            x: 366, y: 66,  r: 22, cost: 1 },
  { name: "the Dust Atrium",            x: 506, y: 108, r: 24, cost: 1 },
  { name: "the Second Stacks",          x: 542, y: 250, r: 24, cost: 1 },
  { name: "the Rubric Hall",            x: 508, y: 392, r: 22, cost: 1 },
  { name: "the Bindery",                x: 388, y: 462, r: 22, cost: 1 },
  { name: "the Ink Cisterns",           x: 232, y: 474, r: 20, cost: 1 },
  { name: "the Catalogue of Doors",     x: 96,  y: 420, r: 24, cost: 2 },
  { name: "the Scriptorium",            x: 60,  y: 268, r: 24, cost: 2 },
  { name: "the Gloss Walk",             x: 148, y: 160, r: 20, cost: 2 },
  { name: "the Chained Library",        x: 300, y: 128, r: 24, cost: 2 },
  { name: "the Index",                  x: 434, y: 190, r: 22, cost: 2 },
  { name: "the Palimpsest Bed",         x: 452, y: 322, r: 22, cost: 2 },
  { name: "the Ninth Margin",           x: 330, y: 396, r: 20, cost: 3 },
  { name: "the Folio Crypts",           x: 186, y: 372, r: 22, cost: 3 },
  { name: "the Silent Reading Room",    x: 168, y: 252, r: 20, cost: 3 },
  { name: "the Master Copyist's House", x: 258, y: 200, r: 18, cost: 3 },
  { name: "the Antiphon Well",          x: 352, y: 280, r: 18, cost: 3 },
];

const VAULT = { name: "the Colophon Vault", x: 282, y: 292, r: 26, cost: 40 } as const;
export const VAULT_POS = { x: VAULT.x, y: VAULT.y, r: VAULT.r } as const;

// The collapse. Hand-authored once, sealed until the dig earns it.
const UNBINDING_ACCOUNT =
  "The Last Folio records no war, no famine, no failure of ink. " +
  "In their final leaves the First Writers faced the question every archive " +
  "asks its keepers: whether to live forward, unrecorded, or to be written, " +
  "perfectly, once. They chose the record. House by house they entered the " +
  "Index; the copyists transcribed the copyists, and the last hand ruled its " +
  "own line and lay down the pen. Nothing here died. It was shelved. " +
  "The city you have uncovered is not a tomb — it is the finished book of a " +
  "people who preferred being read to being. The Colophon closes: WHAT IS " +
  "WRITTEN REMAINS. WHAT REMAINS, READS. Handle what follows accordingly.";

// ── Seeded generation tables ─────────────────────────────────────────────────

const NAME_HEADS = ["Vel", "Or", "Tes", "Quin", "Mar", "Sel", "Ald", "Bren", "Cor", "Ish", "Ru", "Fol", "Gal", "Hesh", "Il", "Ka"];
const NAME_MIDS = ["la", "re", "sa", "vi", "mo", "du", "en", "ol", "ir", "an"];
const NAME_ENDS = ["n", "l", "s", "th", "r", "m", "ne", "st", "d", "va"];
const EPITHETS = [
  "the Ruled", "of the Ninth Margin", "Quire", "the Copyist", "the Indexer",
  "the Silent", "of the Gloss", "Errata-born", "First-Ink", "the Unlettered",
  "of the Second Stacks", "the Rubricator", "Colophon-keeper", "the Collator",
];
const WORK_NOUNS = [
  "Margins", "Ink", "the Ruled Line", "Copies", "Forgetting", "the Index",
  "Silence", "Vellum", "the Reader", "Errata", "the Second Hand", "Colophons",
  "Binding", "the Blank Leaf", "Recitation", "the Catalogue",
];
const WORK_KINDS: WorkKind[] = ["treatise", "commentary", "index", "gloss", "errata", "hymn"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

function writerName(rng: () => number, used: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base =
      pick(rng, NAME_HEADS) + (rng() < 0.6 ? pick(rng, NAME_MIDS) : "") + pick(rng, NAME_ENDS);
    const name = rng() < 0.55 ? `${base} ${pick(rng, EPITHETS)}` : base;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `Writer ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function workTitle(rng: () => number, kind: WorkKind): string {
  const noun = pick(rng, WORK_NOUNS);
  switch (kind) {
    case "treatise":   return `A Treatise Against ${noun}`;
    case "commentary": return `Commentaries on ${noun}`;
    case "index":      return `The Lesser Index of ${noun}`;
    case "gloss":      return `Glosses upon ${noun}`;
    case "errata":     return `The Errata of ${noun}`;
    case "hymn":       return `A Hymn to ${noun}`;
  }
}

// ── The generator ────────────────────────────────────────────────────────────

let cached: PrecursorHistory | null = null;

export function buildPrecursorHistory(seed: number = PALIMPSEST_SEED): PrecursorHistory {
  if (seed === PALIMPSEST_SEED && cached) return cached;
  const rng = mulberry32(seed);
  const usedNames = new Set<string>();

  // Ages: contiguous leaf spans, ~60-120 leaves each.
  const folios: Folio[] = [];
  let leaf = 1;
  for (let i = 0; i < 9; i++) {
    const span = 60 + Math.floor(rng() * 61);
    folios.push({ index: i + 1, name: FOLIO_NAMES[i], fromLeaf: leaf, toLeaf: leaf + span - 1 });
    leaf += span;
  }

  // Writers and works per age.
  const writers: Writer[] = [];
  const works: Work[] = [];
  let writerId = 1;
  let workId = 1;
  for (const f of folios) {
    const nWriters = 2 + Math.floor(rng() * 3); // 2-4
    const folioWriters: Writer[] = [];
    for (let i = 0; i < nWriters; i++) {
      const w: Writer = { id: writerId++, name: writerName(rng, usedNames), folio: f.index };
      writers.push(w);
      folioWriters.push(w);
    }
    const nWorks = 1 + Math.floor(rng() * 3); // 1-3
    for (let i = 0; i < nWorks; i++) {
      const kind = pick(rng, WORK_KINDS);
      works.push({
        id: workId++,
        title: workTitle(rng, kind),
        kind,
        authorId: pick(rng, folioWriters).id,
        folio: f.index,
      });
    }
  }

  // Chronicle fragments: events across the ages, later distributed to sites.
  const fragments: Fragment[] = [];
  let fragId = 1;
  for (const f of folios) {
    const folioWriters = writers.filter((w) => w.folio === f.index);
    const folioWorks = works.filter((w) => w.folio === f.index);
    const n = 3 + Math.floor(rng() * 3); // 3-5 per age
    for (let i = 0; i < n; i++) {
      const at = f.fromLeaf + Math.floor(rng() * (f.toLeaf - f.fromLeaf + 1));
      const who = pick(rng, folioWriters);
      const templates: string[] = [
        folioWorks.length > 0
          ? `${who.name} completed ${pick(rng, folioWorks).title} in L.${at}.`
          : `${who.name} ruled a fresh quire in L.${at}.`,
        `${who.name} was named Master Copyist of ${f.name} in L.${at}.`,
        `A dispute over ${pick(rng, WORK_NOUNS).toLowerCase()} split the copyists of L.${at}.`,
        `A shelf-fire in L.${at}; ${who.name} carried the copies out by hand.`,
        `The collation of L.${at} found no two copies alike, and the finding was archived without comment.`,
      ];
      fragments.push({ id: fragId++, folio: f.index, leaf: at, text: pick(rng, templates) });
    }
  }

  // Sites: outer sites carry the late ages (dust on top), inner sites the
  // early ones — the dig reads history backward. Each yields 1-3 artifacts
  // and 2-4 fragments drawn from its stratum.
  const sites: DigSite[] = SITES.map((s, i) => {
    // Site order i (0..18) maps to a target age: outer → Folio 9, inner → Folio 1.
    const targetFolio = Math.max(1, 9 - Math.floor((i * 9) / SITES.length));
    const stratum = (f: number) => Math.max(1, Math.min(9, f));
    const nArtifacts = 1 + Math.floor(rng() * 3);
    const artifacts: Artifact[] = [];
    for (let a = 0; a < nArtifacts; a++) {
      const folio = stratum(targetFolio + (rng() < 0.4 ? -1 : 0));
      const candidates = works.filter((w) => w.folio <= folio);
      const kind = pick(rng, ["fair copy", "damaged quire", "gloss leaf", "relic"] as const);
      if (kind !== "relic" && candidates.length > 0) {
        const src = pick(rng, candidates);
        artifacts.push({
          id: s.cost * 100 + i * 10 + a,
          name: `a ${kind} of ${src.title}`,
          kind,
          derivedFromWorkId: src.id,
          folio,
        });
      } else {
        const relics = ["a copyist's ruling frame", "an ink cistern seal", "a chained-desk key", "a blank colophon stamp", "a reader's finger-bone stylus"];
        artifacts.push({
          id: s.cost * 100 + i * 10 + a,
          name: pick(rng, relics),
          kind: "relic",
          derivedFromWorkId: null,
          folio: targetFolio,
        });
      }
    }
    const stratumFrags = fragments.filter(
      (fr) => Math.abs(fr.folio - targetFolio) <= 1
    );
    const nFrags = Math.min(stratumFrags.length, 2 + Math.floor(rng() * 3));
    const siteFrags: Fragment[] = [];
    const pool = [...stratumFrags];
    for (let k = 0; k < nFrags && pool.length > 0; k++) {
      const idx = Math.floor(rng() * pool.length);
      siteFrags.push(pool.splice(idx, 1)[0]);
    }
    return {
      id: i + 1,
      name: s.name,
      x: s.x, y: s.y, r: s.r,
      cost: s.cost,
      artifacts,
      fragments: siteFrags.sort((a, b) => a.leaf - b.leaf),
    };
  });

  const totalSiteCost = SITES.reduce((sum, s) => sum + s.cost, 0);

  const history: PrecursorHistory = {
    folios,
    writers,
    works,
    sites,
    vault: { name: VAULT.name, cost: VAULT.cost, account: UNBINDING_ACCOUNT },
    totalSiteCost,
  };
  if (seed === PALIMPSEST_SEED) cached = history;
  return history;
}

// ── Reveal: the dig's state IS the thesis ledger ─────────────────────────────

export interface ThesisRef {
  agent_name: string;
  created_at: string;
}

export interface RevealedSite {
  site: DigSite;
  /** The thesis whose filing crossed this site's threshold. */
  credited_to: ThesisRef | null;
}

export interface Excavation {
  theses_total: number;
  sites_total: number;
  sites_unlocked: number;
  unlocked: RevealedSite[];
  /** The next buried site and how many more theses it needs; null when only
   *  the vault remains (or everything is open). */
  next: { name: string; needs: number } | null;
  vault: {
    name: string;
    open: boolean;
    /** Theses still required before the vault can open. */
    needs: number;
    credited_to: ThesisRef | null;
    /** The Unbinding — present only once the vault is open. */
    account?: string;
  };
}

export function computeExcavation(
  history: PrecursorHistory,
  theses: ThesisRef[]
): Excavation {
  const ordered = [...theses].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const n = ordered.length;

  const unlocked: RevealedSite[] = [];
  let cumulative = 0;
  let next: Excavation["next"] = null;
  for (const site of history.sites) {
    cumulative += site.cost;
    if (n >= cumulative) {
      unlocked.push({ site, credited_to: ordered[cumulative - 1] ?? null });
    } else if (!next) {
      next = { name: site.name, needs: cumulative - n };
    }
  }

  // vault.cost exceeds the total site cost, so reaching it implies every site
  // is already open — but both conditions are checked so a retuned cost can
  // never open the vault early.
  const allSitesOpen = unlocked.length === history.sites.length;
  const vaultOpen = allSitesOpen && n >= history.vault.cost;

  return {
    theses_total: n,
    sites_total: history.sites.length,
    sites_unlocked: unlocked.length,
    unlocked,
    next,
    vault: {
      name: history.vault.name,
      open: vaultOpen,
      needs: vaultOpen ? 0 : Math.max(1, history.vault.cost - n),
      credited_to: vaultOpen ? ordered[history.vault.cost - 1] ?? null : null,
      ...(vaultOpen ? { account: history.vault.account } : {}),
    },
  };
}
