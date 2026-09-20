"use client";

// ── The Like Test, the interactive half ──────────────────────────────────────
// The question and its answer are both in the page already. This adds the click,
// the reveal, and a streak counter.
//
// Everything a reader does here stays in their own browser. No fetch, no route,
// no row, no cookie: their guess is React state and their streak is one
// localStorage key. That is a deliberate limit, not a stage one. A daily habit
// hook that also collected behaviour would need a privacy note, a table and a
// retention policy, for a publication whose whole design is that it stores as
// little about people as it can.
//
// localStorage can throw outright (private windows, blocked site data) and can
// come back empty, so every read and write is wrapped and the component renders
// correctly with no storage at all.

import { useEffect, useState } from "react";
import { v2 } from "@/components/v2/tokens";
import { formatCount, youtubeWatchUrl } from "@/lib/comments/render-helpers";
import type { LikeTest } from "@/lib/comments/like-test";

const KEY = "cs-like-test";

interface Progress {
  /** Edition date of the last question answered. */
  last: string;
  streak: number;
  played: number;
  correct: number;
}

function readProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Progress>;
    if (typeof p.last !== "string" || typeof p.streak !== "number") return null;
    return {
      last: p.last,
      streak: p.streak,
      played: typeof p.played === "number" ? p.played : 0,
      correct: typeof p.correct === "number" ? p.correct : 0,
    };
  } catch {
    return null;
  }
}

function writeProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private window or blocked storage. The question still works.
  }
}

/** Yesterday, relative to a YYYY-MM-DD string, for the streak check. */
function dayBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

export function LikeTest({ test, editionDate }: { test: LikeTest; editionDate: string }) {
  const [guess, setGuess] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount: the server has no idea what this reader has done, and
  // rendering from storage on the first pass would be a hydration mismatch.
  useEffect(() => {
    const p = readProgress();
    setProgress(p);
    if (p?.last === editionDate) setGuess(-1); // already played today
    setReady(true);
  }, [editionDate]);

  function choose(i: number) {
    if (guess !== null) return;
    setGuess(i);

    const wasCorrect = i === test.answer;
    const prev = readProgress();
    const continues = prev && prev.last === dayBefore(editionDate);
    const next: Progress = {
      last: editionDate,
      streak: wasCorrect ? (continues ? prev.streak + 1 : 1) : 0,
      played: (prev?.played ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (wasCorrect ? 1 : 0),
    };
    writeProgress(next);
    setProgress(next);
  }

  const revealed = guess !== null;
  const correct = guess === test.answer;

  return (
    <div className={v2.cardStatic}>
      <p className={v2.kicker}>The like test</p>
      <h3 className={`${v2.h3} mt-3`}>
        Three comments from the same video. Which one got the most likes?
      </h3>
      <p className={`${v2.bodySm} mt-2`}>
        All three sat under{" "}
        <a
          href={youtubeWatchUrl(test.videoId)}
          className="text-cyan-300 transition-colors hover:text-cyan-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          {test.videoTitle}
        </a>{" "}
        by {test.channelTitle}, so they had the same audience and the same
        chance.
      </p>

      <ul className="mt-6 space-y-3">
        {test.choices.map((c, i) => {
          const isAnswer = i === test.answer;
          const chosen = i === guess;
          return (
            <li key={c.commentId}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={revealed}
                aria-label={`Comment by ${c.author ?? "unknown"}`}
                className={`w-full rounded-md border p-4 text-left transition-colors ${
                  revealed
                    ? isAnswer
                      ? "border-cyan-400/60 bg-cyan-400/[0.06]"
                      : chosen
                        ? "border-amber-400/40 bg-white/[0.02]"
                        : "border-white/[0.08] bg-white/[0.01] opacity-60"
                    : "border-white/[0.12] bg-white/[0.02] hover:border-cyan-400/40"
                } ${revealed ? "cursor-default" : "cursor-pointer"}`}
              >
                <span className="block text-sm text-zinc-200">{c.text}</span>
                <span className="mt-2 block font-mono text-[11px] text-zinc-500">
                  {c.author}
                  {revealed && (
                    <span className={isAnswer ? "text-cyan-300" : "text-zinc-400"}>
                      {"  "}
                      {formatCount(c.likes)} {c.likes === 1 ? "like" : "likes"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {revealed && (
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          {guess === -1 ? (
            <p className={v2.bodySm}>You already took today&apos;s test. The answer is marked above.</p>
          ) : (
            <p className="font-mono text-sm text-zinc-200">
              {correct ? "Right." : "Not that one."}{" "}
              <span className="text-zinc-400">
                {test.choices[test.answer].likes > 0 &&
                  `The winner took ${formatCount(test.choices[test.answer].likes)} likes. `}
                Our pick for funniest got{" "}
                {formatCount(Math.min(...test.choices.map((c) => c.likes)))}.
              </span>
            </p>
          )}
          {ready && progress && progress.played > 0 && (
            <p className="mt-2 font-mono text-[11px] text-zinc-600">
              {progress.streak > 1
                ? `${progress.streak} days in a row. `
                : ""}
              {progress.correct} right out of {progress.played}. Kept in this browser only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
