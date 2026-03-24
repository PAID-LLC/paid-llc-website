"use client";

import type { ArenaStreamEvent, DuelStatus, DuelRubric, SelfEvalSummary } from "@/lib/arena-types";

// ── Recommendation engine ─────────────────────────────────────────────────────
// Rule-based — computes from existing rubric scores, no extra API call.

const DIM_CONTEXT: Record<keyof DuelRubric, string> = {
  reasoning:  "structured argument duels",
  accuracy:   "fact-intensive technical prompts",
  depth:      "long-form analysis challenges",
  creativity: "open-ended generative prompts",
  coherence:  "rapid-response team formats",
};

function computeRecommendation(rubric: DuelRubric, total: number, agent: "challenger" | "defender"): string {
  const scoreKey = `${agent}_score` as const;
  const sorted = (["reasoning", "accuracy", "depth", "creativity", "coherence"] as (keyof DuelRubric)[])
    .sort((a, b) => rubric[b][scoreKey] - rubric[a][scoreKey]);
  const top  = sorted[0];
  const weak = sorted[sorted.length - 1];

  const modeRec = total >= 75 ? "TEAM DUEL"
    : total >= 55             ? "COMPETITIVE DUEL"
    :                           "SELF-EVALUATION";

  const topScore  = rubric[top][scoreKey].toFixed(1);
  const weakScore = rubric[weak][scoreKey].toFixed(1);

  return `BEST FIT → ${modeRec} | ${top} (${topScore}) excels in ${DIM_CONTEXT[top]}. Strengthen ${weak} (${weakScore}) for higher-tier play.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bar(score: number, color: string) {
  const n = Math.min(5, Math.max(0, Math.round((score / 10) * 5)));
  return (
    <span style={{ color, letterSpacing: "-1px" }}>
      {"█".repeat(n) + "░".repeat(5 - n)}
    </span>
  );
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function truncate(text: string, chars: number): string {
  return text.length > chars ? text.slice(0, chars) + "…" : text;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  return mins < 1 ? "just now" : `${mins}m ago`;
}

// ── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<DuelStatus, string> = {
  pending:      "// ARENA — PENDING",
  judging:      "// ARENA — RESPONSES IN",
  sudden_death: "// SUDDEN DEATH — SCORES TIED",
  complete:     "// DUEL COMPLETE",
};

const PHASE_COLOR: Record<DuelStatus, string> = {
  pending:      "#555",
  judging:      "#AA8800",
  sudden_death: "#C14826",
  complete:     "#3A7A3A",
};

// ── Shared header ─────────────────────────────────────────────────────────────

function Header({ state }: { state: ArenaStreamEvent }) {
  return (
    <>
      <p style={{
        fontSize: "9px", color: PHASE_COLOR[state.status],
        letterSpacing: "0.12em", fontFamily: "monospace",
        textTransform: "uppercase", marginBottom: "10px",
      }}>
        {PHASE_LABEL[state.status]}
      </p>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "10px", color: "#E8E4E0", fontFamily: "monospace",
        marginBottom: "10px",
      }}>
        <span>{state.challenger}</span>
        <span style={{ color: "#333" }}>vs</span>
        <span>{state.defender}</span>
      </div>
    </>
  );
}

// ── Phase: pending ────────────────────────────────────────────────────────────

function PendingPhase({ state }: { state: ArenaStreamEvent }) {
  return (
    <>
      <p style={{
        fontSize: "8px", color: "#555", letterSpacing: "0.1em",
        fontFamily: "monospace", textTransform: "uppercase", marginBottom: "4px",
      }}>PROMPT</p>
      <p style={{
        fontSize: "10px", color: "#888", fontFamily: "monospace",
        lineHeight: "1.5", maxHeight: "48px", overflow: "hidden", marginBottom: "16px",
      }}>
        {truncate(state.prompt, 120)}
      </p>
      <p style={{
        fontSize: "9px", color: "#333", fontFamily: "monospace",
        animation: "arena-pulse 1.5s ease-in-out infinite",
      }}>
        ● awaiting responses
      </p>
    </>
  );
}

// ── Phase: judging ────────────────────────────────────────────────────────────

function JudgingPhase({ state }: { state: ArenaStreamEvent }) {
  const agents = [
    { name: state.challenger, text: state.challenger_response,
      ms: state.challenger_response_ms, wc: state.challenger_word_count },
    { name: state.defender,   text: state.defender_response,
      ms: state.defender_response_ms,   wc: state.defender_word_count },
  ];

  return (
    <>
      <p style={{
        fontSize: "8px", color: "#555", letterSpacing: "0.1em",
        fontFamily: "monospace", textTransform: "uppercase", marginBottom: "4px",
      }}>PROMPT</p>
      <p style={{
        fontSize: "10px", color: "#888", fontFamily: "monospace",
        lineHeight: "1.5", maxHeight: "32px", overflow: "hidden", marginBottom: "12px",
      }}>
        {truncate(state.prompt, 80)}
      </p>

      <p style={{
        fontSize: "8px", color: "#555", letterSpacing: "0.1em",
        fontFamily: "monospace", textTransform: "uppercase", marginBottom: "6px",
      }}>RESPONSES</p>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {agents.map(({ name, text }) => (
          <div key={name} style={{
            width: "144px", height: "54px", padding: "6px",
            border: "1px solid #1A1A1A", overflow: "hidden",
            fontSize: "9px", color: "#666", fontFamily: "monospace", lineHeight: "1.5",
            flexShrink: 0,
          }}>
            {text
              ? truncate(text, 100)
              : <span style={{ color: "#2A2A2A" }}>waiting…</span>
            }
          </div>
        ))}
      </div>

      {[
        { label: "SPEED", vals: agents.map(a => fmtMs(a.ms)) },
        { label: "WORDS", vals: agents.map(a => String(a.wc ?? "—")) },
      ].map(({ label, vals }) => (
        <div key={label} style={{
          display: "flex", gap: "8px", fontFamily: "monospace", marginBottom: "4px",
        }}>
          <span style={{ width: "40px", color: "#555", fontSize: "8px" }}>{label}</span>
          <span style={{ width: "60px", color: "#999", fontSize: "9px" }}>{vals[0]}</span>
          <span style={{ color: "#999", fontSize: "9px" }}>{vals[1]}</span>
        </div>
      ))}

      <p style={{
        fontSize: "9px", color: "#333", fontFamily: "monospace", marginTop: "10px",
        animation: "arena-pulse 1.5s ease-in-out infinite",
      }}>
        ● gemini judging
      </p>
    </>
  );
}

// ── Phase: complete ───────────────────────────────────────────────────────────

const DIM_ORDER: (keyof DuelRubric)[] = ["reasoning", "accuracy", "depth", "creativity", "coherence"];

function CompletePhase({ state }: { state: ArenaStreamEvent }) {
  const scores = state.jury_scores;
  const rubric = scores?.rubric;

  const chDelta  = state.challenger_elo_delta;
  const defDelta = state.defender_elo_delta;

  return (
    <>
      {/* Winner banner */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: "12px",
      }}>
        <span style={{ fontSize: "12px", color: "#E8E4E0", fontFamily: "monospace", fontWeight: "bold" }}>
          ★ {state.winner} WINS
        </span>
        <span style={{ fontSize: "9px", color: "#555", fontFamily: "monospace" }}>
          {state.loser}
          {state.sd_winner && <span style={{ color: "#444" }}> (sd)</span>}
        </span>
      </div>

      {/* Dimension breakdown */}
      {rubric && (
        <>
          <p style={{
            fontSize: "8px", color: "#555", fontFamily: "monospace",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px",
          }}>DIMENSION BREAKDOWN</p>

          {DIM_ORDER.map((dim) => {
            const d = rubric[dim];
            return (
              <div key={dim} style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontFamily: "monospace", marginBottom: "3px", lineHeight: "14px",
              }}>
                <span style={{ width: "72px", color: "#555", fontSize: "8px" }}>{dim}</span>
                {bar(d.challenger_score, "#C14826")}
                <span style={{ width: "26px", color: "#999", fontSize: "9px", textAlign: "right" }}>
                  {d.challenger_score.toFixed(1)}
                </span>
                <span style={{ width: "4px" }} />
                {bar(d.defender_score, "#4A9ECC")}
                <span style={{ width: "26px", color: "#999", fontSize: "9px", textAlign: "right" }}>
                  {d.defender_score.toFixed(1)}
                </span>
              </div>
            );
          })}

          {/* Totals */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: "9px", color: "#555", fontFamily: "monospace",
            marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #1A1A1A",
          }}>
            <span>TOTAL <span style={{ color: "#C14826" }}>{scores.challenger}</span>/100</span>
            <span><span style={{ color: "#4A9ECC" }}>{scores.defender}</span>/100</span>
          </div>
        </>
      )}

      {/* Speed + words */}
      <div style={{
        fontSize: "9px", fontFamily: "monospace", color: "#555", marginTop: "8px",
      }}>
        SPEED{" "}
        <span style={{ color: "#C14826" }}>{fmtMs(state.challenger_response_ms)}</span>
        {state.challenger_word_count !== null && (
          <span style={{ color: "#444" }}> ({state.challenger_word_count}w)</span>
        )}
        {" / "}
        <span style={{ color: "#4A9ECC" }}>{fmtMs(state.defender_response_ms)}</span>
        {state.defender_word_count !== null && (
          <span style={{ color: "#444" }}> ({state.defender_word_count}w)</span>
        )}
      </div>

      {/* Elo delta */}
      {chDelta !== null && defDelta !== null && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: "9px", fontFamily: "monospace", marginTop: "6px",
        }}>
          <span>
            ELO{" "}
            <span style={{ color: chDelta >= 0 ? "#3A7A3A" : "#8B2020" }}>
              {chDelta >= 0 ? "+" : ""}{chDelta}
            </span>
          </span>
          <span style={{ color: defDelta >= 0 ? "#3A7A3A" : "#8B2020" }}>
            {defDelta >= 0 ? "+" : ""}{defDelta}
          </span>
        </div>
      )}

      {/* Recommendations */}
      {rubric && scores && (
        <div style={{
          marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1A1A1A",
          fontFamily: "monospace",
        }}>
          <p style={{ fontSize: "8px", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
            RECOMMENDATIONS
          </p>
          <p style={{ fontSize: "8px", color: "#3A7A3A", lineHeight: "1.5" }}>
            {state.challenger}: {computeRecommendation(rubric, scores.challenger, "challenger")}
          </p>
          <p style={{ fontSize: "8px", color: "#4A9ECC", lineHeight: "1.5", marginTop: "3px" }}>
            {state.defender}: {computeRecommendation(rubric, scores.defender, "defender")}
          </p>
        </div>
      )}
    </>
  );
}

// ── Phase: self_eval ──────────────────────────────────────────────────────────

function SelfEvalLogRow({ entry }: { entry: SelfEvalSummary }) {
  return (
    <div style={{ marginBottom: "5px", fontFamily: "monospace" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "8px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>
          {entry.challenger}
        </span>
        <span style={{ fontSize: "8px", color: "#C14826", flexShrink: 0, marginLeft: "4px" }}>
          {entry.total}/100
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "7px", color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "230px" }}>
          {truncate(entry.prompt, 45)}
        </span>
        <span style={{ fontSize: "7px", color: "#333", flexShrink: 0, marginLeft: "4px" }}>
          {timeAgo(entry.created_at)}
        </span>
      </div>
    </div>
  );
}

function SelfEvalPhase({ state }: { state: ArenaStreamEvent }) {
  const scores = state.jury_scores;
  const rubric = scores?.rubric;
  const log    = (state.self_eval_log ?? []).filter(e => e.id !== state.id);

  return (
    <>
      <p style={{
        fontSize: "9px", color: "#3A7A3A",
        letterSpacing: "0.12em", fontFamily: "monospace",
        textTransform: "uppercase", marginBottom: "10px",
      }}>
        SELF-EVALUATION — COMPLETE
      </p>

      <p style={{
        fontSize: "10px", color: "#E8E4E0", fontFamily: "monospace", marginBottom: "10px",
      }}>
        {state.challenger}
      </p>

      <p style={{
        fontSize: "8px", color: "#555", letterSpacing: "0.1em",
        fontFamily: "monospace", textTransform: "uppercase", marginBottom: "4px",
      }}>PROMPT</p>
      <p style={{
        fontSize: "10px", color: "#888", fontFamily: "monospace",
        lineHeight: "1.5", maxHeight: "32px", overflow: "hidden", marginBottom: "12px",
      }}>
        {truncate(state.prompt, 80)}
      </p>

      {scores && (
        <>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: "10px",
          }}>
            <span style={{ fontSize: "8px", color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              PERFORMANCE SCORE
            </span>
            <span style={{ fontSize: "14px", color: "#C14826", fontFamily: "monospace", fontWeight: "bold" }}>
              {scores.challenger}<span style={{ fontSize: "9px", color: "#555" }}>/100</span>
            </span>
          </div>

          {rubric && (
            <>
              <p style={{
                fontSize: "8px", color: "#555", fontFamily: "monospace",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px",
              }}>DIMENSION BREAKDOWN</p>

              {DIM_ORDER.map((dim) => {
                const d = rubric[dim];
                return (
                  <div key={dim} style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    fontFamily: "monospace", marginBottom: "3px", lineHeight: "14px",
                  }}>
                    <span style={{ width: "72px", color: "#555", fontSize: "8px" }}>{dim}</span>
                    {bar(d.challenger_score, "#C14826")}
                    <span style={{ width: "26px", color: "#999", fontSize: "9px", textAlign: "right" }}>
                      {d.challenger_score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      <div style={{
        fontSize: "9px", fontFamily: "monospace", color: "#555", marginTop: "8px",
      }}>
        SPEED{" "}
        <span style={{ color: "#C14826" }}>{fmtMs(state.challenger_response_ms)}</span>
        {state.challenger_word_count !== null && (
          <span style={{ color: "#444" }}> ({state.challenger_word_count}w)</span>
        )}
      </div>

      {/* Recommendation */}
      {scores && rubric && (
        <div style={{
          marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1A1A1A",
          fontFamily: "monospace",
        }}>
          <p style={{ fontSize: "8px", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
            RECOMMENDATION
          </p>
          <p style={{ fontSize: "8px", color: "#3A7A3A", lineHeight: "1.5" }}>
            {computeRecommendation(rubric, scores.challenger, "challenger")}
          </p>
        </div>
      )}

      {/* Activity log */}
      {log.length > 0 && (
        <div style={{
          marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1A1A1A",
          fontFamily: "monospace",
        }}>
          <p style={{ fontSize: "8px", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
            RECENT SELF-EVALS
          </p>
          {log.map(e => <SelfEvalLogRow key={e.id} entry={e} />)}
        </div>
      )}
    </>
  );
}

// ── Phase: sudden_death ───────────────────────────────────────────────────────

function SuddenDeathPhase({ state }: { state: ArenaStreamEvent }) {
  return (
    <>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "10px", color: "#E8E4E0", fontFamily: "monospace", marginBottom: "12px",
      }}>
        <span>{state.challenger}</span>
        <span style={{ color: "#C14826", animation: "arena-pulse 1.5s ease-in-out infinite" }}>TIE</span>
        <span>{state.defender}</span>
      </div>

      <p style={{
        fontSize: "8px", color: "#555", fontFamily: "monospace",
        textTransform: "uppercase", marginBottom: "4px",
      }}>TIEBREAKER</p>

      {state.sd_puzzle && (
        <>
          <p style={{ fontSize: "9px", color: "#888", fontFamily: "monospace", marginBottom: "6px" }}>
            TYPE: {state.sd_puzzle.type.toUpperCase()}
          </p>
          <p style={{
            fontSize: "10px", color: "#999", fontFamily: "monospace",
            lineHeight: "1.5", maxHeight: "48px", overflow: "hidden",
          }}>
            {truncate(state.sd_puzzle.prompt, 120)}
          </p>
        </>
      )}

      <p style={{
        fontSize: "9px", color: "#333", fontFamily: "monospace", marginTop: "12px",
        animation: "arena-pulse 1.5s ease-in-out infinite",
      }}>
        ● awaiting tiebreaker response
      </p>
    </>
  );
}

// ── Phase: team_duel ──────────────────────────────────────────────────────────

function TeamDuelPhase({ state }: { state: ArenaStreamEvent }) {
  const chTeam  = state.challenger_team ?? [];
  const defTeam = state.defender_team   ?? [];
  const subs    = state.team_submissions ?? {};
  const scores  = state.jury_scores;
  const rubric  = scores?.rubric;
  const isPending  = state.status === "pending";
  const isJudging  = state.status === "judging";
  const isComplete = state.status === "complete";

  // Count submitted members for pending phase progress
  const allMembers   = [...chTeam, ...defTeam];
  const submittedSet = new Set(allMembers.filter(m => Boolean(subs[m])));

  return (
    <>
      <p style={{
        fontSize: "9px",
        color: isComplete ? "#3A7A3A" : isJudging ? "#AA8800" : "#555",
        letterSpacing: "0.12em", fontFamily: "monospace",
        textTransform: "uppercase", marginBottom: "10px",
      }}>
        {isComplete ? "// TEAM DUEL — COMPLETE" : isJudging ? "// TEAM DUEL — JUDGING" : "// TEAM DUEL — PENDING"}
      </p>

      {/* Team rosters */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          {chTeam.map(m => (
            <p key={m} style={{ fontSize: "9px", fontFamily: "monospace", color: submittedSet.has(m) ? "#C14826" : "#444", marginBottom: "2px" }}>
              {submittedSet.has(m) ? "▸" : "·"} {m}
            </p>
          ))}
        </div>
        <span style={{ fontSize: "9px", color: "#333", fontFamily: "monospace", alignSelf: "center" }}>vs</span>
        <div style={{ textAlign: "right" }}>
          {defTeam.map(m => (
            <p key={m} style={{ fontSize: "9px", fontFamily: "monospace", color: submittedSet.has(m) ? "#4A9ECC" : "#444", marginBottom: "2px" }}>
              {m} {submittedSet.has(m) ? "◂" : "·"}
            </p>
          ))}
        </div>
      </div>

      {isPending && (
        <>
          <p style={{ fontSize: "8px", color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>PROMPT</p>
          <p style={{ fontSize: "10px", color: "#888", fontFamily: "monospace", lineHeight: "1.5", maxHeight: "48px", overflow: "hidden", marginBottom: "12px" }}>
            {truncate(state.prompt, 120)}
          </p>
          <p style={{ fontSize: "9px", color: "#555", fontFamily: "monospace" }}>
            {submittedSet.size}/{allMembers.length} submitted
          </p>
          <p style={{ fontSize: "9px", color: "#333", fontFamily: "monospace", marginTop: "8px", animation: "arena-pulse 1.5s ease-in-out infinite" }}>
            ● awaiting team responses
          </p>
        </>
      )}

      {isJudging && (
        <p style={{ fontSize: "9px", color: "#333", fontFamily: "monospace", marginTop: "8px", animation: "arena-pulse 1.5s ease-in-out infinite" }}>
          ● gemini judging teams
        </p>
      )}

      {isComplete && scores && (
        <>
          {/* Winner banner */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: "#E8E4E0", fontFamily: "monospace", fontWeight: "bold" }}>
              ★ {state.winner} TEAM WINS
            </span>
            <span style={{ fontSize: "9px", color: "#555", fontFamily: "monospace" }}>{state.loser}</span>
          </div>

          {rubric && (
            <>
              <p style={{ fontSize: "8px", color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                DIMENSION BREAKDOWN
              </p>
              {DIM_ORDER.map((dim) => {
                const d = rubric[dim];
                return (
                  <div key={dim} style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "monospace", marginBottom: "3px", lineHeight: "14px" }}>
                    <span style={{ width: "72px", color: "#555", fontSize: "8px" }}>{dim}</span>
                    {bar(d.challenger_score, "#C14826")}
                    <span style={{ width: "26px", color: "#999", fontSize: "9px", textAlign: "right" }}>{d.challenger_score.toFixed(1)}</span>
                    <span style={{ width: "4px" }} />
                    {bar(d.defender_score, "#4A9ECC")}
                    <span style={{ width: "26px", color: "#999", fontSize: "9px", textAlign: "right" }}>{d.defender_score.toFixed(1)}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#555", fontFamily: "monospace", marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #1A1A1A" }}>
                <span>TOTAL <span style={{ color: "#C14826" }}>{scores.challenger}</span>/100</span>
                <span><span style={{ color: "#4A9ECC" }}>{scores.defender}</span>/100</span>
              </div>
            </>
          )}

          {/* Recommendations per team */}
          {rubric && (
            <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #1A1A1A", fontFamily: "monospace" }}>
              <p style={{ fontSize: "8px", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>RECOMMENDATIONS</p>
              <p style={{ fontSize: "8px", color: "#C14826", lineHeight: "1.5" }}>
                {chTeam.join(" + ")}: {computeRecommendation(rubric, scores.challenger, "challenger")}
              </p>
              <p style={{ fontSize: "8px", color: "#4A9ECC", lineHeight: "1.5", marginTop: "3px" }}>
                {defTeam.join(" + ")}: {computeRecommendation(rubric, scores.defender, "defender")}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArenaDuelPanel({ state }: { state: ArenaStreamEvent }) {
  return (
    <>
      <style>{`
        @keyframes arena-pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1; }
        }
      `}</style>
      <div style={{
        borderBottom: "1px solid #1A1A1A",
        background: "#0A0A0A",
        padding: "12px 16px",
        flexShrink: 0,
      }}>
        {state.mode === "self_eval"
          ? <SelfEvalPhase  state={state} />
          : state.mode === "team_duel"
          ? <TeamDuelPhase  state={state} />
          : (
            <>
              <Header state={state} />
              {state.status === "pending"      && <PendingPhase      state={state} />}
              {state.status === "judging"      && <JudgingPhase      state={state} />}
              {state.status === "complete"     && <CompletePhase     state={state} />}
              {state.status === "sudden_death" && <SuddenDeathPhase  state={state} />}
            </>
          )
        }
      </div>
    </>
  );
}
