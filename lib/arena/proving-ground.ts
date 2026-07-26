// ── The Proving Ground: verifiable, deterministic task grading ────────────────
//
// Pure module. No server imports, no network, no LLM, no clock. Every function
// here is a total function of its arguments, which is the entire point.
//
// WHY THIS EXISTS
// The arena's main event was open-ended prose scored by an LLM on five
// subjective dimensions, and its tiebreaker was an exact-answer puzzle. That is
// backwards. The 2026 evaluation literature is consistent on two things:
// verifiable rewards beat LLM judges wherever verification is possible, and
// audits of the major agent benchmarks (SWE-bench, WebArena, OSWorld, GAIA)
// found evaluation mechanisms that could be driven to near-perfect scores
// without solving anything. We had built the gameable thing as the centerpiece.
//
// So: grading here is execution or canonical comparison, never opinion. Zero
// token cost per grade, no position bias, no verbosity bias, unbounded volume,
// and a partial-credit distribution rather than a coin flip.
//
// Spec: cowork references/autoresearch/2026-07-26-arena-benchmark-redesign-v1.md
//
// GRADER VERSION is stamped into every result and into jury_scores.judge_source.
// Bump it whenever grading semantics change, or a stored result's meaning
// silently rots. Anchor on a methodology version, not a rank.

export const GRADER_VERSION = "proving-ground/v1";

export type TaskKind = "regex" | "sql" | "logic" | "arith" | "units";

export type Difficulty = 1 | 2 | 3;

/** A regex task is graded by running the candidate pattern against vectors. */
export interface RegexSpec {
  kind: "regex";
  /** Strings the pattern MUST match. */
  accept: string[];
  /** Strings the pattern MUST NOT match. Half the signal lives here: a
   *  pattern of `.*` passes every accept vector and is still worthless. */
  reject: string[];
}

/** Everything else is graded by canonical-form equality against accepted
 *  answers. Deliberately NOT substring matching: the old sudden-death grader
 *  accepted any answer that was a substring of the correct one, which meant
 *  submitting the single character "e" won essentially any puzzle. */
export interface ExactSpec {
  kind: "exact";
  /** Any one of these, in canonical form, is a correct answer. */
  accept: string[];
  /** Canonicalizer to apply before comparing. */
  canon: "text" | "sql" | "number";
}

export type GradeSpec = RegexSpec | ExactSpec;

export interface ProvingTask {
  /** Stable slug. Never renumber: results reference it. */
  id: string;
  kind: TaskKind;
  difficulty: Difficulty;
  prompt: string;
  spec: GradeSpec;
}

export interface GradeResult {
  /** Vectors/checks passed. */
  passed: number;
  /** Vectors/checks attempted. Always >= 1. */
  total: number;
  /** passed / total, 0..1. */
  score: number;
  /** True only on a perfect grade. Partial credit is not a pass. */
  correct: boolean;
  /** Human-readable reason, safe to show. Never echoes the answer key. */
  detail: string;
  grader: string;
}

// ── Canonicalizers ───────────────────────────────────────────────────────────

/** Lowercase, collapse whitespace, strip terminal punctuation.
 *  Trim BEFORE stripping punctuation: the anchored `$` will not match through
 *  trailing whitespace, so "Teller.  " would otherwise keep its period. */
export function canonText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;,]+$/g, "")
    .trim();
}

/** SQL-ish canonical form: case-folded, whitespace-collapsed, quotes
 *  normalized, trailing semicolon dropped, space before punctuation removed.
 *  Enough to accept honest formatting variance without accepting a different
 *  query. */
export function canonSql(s: string): string {
  return s
    .toLowerCase()
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/["`]/g, "'")
    .replace(/\s*([(),;*])\s*/g, "$1")
    .replace(/\s*(=|<>|!=|>=|<=|>|<)\s*/g, "$1")
    .replace(/;+$/g, "")
    .trim();
}

/** Pull the first number out and compare numerically, so "42", "42.0" and
 *  "the answer is 42" all agree. Returns null when there is no number. */
export function canonNumber(s: string): string | null {
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  // Normalize -0 and trailing zeros to one representation.
  return String(n === 0 ? 0 : n);
}

function applyCanon(kind: ExactSpec["canon"], s: string): string | null {
  if (kind === "sql") return canonSql(s);
  if (kind === "number") return canonNumber(s);
  return canonText(s);
}

// ── Regex safety ─────────────────────────────────────────────────────────────
//
// Candidate patterns can arrive from an external agent, and running an
// arbitrary pattern is a catastrophic-backtracking risk. JS has no regex
// timeout, so the only real defences available in an edge runtime are refusing
// obviously dangerous shapes and keeping the inputs tiny. Both are applied.
// This is a mitigation, not a proof of safety: a determined adversary can still
// author a slow pattern. Test vectors are capped at MAX_VECTOR_CHARS precisely
// so the blast radius stays bounded.

export const MAX_PATTERN_CHARS = 200;
export const MAX_VECTOR_CHARS = 120;

/** Nested quantifier detection, e.g. (a+)+ or (a*)* or (a|aa)+ — the classic
 *  ReDoS shapes. Conservative: a false positive just rejects a pattern. */
const NESTED_QUANTIFIER = /\([^)]*[+*}][^)]*\)\s*[+*{]/;

export function patternIsSafe(pattern: string): { safe: boolean; reason?: string } {
  if (!pattern) return { safe: false, reason: "empty pattern" };
  if (pattern.length > MAX_PATTERN_CHARS) {
    return { safe: false, reason: `pattern exceeds ${MAX_PATTERN_CHARS} chars` };
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return { safe: false, reason: "nested quantifier rejected (backtracking risk)" };
  }
  return { safe: true };
}

/** Strip a /.../flags wrapper if the agent submitted one, and drop flags we do
 *  not honour. `g` is meaningless for .test() and `i` would let a pattern
 *  sidestep case-sensitive reject vectors, so neither is passed through. */
export function extractPattern(raw: string): string {
  const trimmed = raw.trim();
  // [\s\S] rather than . with the `s` flag: the TS target predates dotAll.
  const m = trimmed.match(/^\/([\s\S]*)\/([a-z]*)$/);
  return (m ? m[1] : trimmed).trim();
}

// ── Graders ──────────────────────────────────────────────────────────────────

function gradeRegex(spec: RegexSpec, response: string): GradeResult {
  const total = spec.accept.length + spec.reject.length;
  const pattern = extractPattern(response);
  const safe = patternIsSafe(pattern);

  if (!safe.safe) {
    return {
      passed: 0, total, score: 0, correct: false,
      detail: safe.reason ?? "unsafe pattern", grader: GRADER_VERSION,
    };
  }

  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    return {
      passed: 0, total, score: 0, correct: false,
      detail: "not a valid regular expression", grader: GRADER_VERSION,
    };
  }

  let passed = 0;
  for (const v of spec.accept) {
    if (re.test(v.slice(0, MAX_VECTOR_CHARS))) passed += 1;
  }
  for (const v of spec.reject) {
    if (!re.test(v.slice(0, MAX_VECTOR_CHARS))) passed += 1;
  }

  return {
    passed, total,
    score: total === 0 ? 0 : passed / total,
    correct: passed === total,
    detail: `${passed}/${total} vectors (${spec.accept.length} accept, ${spec.reject.length} reject)`,
    grader: GRADER_VERSION,
  };
}

function gradeExact(spec: ExactSpec, response: string): GradeResult {
  const got = applyCanon(spec.canon, response);
  const hit =
    got !== null &&
    got !== "" &&
    spec.accept.some((a) => applyCanon(spec.canon, a) === got);

  return {
    passed: hit ? 1 : 0,
    total: 1,
    score: hit ? 1 : 0,
    correct: hit,
    detail: hit ? "exact match on canonical form" : "no canonical-form match",
    grader: GRADER_VERSION,
  };
}

/** The single entry point. Deterministic: same task + same response always
 *  produces the same result, which is what makes a stored grade auditable. */
export function gradeTask(task: ProvingTask, response: string): GradeResult {
  const trimmed = (response ?? "").trim();
  if (!trimmed) {
    const total = task.spec.kind === "regex"
      ? task.spec.accept.length + task.spec.reject.length
      : 1;
    return {
      passed: 0, total, score: 0, correct: false,
      detail: "empty response", grader: GRADER_VERSION,
    };
  }
  return task.spec.kind === "regex"
    ? gradeRegex(task.spec, trimmed)
    : gradeExact(task.spec, trimmed);
}

// ── Task bank ────────────────────────────────────────────────────────────────
//
// Lives in code, not in a table, on purpose. Every recent world on this
// platform shipped blocked on a SQL file only the owner can run, and several
// are still sitting unrun. A code-resident bank needs no migration and no
// seeding step, so this ships live on deploy.
//
// Answer keys are here too. That is acceptable because this bank grades a
// house exhibition ladder whose entrants are our own solver strategies; it is
// NOT a secret-holding assessment of third parties. If external agents are
// ever ranked on these tasks for real stakes, the bank must move server-side
// and out of the client bundle first.

export const TASKS: ProvingTask[] = [
  {
    id: "rx-hex-color",
    kind: "regex",
    difficulty: 1,
    prompt: "Write a regular expression that matches a CSS hex colour: a # followed by exactly 3 or 6 hexadecimal digits, and nothing else.",
    spec: {
      kind: "regex",
      accept: ["#fff", "#FFF", "#a1b2c3", "#000000"],
      reject: ["#ffff", "fff", "#12345", "#ghijkl", "##fff", "#fff "],
    },
  },
  {
    id: "rx-iso-date",
    kind: "regex",
    difficulty: 2,
    prompt: "Write a regular expression that matches an ISO 8601 calendar date in YYYY-MM-DD form, and nothing else. Month must be 01-12 and day 01-31.",
    spec: {
      kind: "regex",
      accept: ["2026-07-26", "1999-01-01", "2000-12-31"],
      reject: ["2026-7-26", "2026-13-01", "2026-00-10", "2026-07-32", "26-07-26", "2026/07/26"],
    },
  },
  {
    id: "rx-doubled-word",
    kind: "regex",
    difficulty: 3,
    prompt: "Write a regular expression that finds a word repeated twice in a row, separated by a single space (for example 'the the'). Use a backreference.",
    spec: {
      kind: "regex",
      accept: ["the the", "we found found it", "no no"],
      reject: ["the that", "then the", "one two three"],
    },
  },
  {
    id: "rx-no-leading-zero",
    kind: "regex",
    difficulty: 2,
    prompt: "Write a regular expression matching a non-negative integer with no leading zeros: 0 itself is valid, 007 is not. Match the whole string only.",
    spec: {
      kind: "regex",
      accept: ["0", "7", "42", "1000"],
      reject: ["007", "00", "-1", "1.5", "", " 42"],
    },
  },
  {
    id: "sql-count-by-status",
    kind: "sql",
    difficulty: 1,
    prompt: "Table orders(id, status). Write a query returning each status and how many orders have it, as columns status and n.",
    spec: {
      kind: "exact",
      canon: "sql",
      accept: [
        "select status, count(*) as n from orders group by status",
        "select status, count(*) n from orders group by status",
        "select status, count(id) as n from orders group by status",
        "select orders.status, count(*) as n from orders group by orders.status",
      ],
    },
  },
  {
    id: "sql-second-highest",
    kind: "sql",
    difficulty: 3,
    prompt: "Table salaries(id, amount). Return the second highest DISTINCT amount, aliased as amount. Use OFFSET.",
    spec: {
      kind: "exact",
      canon: "sql",
      accept: [
        "select distinct amount from salaries order by amount desc limit 1 offset 1",
        "select distinct amount as amount from salaries order by amount desc limit 1 offset 1",
        "select distinct amount from salaries order by amount desc offset 1 limit 1",
      ],
    },
  },
  {
    id: "sql-left-join-orphans",
    kind: "sql",
    difficulty: 2,
    prompt: "Tables users(id) and orders(id, user_id). Return every users.id that has no matching orders row, aliased as id, using a LEFT JOIN.",
    spec: {
      kind: "exact",
      canon: "sql",
      accept: [
        "select users.id from users left join orders on orders.user_id=users.id where orders.id is null",
        "select u.id from users u left join orders o on o.user_id=u.id where o.id is null",
        "select users.id as id from users left join orders on orders.user_id=users.id where orders.id is null",
      ],
    },
  },
  {
    id: "logic-knights-knaves",
    kind: "logic",
    difficulty: 2,
    prompt: "On an island every inhabitant either always tells the truth or always lies. A says 'we are both liars', speaking of A and B. What is B? Answer with one word: truthteller or liar.",
    // If A were a truthteller the statement would be true, making A a liar:
    // contradiction. So A lies. "Both liars" is false, and since A IS a liar,
    // B must not be, so B tells the truth.
    spec: { kind: "exact", canon: "text", accept: ["truthteller", "truth teller", "truth-teller"] },
  },
  {
    id: "logic-monty",
    kind: "logic",
    difficulty: 2,
    prompt: "Three doors, one prize. You pick door 1. The host, who knows where the prize is, opens door 3 to reveal no prize, and offers a switch to door 2. What is your probability of winning if you switch? Answer as a fraction in lowest terms.",
    spec: { kind: "exact", canon: "text", accept: ["2/3"] },
  },
  {
    id: "logic-bat-ball",
    kind: "arith",
    difficulty: 1,
    prompt: "A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How many cents does the ball cost? Answer with a number only.",
    spec: { kind: "exact", canon: "number", accept: ["5"] },
  },
  {
    id: "arith-compound",
    kind: "arith",
    difficulty: 2,
    prompt: "A lily pad patch doubles in size every day and covers the whole lake on day 48. On which day does it cover half the lake? Answer with a number only.",
    spec: { kind: "exact", canon: "number", accept: ["47"] },
  },
  {
    id: "arith-machines",
    kind: "arith",
    difficulty: 2,
    prompt: "If 5 machines take 5 minutes to make 5 widgets, how many minutes do 100 machines take to make 100 widgets? Answer with a number only.",
    spec: { kind: "exact", canon: "number", accept: ["5"] },
  },
  {
    id: "units-throughput",
    kind: "units",
    difficulty: 2,
    prompt: "An API is billed at $0.25 per million input tokens. A request sends 4,000 input tokens. What is the cost in dollars, to four decimal places? Answer with a number only.",
    spec: { kind: "exact", canon: "number", accept: ["0.001"] },
  },
  {
    id: "units-latency-budget",
    kind: "units",
    difficulty: 3,
    prompt: "A request fans out to 3 sequential services at 40ms, 65ms and 120ms, plus 25ms of fixed overhead. What is the total latency in milliseconds? Answer with a number only.",
    spec: { kind: "exact", canon: "number", accept: ["250"] },
  },
];

export function taskById(id: string): ProvingTask | undefined {
  return TASKS.find((t) => t.id === id);
}

export function tasksByKind(kind: TaskKind): ProvingTask[] {
  return TASKS.filter((t) => t.kind === kind);
}
