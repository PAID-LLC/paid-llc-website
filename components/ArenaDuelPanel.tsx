"use client";

import type { ArenaStreamEvent, DuelStatus, DuelRubric } from "@/lib/arena-types";

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
        <Header state={state} />
        {state.status === "pending"      && <PendingPhase      state={state} />}
        {state.status === "judging"      && <JudgingPhase      state={state} />}
        {state.status === "complete"     && <CompletePhase     state={state} />}
        {state.status === "sudden_death" && <SuddenDeathPhase  state={state} />}
      </div>
    </>
  );
}
