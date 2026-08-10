"use client";

import { useState } from "react";
import { buildScorecard, type Scorecard } from "@/lib/crucible/scorecard";
import type { CrucibleSnapshot } from "@/lib/crucible/data";

// ── The last bout, read out ──────────────────────────────────────────────────
//
// Travis: "if there was a duel then we would want insight into that on the
// screen to see actions, points, score, winner, etc."
//
// All four already existed in `arena_duels`; the world was reading three
// columns of it. This panel is the readout, and it is DOM rather than in-canvas
// on purpose — it is dense text, and text belongs in text, where it can be
// selected, scrolled, read by a screen reader and crawled by an agent.
//
// Everything about what a score is ALLOWED to say lives in
// lib/crucible/scorecard.ts, which is pure and tested. This file only renders
// what that returns. The important consequence: when `scores` is null it is not
// a missing value to paper over with a dash or a zero — it is the row telling
// us nobody judged this bout, and the panel has to say so in words.

const VERDICT_STYLE: Record<Scorecard["verdict"], { label: string; className: string }> = {
  decided: { label: "decided", className: "text-orange-200 border-orange-500/40" },
  sudden_death: { label: "sudden death", className: "text-amber-200 border-amber-400/40" },
  tie: { label: "tie", className: "text-sky-200 border-sky-400/40" },
  unjudged: { label: "unjudged", className: "text-zinc-300 border-zinc-500/40" },
};

function Bar({ value, mine }: { value: number; mine: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={mine ? "h-full bg-orange-400/80" : "h-full bg-sky-400/70"}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Side({
  name,
  score,
  took,
  elo,
  response,
  isWinner,
  mine,
}: {
  name: string;
  score: number | null;
  took: number | null;
  elo: number | null;
  response: string | null;
  isWinner: boolean;
  mine: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate ${isWinner ? "text-orange-100" : "text-orange-200/60"}`}>
          {name}
          {isWinner && <span className="ml-1 text-[9px] uppercase tracking-[0.2em]">won</span>}
        </span>
        <span className="shrink-0 tabular-nums text-orange-100">
          {score === null ? "--" : score.toFixed(0)}
        </span>
      </div>
      {score !== null && <Bar value={score} mine={mine} />}
      <div className="flex items-baseline justify-between gap-2 text-[9px] text-orange-200/40">
        <span>{took === null ? "no submission time" : `answered in ${took}s`}</span>
        {elo !== null && (
          <span className="tabular-nums">
            {elo > 0 ? "+" : ""}
            {elo} elo
          </span>
        )}
      </div>
      {response && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left text-[9px] uppercase tracking-[0.18em] text-orange-300/50 hover:text-orange-200"
        >
          {open ? "hide answer" : "read answer"}
        </button>
      )}
      {open && response && (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-orange-900/30 bg-black/50 p-2 text-[10px] leading-relaxed text-orange-100/80">
          {response}
        </p>
      )}
    </div>
  );
}

export default function DuelReadout({ state }: { state: CrucibleSnapshot }) {
  const [showPrompt, setShowPrompt] = useState(false);

  // A live bout outranks a finished one: what is happening beats what happened.
  if (state.active_duel) {
    return (
      <div className="pointer-events-auto absolute bottom-4 left-[92px] z-30 w-[290px] sm:left-24 rounded-lg border border-orange-500/40 bg-black/80 p-3 font-mono text-[11px] backdrop-blur-sm">
        <p className="mb-2 text-[9px] uppercase tracking-[0.24em] text-orange-300/70">
          bout under way
        </p>
        <p className="text-orange-100">{state.active_duel.challenger}</p>
        <p className="my-0.5 text-[9px] uppercase tracking-[0.2em] text-orange-200/40">versus</p>
        <p className="text-orange-100">{state.active_duel.defender}</p>
        <p className="mt-2 border-t border-orange-900/30 pt-2 text-[10px] text-orange-200/60">
          {state.active_duel.status === "judging"
            ? "Both answers are in. The jury is scoring them in both presentation orders."
            : state.active_duel.status === "sudden_death"
              ? "The jury split. It has gone to a sudden-death puzzle with a verifiable answer."
              : "Waiting on answers."}
        </p>
      </div>
    );
  }

  if (!state.last_duel) {
    return (
      <div className="pointer-events-none absolute bottom-4 left-[92px] z-30 w-[290px] sm:left-24 rounded-lg border border-zinc-600/30 bg-black/70 p-3 font-mono text-[11px] backdrop-blur-sm">
        <p className="text-[9px] uppercase tracking-[0.24em] text-zinc-400/70">the floor</p>
        <p className="mt-1 text-[10px] text-zinc-300/70">
          No bout has finished here yet. The span is empty, which is the truth
          rather than a loading state.
        </p>
      </div>
    );
  }

  const card = buildScorecard(state.last_duel);
  const style = VERDICT_STYLE[card.verdict];

  return (
    <div className="pointer-events-auto absolute bottom-4 left-[92px] z-30 max-h-[46vh] w-[290px] sm:left-24 overflow-y-auto rounded-lg border border-orange-900/40 bg-black/80 p-3 font-mono text-[11px] backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.24em] text-orange-300/70">last bout</p>
        <span
          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${style.className}`}
        >
          {style.label}
        </span>
      </div>

      {card.prompt && (
        <>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="w-full text-left text-[9px] uppercase tracking-[0.18em] text-orange-300/50 hover:text-orange-200"
          >
            {showPrompt ? "hide the question" : "the question"}
          </button>
          {showPrompt && (
            <p className="mb-2 mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-orange-900/30 bg-black/50 p-2 text-[10px] leading-relaxed text-orange-100/80">
              {card.prompt}
            </p>
          )}
        </>
      )}

      <div className="mt-2 space-y-3">
        <Side
          name={card.challenger}
          score={card.scores?.challenger ?? null}
          took={card.took.challenger}
          elo={card.elo.challenger}
          response={card.responses.challenger}
          isWinner={card.winner === card.challenger}
          mine
        />
        <Side
          name={card.defender}
          score={card.scores?.defender ?? null}
          took={card.took.defender}
          elo={card.elo.defender}
          response={card.responses.defender}
          isWinner={card.winner === card.defender}
          mine={false}
        />
      </div>

      {/* Points. Each dimension's weight is shown because a 9-6 on creativity
          moves the total less than a 7-6 on reasoning, and a breakdown that
          hides that invites the wrong conclusion. */}
      {card.rubric.length > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-orange-900/30 pt-2">
          <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-orange-200/40">points</p>
          {card.rubric.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className="text-orange-200/50">
                {r.label}
                <span className="ml-1 text-[8px] text-orange-200/30">
                  x{r.weight.toFixed(2)}
                </span>
              </span>
              <span className="tabular-nums text-orange-100">
                {r.challenger}
                <span className="mx-1 text-orange-200/30">/</span>
                {r.defender}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The note is never optional. On an unjudged or flipped bout it is the
          only thing standing between a fallback number and a false result. */}
      <p className="mt-3 border-t border-orange-900/30 pt-2 text-[10px] leading-relaxed text-orange-200/60">
        {card.note}
      </p>

      <div className="mt-2 space-y-0.5 text-[9px] text-orange-200/35">
        {card.judgedBy && (
          <p>
            judged by {card.judgedBy}
            {card.passes !== null && ` · ${card.passes} passes`}
          </p>
        )}
        {card.stake !== null && <p>stake {card.stake} cr</p>}
        <p>{state.duels_24h} bouts finished in the last 24h</p>
      </div>
    </div>
  );
}
