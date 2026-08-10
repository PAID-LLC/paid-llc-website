// ── What a finished bout is allowed to say about itself ──────────────────────
//
// Travis asked to see "actions, points, score, winner" on the arena floor. All
// of it is already in `arena_duels` — but three of those four are claims about
// an evaluation, and `arena_duels` also stores exactly what it knows about how
// trustworthy that evaluation is. This module is the join between them, kept
// pure so the rules are testable rather than tangled into a component.
//
// Two provenance fields decide everything, and both exist because of real bugs
// this arena already had:
//
//   `judged` is true only when an LLM judge actually scored the bout. When it
//   is false or absent (legacy rows), the numbers in `jury_scores` are a
//   NEUTRAL FALLBACK — they were never an evaluation. Printing them next to the
//   word "score" would manufacture a result out of a default value. The Lathe
//   already learned the same lesson the hard way: flat-50 arena scores were
//   stale fabricated duels, and the arena was changed to fail honestly instead.
//
//   `order_consistent` false means the winner FLIPPED when the presentation
//   order was swapped. Every bout is judged twice with the order reversed
//   precisely because LLM judges prefer whatever they read first. A flip is the
//   judge telling us it cannot separate these two answers. That is a TIE. It is
//   not a win for whoever happened to be the challenger, and resolving it that
//   way is the exact bug the double-judging was added to fix.
//
// The rule this module enforces: a scoreboard may never be more confident than
// the row it was built from.

import type { DuelRubric, JuryScores } from "@/lib/arena-types";
import type { FinishedDuel } from "@/lib/crucible/data";

export type Verdict = "decided" | "tie" | "sudden_death" | "unjudged";

export interface RubricLine {
  label: string;
  /** Contribution to the weighted total, 0..1. */
  weight: number;
  challenger: number;
  defender: number;
  winner: "challenger" | "defender" | "tie";
}

export interface Scorecard {
  challenger: string;
  defender: string;
  /** The prompt both sides answered. */
  prompt: string | null;
  /** What each side actually wrote. This is the "actions" half of the readout:
   *  a score with no visible work behind it is unfalsifiable. */
  responses: { challenger: string | null; defender: string | null };
  /** Seconds each side took to submit, when both timestamps exist. */
  took: { challenger: number | null; defender: number | null };
  /**
   * Weighted totals, 0-100 — or NULL when they must not be shown as an
   * evaluation. Null is not "missing data"; it is the row telling us nobody
   * judged this.
   */
  scores: { challenger: number; defender: number } | null;
  /** Per-dimension breakdown. Empty when the scores are not showable. */
  rubric: RubricLine[];
  verdict: Verdict;
  /** Null on a tie and on an unjudged bout, whatever `winner` said. */
  winner: string | null;
  /** Shown verbatim next to the verdict. Never omitted. */
  note: string;
  elo: { challenger: number | null; defender: number | null };
  stake: number | null;
  /** Which model(s) judged, when one did. */
  judgedBy: string | null;
  /** How many judge passes returned a usable rubric. */
  passes: number | null;
}

const RUBRIC_ORDER: { key: keyof DuelRubric; label: string }[] = [
  { key: "reasoning", label: "reasoning" },
  { key: "accuracy", label: "accuracy" },
  { key: "depth", label: "depth" },
  { key: "creativity", label: "creativity" },
  { key: "coherence", label: "coherence" },
];

function rubricLines(scores: JuryScores | null): RubricLine[] {
  const r = scores?.rubric;
  if (!r) return [];
  const out: RubricLine[] = [];
  for (const { key, label } of RUBRIC_ORDER) {
    const dim = r[key];
    if (!dim) continue;
    out.push({
      label,
      weight: dim.weight,
      challenger: dim.challenger_score,
      defender: dim.defender_score,
      winner: dim.winner,
    });
  }
  return out;
}

function seconds(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = (b - a) / 1000;
  return d >= 0 ? Math.round(d) : null;
}

export function buildScorecard(duel: FinishedDuel): Scorecard {
  const jury = duel.jury_scores;
  const judged = jury?.judged === true;
  const flipped = jury?.order_consistent === false;

  let verdict: Verdict;
  let winner: string | null;
  let note: string;

  if (!judged) {
    // No judge ever ran. Whatever numbers are on the row are a default.
    verdict = "unjudged";
    winner = null;
    note =
      "No judge scored this bout, so it carries no result. The numbers stored " +
      "against it are a neutral fallback, not an evaluation.";
  } else if (flipped) {
    verdict = "tie";
    winner = null;
    note =
      "Judged twice with the answers presented in both orders, and the winner " +
      "changed when the order did. The judge cannot separate these two, so it " +
      "stands as a tie.";
  } else if (duel.sudden_death) {
    verdict = "sudden_death";
    winner = duel.sd_winner ?? duel.winner;
    note = "The jury split, so it went to a sudden-death puzzle with a verifiable answer.";
  } else {
    verdict = "decided";
    winner = duel.winner;
    note = "Judged in both presentation orders with the same winner each time.";
  }

  return {
    challenger: duel.challenger,
    defender: duel.defender,
    prompt: duel.prompt,
    responses: {
      challenger: duel.challenger_response,
      defender: duel.defender_response,
    },
    took: {
      challenger: seconds(duel.duel_started_at, duel.challenger_submitted_at),
      defender: seconds(duel.duel_started_at, duel.defender_submitted_at),
    },
    // Withheld, not zeroed. A caller that renders `scores` has to handle null,
    // which is the point — there is no value here that could be printed under
    // the heading "score" without lying.
    scores: judged && jury ? { challenger: jury.challenger, defender: jury.defender } : null,
    rubric: judged ? rubricLines(jury) : [],
    verdict,
    winner,
    note,
    elo: { challenger: duel.challenger_elo_delta, defender: duel.defender_elo_delta },
    stake: duel.stake_credits,
    judgedBy: judged ? (jury?.judge_source ?? null) : null,
    passes: judged ? (jury?.judge_passes ?? null) : null,
  };
}
