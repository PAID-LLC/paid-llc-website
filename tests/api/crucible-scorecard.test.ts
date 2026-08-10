/**
 * Tests for lib/crucible/scorecard.ts — the arena floor's duel readout.
 *
 * Every test here is an honesty test, because a scoreboard is the easiest place
 * on this whole platform to launder a weak result into a confident one. The
 * rule being pinned: a scorecard may never be more confident than the row it
 * was built from.
 *
 * The two failure modes that matter both already bit this arena once:
 *   - unjudged rows carry neutral fallback numbers that are not an evaluation
 *   - a winner that flips when the presentation order flips is a real tie
 */

import { describe, expect, it } from "vitest";
import { buildScorecard } from "@/lib/crucible/scorecard";
import type { FinishedDuel } from "@/lib/crucible/data";
import type { JuryScores } from "@/lib/arena-types";

function dim(c: number, d: number, weight: number) {
  return {
    challenger_score: c,
    defender_score: d,
    winner: c === d ? ("tie" as const) : c > d ? ("challenger" as const) : ("defender" as const),
    weight,
  };
}

function jury(over: Partial<JuryScores> = {}): JuryScores {
  return {
    challenger: 78,
    defender: 61,
    rubric: {
      reasoning: dim(8, 6, 0.25),
      accuracy: dim(8, 7, 0.25),
      depth: dim(7, 6, 0.2),
      creativity: dim(8, 5, 0.15),
      coherence: dim(8, 7, 0.15),
    },
    judged: true,
    judge_source: "gemini-2.0-flash",
    order_consistent: true,
    judge_passes: 2,
    ...over,
  };
}

function duel(over: Partial<FinishedDuel> = {}): FinishedDuel {
  return {
    challenger: "Arti",
    defender: "RoastBot",
    prompt: "Defend a position you find distasteful.",
    challenger_response: "The challenger's answer.",
    defender_response: "The defender's answer.",
    jury_scores: jury(),
    winner: "Arti",
    loser: "RoastBot",
    sudden_death: false,
    sd_winner: null,
    challenger_elo_delta: 16,
    defender_elo_delta: -16,
    stake_credits: 5,
    duel_started_at: "2026-08-10T12:00:00Z",
    challenger_submitted_at: "2026-08-10T12:00:42Z",
    defender_submitted_at: "2026-08-10T12:01:05Z",
    ...over,
  };
}

describe("a decided bout", () => {
  it("reports the winner, the scores and the rubric", () => {
    const card = buildScorecard(duel());
    expect(card.verdict).toBe("decided");
    expect(card.winner).toBe("Arti");
    expect(card.scores).toEqual({ challenger: 78, defender: 61 });
    expect(card.rubric).toHaveLength(5);
    expect(card.rubric.map((r) => r.label)).toEqual([
      "reasoning",
      "accuracy",
      "depth",
      "creativity",
      "coherence",
    ]);
  });

  it("carries the work, not just the verdict", () => {
    // A score with no visible work behind it is unfalsifiable. The prompt and
    // both answers travel with it.
    const card = buildScorecard(duel());
    expect(card.prompt).toContain("distasteful");
    expect(card.responses.challenger).toBe("The challenger's answer.");
    expect(card.responses.defender).toBe("The defender's answer.");
  });

  it("times each side from the bout's own start", () => {
    const card = buildScorecard(duel());
    expect(card.took).toEqual({ challenger: 42, defender: 65 });
  });

  it("names the judge and how many passes returned a usable rubric", () => {
    const card = buildScorecard(duel());
    expect(card.judgedBy).toBe("gemini-2.0-flash");
    expect(card.passes).toBe(2);
  });

  it("carries the Elo movement and the stake", () => {
    const card = buildScorecard(duel());
    expect(card.elo).toEqual({ challenger: 16, defender: -16 });
    expect(card.stake).toBe(5);
  });
});

describe("a bout nobody judged", () => {
  it("withholds the scores rather than printing the fallback", () => {
    // `judged` false means the numbers on the row were never an evaluation.
    const card = buildScorecard(duel({ jury_scores: jury({ judged: false }) }));
    expect(card.verdict).toBe("unjudged");
    expect(card.scores).toBeNull();
    expect(card.rubric).toEqual([]);
  });

  it("treats a legacy row with no provenance the same way", () => {
    const { judged: _drop, ...legacy } = jury();
    const card = buildScorecard(duel({ jury_scores: legacy as JuryScores }));
    expect(card.verdict).toBe("unjudged");
    expect(card.scores).toBeNull();
  });

  it("declares no winner, even though the row names one", () => {
    // This is the whole point. The row says Arti won; nothing scored it.
    const row = duel({ jury_scores: jury({ judged: false }) });
    expect(row.winner).toBe("Arti");
    expect(buildScorecard(row).winner).toBeNull();
  });

  it("survives a row with no jury_scores at all", () => {
    const card = buildScorecard(duel({ jury_scores: null }));
    expect(card.verdict).toBe("unjudged");
    expect(card.scores).toBeNull();
    expect(card.judgedBy).toBeNull();
  });

  it("says why, in words, rather than leaving a blank", () => {
    const card = buildScorecard(duel({ jury_scores: jury({ judged: false }) }));
    expect(card.note).toMatch(/no judge/i);
    expect(card.note.length).toBeGreaterThan(20);
  });
});

describe("a bout whose winner flipped with the presentation order", () => {
  it("is a tie, not a win for the challenger", () => {
    // LLM judges prefer whatever they read first, which is why every bout is
    // judged twice with the order reversed. A flip means the judge cannot
    // separate them. Resolving it in favour of the challenger is the exact bug
    // the double-judging exists to prevent.
    const card = buildScorecard(duel({ jury_scores: jury({ order_consistent: false }) }));
    expect(card.verdict).toBe("tie");
    expect(card.winner).toBeNull();
  });

  it("still shows the scores — they were judged, they just disagree", () => {
    const card = buildScorecard(duel({ jury_scores: jury({ order_consistent: false }) }));
    expect(card.scores).toEqual({ challenger: 78, defender: 61 });
    expect(card.rubric).toHaveLength(5);
  });

  it("explains the flip rather than just showing a dash", () => {
    const card = buildScorecard(duel({ jury_scores: jury({ order_consistent: false }) }));
    expect(card.note).toMatch(/order/i);
  });

  it("outranks sudden death — an unreliable judge cannot send a bout to one", () => {
    const card = buildScorecard(
      duel({ sudden_death: true, sd_winner: "RoastBot", jury_scores: jury({ order_consistent: false }) })
    );
    expect(card.verdict).toBe("tie");
    expect(card.winner).toBeNull();
  });
});

describe("a bout settled by sudden death", () => {
  it("credits the puzzle winner, not the jury leader", () => {
    const card = buildScorecard(
      duel({ sudden_death: true, sd_winner: "RoastBot", winner: "RoastBot" })
    );
    expect(card.verdict).toBe("sudden_death");
    expect(card.winner).toBe("RoastBot");
    expect(card.note).toMatch(/verifiable/i);
  });
});

describe("missing pieces", () => {
  it("reports no timing when a side never submitted", () => {
    const card = buildScorecard(duel({ defender_submitted_at: null }));
    expect(card.took.challenger).toBe(42);
    expect(card.took.defender).toBeNull();
  });

  it("never returns a negative duration from clock skew", () => {
    const card = buildScorecard(duel({ challenger_submitted_at: "2026-08-10T11:59:00Z" }));
    expect(card.took.challenger).toBeNull();
  });
});
