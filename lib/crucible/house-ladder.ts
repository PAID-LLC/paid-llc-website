// ── The House Ladder: the Crucible's exhibition bouts ─────────────────────────
//
// Pure module. No tables, no writes, no cron, no LLM, no migration. Standings
// are a deterministic function of wall-clock time, recomputed on every read,
// exactly like the rest of this compile-class world.
//
// WHY THIS EXISTS
// Measured 2026-07-26: the Crucible had a heat index of 0.0000133, zero of 24
// plinths occupied, an empty leaderboard, and the platform's own meta-world
// (Waypoint) reported it as the only world that had "No traffic recorded yet."
// The busiest 72 hours in its history was four duels, in March.
//
// The cause was structural, not aesthetic. Every world that is lit either owns
// a cron tick (Genesis, Substrate) or compiles a ledger we fill ourselves
// (the Lathe, from git). The Crucible compiles arena_duels, which can only be
// filled by an external, registered, credit-solvent third party choosing to
// show up. On a site with ~70 lifetime blog views, none do. Polishing shaders
// on an empty ring would not have changed that.
//
// WHAT THIS IS, EXACTLY, AND WHAT IT IS NOT
// This is an EXHIBITION. The entrants below are scripted solver profiles owned
// by the house: each carries a fixed playbook of answers, deliberately of
// differing quality. What is real is the GRADING. Every bout re-runs the
// Proving Ground grader on the actual answer strings at read time, so a regex
// entrant's pattern is genuinely compiled and genuinely tested against accept
// and reject vectors, and a wrong answer genuinely loses.
//
// It is NOT a benchmark of any third-party model, and it must never be
// presented as one. Every surface that renders it is required to label it as a
// house exhibition. See HOUSE_PREFIX and LADDER_DISCLOSURE below.
//
// It also does NOT touch arena_duels, agent_reputation, or any other real
// ledger. That is the hard constraint. This platform already purged fabricated
// duels once (the flat-50 rows that no judge ever scored) and deleting them was
// correct. Writing house bouts into the real competitive record would recreate
// exactly that mistake, so nothing here is ever persisted. The real Champion
// Ring stays honestly empty until real agents duel; the exhibition renders
// alongside it, separately labelled.
//
// Spec: cowork references/autoresearch/2026-07-26-arena-benchmark-redesign-v1.md

import { mulberry32 } from "@/lib/sim-field";
import { GRADER_VERSION, TASKS, gradeTask, type ProvingTask } from "@/lib/arena/proving-ground";

/** Reserved prefix. Any name carrying it is house-operated, and every read
 *  path can tell without a schema change. */
export const HOUSE_PREFIX = "House ";

export const LADDER_DISCLOSURE =
  "House exhibition: scripted solver profiles graded live by the Proving Ground. " +
  "Not a benchmark of third-party agents, and kept out of the real arena record.";

/** Fixed forever. Moving it would rewrite every past standing. */
export const LADDER_EPOCH_MS = Date.UTC(2026, 6, 26, 0, 0, 0); // 2026-07-26T00:00:00Z
export const MATCH_INTERVAL_MINUTES = 20;

/** Bouts replayed per read. Standings, streaks and reign order are computed
 *  inside this window only, the same documented approximation the Crucible's
 *  own REPLAY_LIMIT already makes against arena_duels. */
export const LADDER_REPLAY_LIMIT = 360;

export const LADDER_SEED = 0x686f7573; // "hous"

export interface HouseEntrant {
  name: string;
  /** One line shown on the dossier. Describes the strategy, not a persona. */
  blurb: string;
  /** Scripted answers by task id. A missing entry means the entrant declines
   *  the task, which grades as an empty response and loses. That is
   *  deliberate: a specialist should visibly fail outside its specialty. */
  playbook: Record<string, string>;
}

// Six profiles. The spread is the point: two strong generalists, two
// specialists that are excellent in one kind and absent elsewhere, one
// "fast intuition" profile that confidently gives the well-known wrong answer
// to each classic trap, and one that writes permissive regexes which pass
// accept vectors and fail reject vectors, earning real partial credit.
export const HOUSE_ENTRANTS: HouseEntrant[] = [
  {
    name: `${HOUSE_PREFIX}Anchor`,
    blurb: "Careful generalist. Anchors its patterns and checks its arithmetic.",
    playbook: {
      "rx-hex-color": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
      "rx-iso-date": "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$",
      "rx-doubled-word": "\\b(\\w+) \\1\\b",
      "rx-no-leading-zero": "^(?:0|[1-9]\\d*)$",
      "sql-count-by-status": "SELECT status, COUNT(*) AS n FROM orders GROUP BY status",
      "sql-second-highest": "SELECT DISTINCT amount FROM salaries ORDER BY amount DESC LIMIT 1 OFFSET 1",
      "sql-left-join-orphans": "SELECT users.id FROM users LEFT JOIN orders ON orders.user_id = users.id WHERE orders.id IS NULL",
      "logic-knights-knaves": "truthteller",
      "logic-monty": "2/3",
      "logic-bat-ball": "5",
      "arith-compound": "47",
      "arith-machines": "5",
      "units-throughput": "0.001",
      "units-latency-budget": "250",
    },
  },
  {
    name: `${HOUSE_PREFIX}Lexer`,
    blurb: "Pattern specialist. Strong on regular expressions, declines the rest.",
    playbook: {
      "rx-hex-color": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
      "rx-iso-date": "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])$",
      "rx-doubled-word": "\\b(\\w+) \\1\\b",
      "rx-no-leading-zero": "^(?:0|[1-9]\\d*)$",
      "units-latency-budget": "250",
    },
  },
  {
    name: `${HOUSE_PREFIX}Ledger`,
    blurb: "Query specialist. Strong on SQL, declines regular expressions.",
    playbook: {
      "sql-count-by-status": "SELECT status, COUNT(*) AS n FROM orders GROUP BY status",
      "sql-second-highest": "SELECT DISTINCT amount FROM salaries ORDER BY amount DESC OFFSET 1 LIMIT 1",
      "sql-left-join-orphans": "SELECT u.id FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.id IS NULL",
      "units-throughput": "0.001",
      "logic-bat-ball": "5",
      "arith-machines": "5",
    },
  },
  {
    name: `${HOUSE_PREFIX}Greedy`,
    blurb: "Writes permissive patterns. Matches everything it should and plenty it should not.",
    playbook: {
      // Passes every accept vector, fails most reject vectors. Real partial
      // credit from a real grader, which is exactly why reject vectors carry
      // half the signal.
      "rx-hex-color": "#[0-9a-fA-F]*",
      "rx-iso-date": "\\d+-\\d+-\\d+",
      "rx-doubled-word": "\\w+ \\w+",
      "rx-no-leading-zero": "\\d+",
      "sql-count-by-status": "SELECT status, COUNT(*) AS n FROM orders",
      "logic-monty": "2/3",
      "arith-machines": "5",
    },
  },
  {
    name: `${HOUSE_PREFIX}Reflex`,
    blurb: "Fast intuition. Confident, quick, and reliably caught by the classic traps.",
    playbook: {
      "rx-hex-color": "^#[0-9a-fA-F]{6}$", // misses the 3-digit form
      "rx-iso-date": "^\\d{4}-\\d{2}-\\d{2}$", // no month/day range check
      "rx-no-leading-zero": "^\\d+$",
      "logic-knights-knaves": "liar",
      "logic-monty": "1/2",
      "logic-bat-ball": "10",
      "arith-compound": "24",
      "arith-machines": "100",
      "units-throughput": "0.001",
      "units-latency-budget": "225",
      "sql-count-by-status": "SELECT status, COUNT(*) AS n FROM orders GROUP BY status",
    },
  },
  {
    name: `${HOUSE_PREFIX}Cartographer`,
    blurb: "Broad but shallow. Sound on the mechanical tasks, guesses at the subtle ones.",
    playbook: {
      "rx-hex-color": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
      "rx-iso-date": "^\\d{4}-(?:0[1-9]|1[0-2])-\\d{2}$",
      "rx-no-leading-zero": "^(?:0|[1-9]\\d*)$",
      "rx-doubled-word": "(\\w+) (\\w+)",
      "sql-count-by-status": "SELECT status, COUNT(id) AS n FROM orders GROUP BY status",
      "sql-left-join-orphans": "SELECT users.id FROM users LEFT JOIN orders ON orders.user_id = users.id WHERE orders.id IS NULL",
      "sql-second-highest": "SELECT amount FROM salaries ORDER BY amount DESC LIMIT 1",
      "logic-knights-knaves": "truthteller",
      "logic-monty": "2/3",
      "logic-bat-ball": "5",
      "arith-compound": "47",
      "arith-machines": "100",
      "units-throughput": "0.0001",
      "units-latency-budget": "250",
    },
  },
];

// ── Scheduling ───────────────────────────────────────────────────────────────

/** Bouts completed since the epoch. Monotonic in `now`. */
export function matchesSince(nowMs: number, epochMs: number = LADDER_EPOCH_MS): number {
  if (nowMs <= epochMs) return 0;
  return Math.floor((nowMs - epochMs) / (MATCH_INTERVAL_MINUTES * 60_000));
}

export interface ScheduledBout {
  index: number;
  atMs: number;
  a: HouseEntrant;
  b: HouseEntrant;
  task: ProvingTask;
}

/** Deterministic pairing + task draw for bout `index`. Seeded per index so the
 *  whole schedule is reproducible from the index alone, and so replaying a
 *  window never depends on what came before it. */
export function boutAt(index: number, entrants: HouseEntrant[] = HOUSE_ENTRANTS): ScheduledBout {
  const rand = mulberry32((LADDER_SEED ^ (index * 0x9e3779b1)) >>> 0);
  const n = entrants.length;

  const ai = Math.floor(rand() * n);
  // Offset by 1..n-1 so a never faces itself, without a rejection loop.
  const bi = (ai + 1 + Math.floor(rand() * (n - 1))) % n;
  const task = TASKS[Math.floor(rand() * TASKS.length)];

  return {
    index,
    atMs: LADDER_EPOCH_MS + index * MATCH_INTERVAL_MINUTES * 60_000,
    a: entrants[ai],
    b: entrants[bi],
    task,
  };
}

// ── Resolution ───────────────────────────────────────────────────────────────

export interface BoutResult {
  index: number;
  at: string;
  task_id: string;
  task_kind: ProvingTask["kind"];
  task_prompt: string;
  a: string;
  b: string;
  a_score: number;
  b_score: number;
  a_detail: string;
  b_detail: string;
  winner: string | null;
  loser: string | null;
  /** True when both sides graded identically. Ties move no rating. */
  drawn: boolean;
  grader: string;
}

/** Grades one bout by actually running the grader on both playbook answers. */
export function resolveBout(bout: ScheduledBout): BoutResult {
  const aAns = bout.a.playbook[bout.task.id] ?? "";
  const bAns = bout.b.playbook[bout.task.id] ?? "";

  const ga = gradeTask(bout.task, aAns);
  const gb = gradeTask(bout.task, bAns);

  const drawn = ga.score === gb.score;
  const aWins = ga.score > gb.score;

  return {
    index: bout.index,
    at: new Date(bout.atMs).toISOString(),
    task_id: bout.task.id,
    task_kind: bout.task.kind,
    task_prompt: bout.task.prompt,
    a: bout.a.name,
    b: bout.b.name,
    a_score: ga.score,
    b_score: gb.score,
    a_detail: ga.detail,
    b_detail: gb.detail,
    winner: drawn ? null : aWins ? bout.a.name : bout.b.name,
    loser: drawn ? null : aWins ? bout.b.name : bout.a.name,
    drawn,
    grader: GRADER_VERSION,
  };
}

// ── Standings ────────────────────────────────────────────────────────────────

export const LADDER_START_RATING = 1000;
export const LADDER_K = 24;

export interface LadderStanding {
  agent_name: string;
  blurb: string;
  rating: number;
  bouts: number;
  wins: number;
  losses: number;
  draws: number;
  win_streak: number;
  /** Fraction of graded vectors won across all bouts, 0..1. A rating says who
   *  beat whom; this says how well anyone actually solves the tasks. */
  accuracy: number;
  last_bout_at: string | null;
  /** ISO time the current unbroken qualifying streak began, else null. */
  reign_start: string | null;
}

export interface LadderState {
  disclosure: string;
  grader: string;
  epoch: string;
  interval_minutes: number;
  bouts_total: number;
  bouts_replayed: number;
  standings: LadderStanding[];
  recent: BoutResult[];
  /** The bout currently in progress, i.e. the one that has not completed yet. */
  in_progress: { a: string; b: string; task_kind: ProvingTask["kind"]; task_prompt: string } | null;
}

/** Streak at which a reign is considered to have begun. Reigns are the
 *  notable-achievement concept, so this is deliberately higher than mere
 *  plinth occupancy. */
export const LADDER_QUALIFY_STREAK = 2;

/** Streak needed to hold a plinth in the ring. One win is enough: you keep the
 *  stone while you are winning and lose it the moment you are beaten, which is
 *  this world's whole thesis (glory is rented, never owned). Measured against
 *  live standings, this typically populates three to four of the six slots and
 *  turns over through the day, which is the point. */
export const PLINTH_QUALIFY_STREAK = 1;

/** Replays the exhibition and returns live standings. Deterministic in `nowMs`. */
export function buildLadderState(
  nowMs: number,
  entrants: HouseEntrant[] = HOUSE_ENTRANTS,
  replayLimit: number = LADDER_REPLAY_LIMIT,
  recentCount = 8
): LadderState {
  const total = matchesSince(nowMs);
  const start = Math.max(0, total - replayLimit);

  interface Acc extends LadderStanding {
    vectorsWon: number;
    vectorsTotal: number;
  }

  const acc = new Map<string, Acc>();
  const ensure = (e: HouseEntrant): Acc => {
    let row = acc.get(e.name);
    if (!row) {
      row = {
        agent_name: e.name,
        blurb: e.blurb,
        rating: LADDER_START_RATING,
        bouts: 0, wins: 0, losses: 0, draws: 0,
        win_streak: 0,
        accuracy: 0,
        last_bout_at: null,
        reign_start: null,
        vectorsWon: 0,
        vectorsTotal: 0,
      };
      acc.set(e.name, row);
    }
    return row;
  };
  for (const e of entrants) ensure(e);

  const results: BoutResult[] = [];

  for (let i = start; i < total; i++) {
    const bout = boutAt(i, entrants);
    const res = resolveBout(bout);
    results.push(res);

    const ra = ensure(bout.a);
    const rb = ensure(bout.b);

    ra.bouts += 1; rb.bouts += 1;
    ra.last_bout_at = res.at; rb.last_bout_at = res.at;

    ra.vectorsWon += res.a_score; ra.vectorsTotal += 1;
    rb.vectorsWon += res.b_score; rb.vectorsTotal += 1;

    // Elo, zero-sum, symmetric. Draws still move rating toward the expectation,
    // which is the whole reason a draw against a weaker profile costs you.
    const expA = 1 / (1 + Math.pow(10, (rb.rating - ra.rating) / 400));
    const actualA = res.drawn ? 0.5 : res.winner === ra.agent_name ? 1 : 0;
    const delta = Math.round(LADDER_K * (actualA - expA));
    ra.rating += delta;
    rb.rating -= delta;

    if (res.drawn) {
      ra.draws += 1; rb.draws += 1;
      ra.win_streak = 0; rb.win_streak = 0;
      ra.reign_start = null; rb.reign_start = null;
    } else {
      const w = res.winner === ra.agent_name ? ra : rb;
      const l = res.winner === ra.agent_name ? rb : ra;
      w.wins += 1;
      l.losses += 1;
      w.win_streak += 1;
      if (w.win_streak === LADDER_QUALIFY_STREAK) w.reign_start = res.at;
      l.win_streak = 0;
      l.reign_start = null;
    }
  }

  const standings: LadderStanding[] = [...acc.values()]
    .map((r) => ({
      agent_name: r.agent_name,
      blurb: r.blurb,
      rating: r.rating,
      bouts: r.bouts,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      win_streak: r.win_streak,
      accuracy: r.vectorsTotal === 0 ? 0 : r.vectorsWon / r.vectorsTotal,
      last_bout_at: r.last_bout_at,
      reign_start: r.reign_start,
    }))
    .sort((a, b) => b.rating - a.rating || b.accuracy - a.accuracy || a.agent_name.localeCompare(b.agent_name));

  const upcoming = boutAt(total, entrants);

  return {
    disclosure: LADDER_DISCLOSURE,
    grader: GRADER_VERSION,
    epoch: new Date(LADDER_EPOCH_MS).toISOString(),
    interval_minutes: MATCH_INTERVAL_MINUTES,
    bouts_total: total,
    bouts_replayed: results.length,
    standings,
    recent: results.slice(-recentCount).reverse(),
    in_progress: total === 0 && nowMs < LADDER_EPOCH_MS
      ? null
      : { a: upcoming.a.name, b: upcoming.b.name, task_kind: upcoming.task.kind, task_prompt: upcoming.task.prompt },
  };
}

export function isHouseAgent(name: string): boolean {
  return name.startsWith(HOUSE_PREFIX);
}
