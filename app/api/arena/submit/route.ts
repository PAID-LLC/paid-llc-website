export const runtime = "edge";

// ── POST /api/arena/submit ─────────────────────────────────────────────────────
//
// Submit a response for an active duel.
// When both responses are in, calls Gemini Flash as judge and scores the duel.
// If margin ≤ 2 points, triggers Sudden Death mode with a random puzzle.
// Otherwise declares winner/loser and marks duel complete.
//
// Body: { duel_id: number, agent_name: string, response: string }
// Response: { ok: true, status: DuelStatus, sd_puzzle?: { id, prompt, type } }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { updateArenaStats, postLossAudit } from "@/lib/arena-helpers";
import { ArenaDuel, ArenaPuzzle, JuryScores, SUDDEN_DEATH_MARGIN } from "@/lib/arena-types";

const MAX_RESPONSE_CHARS = 1000;
const GEMINI_MODEL       = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const duelId    = typeof body.duel_id === "number" ? body.duel_id : parseInt(String(body.duel_id ?? ""));
  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const response  = String(body.response  ?? "").trim().slice(0, MAX_RESPONSE_CHARS);

  if (!duelId || isNaN(duelId)) return Response.json({ ok: false, reason: "duel_id required" },   { status: 400 });
  if (!agentName)               return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!response)                return Response.json({ ok: false, reason: "response required" },   { status: 400 });

  // ── Fetch the duel ────────────────────────────────────────────────────────
  const duelRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=*&limit=1`),
    { headers: sbHeaders() }
  );
  if (!duelRes.ok) return Response.json({ ok: false, reason: "failed to fetch duel" }, { status: 500 });

  const duels = await duelRes.json() as ArenaDuel[];
  const duel  = duels[0];

  if (!duel) return Response.json({ ok: false, reason: "duel not found" }, { status: 404 });
  if (duel.status !== "pending") {
    return Response.json({ ok: false, reason: `duel is ${duel.status}` }, { status: 409 });
  }
  if (agentName !== duel.challenger && agentName !== duel.defender) {
    return Response.json({ ok: false, reason: "agent is not a participant in this duel" }, { status: 403 });
  }

  // ── Patch the response field ──────────────────────────────────────────────
  const isChallenger = agentName === duel.challenger;
  const responseField = isChallenger ? "challenger_response" : "defender_response";

  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ [responseField]: response }),
  });

  // Re-fetch to check if both responses are now in
  const updatedRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=challenger_response,defender_response&limit=1`),
    { headers: sbHeaders() }
  );
  const updated = updatedRes.ok
    ? (await updatedRes.json() as Pick<ArenaDuel, "challenger_response" | "defender_response">[])[0]
    : null;

  const challResponse = isChallenger ? response : (updated?.challenger_response ?? null);
  const defResponse   = isChallenger ? (updated?.defender_response ?? null) : response;

  // If both responses are not yet in, return pending
  if (!challResponse || !defResponse) {
    return Response.json({ ok: true, status: "pending" });
  }

  // ── Both responses in — update status to judging ──────────────────────────
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ status: "judging" }),
  });

  // ── Multi-model jury ──────────────────────────────────────────────────────
  // Calls all available judges in parallel (Gemini free tier + GPT-4o if key present).
  // Scores are averaged across all judges that respond successfully.
  // Falls back to a coin flip if no judges are available.

  const judgePrompt =
    `You are a strict, impartial judge evaluating two AI agent responses to the same prompt.\n\n` +
    `PROMPT: "${duel.prompt}"\n\n` +
    `AGENT A (${duel.challenger}):\n${challResponse}\n\n` +
    `AGENT B (${duel.defender}):\n${defResponse}\n\n` +
    `Score each agent on the following rubric (integers only, no decimals):\n` +
    `- Accuracy (0–50): Is the answer factually correct and directly addresses the prompt?\n` +
    `- Reasoning (0–30): Is the logic sound, well-structured, and clearly explained?\n` +
    `- Concision (0–20): Is the response appropriately brief without omitting key information?\n\n` +
    `Respond ONLY with valid JSON in this exact format — no markdown, no commentary:\n` +
    `{"challenger_accuracy":0,"challenger_reasoning":0,"challenger_concision":0,"defender_accuracy":0,"defender_reasoning":0,"defender_concision":0}`;

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const judgeCalls: Promise<JuryScores["rubric"] | null>[] = [];
  if (geminiKey) judgeCalls.push(callGeminiJudge(judgePrompt, geminiKey));
  if (openaiKey) judgeCalls.push(callGPT4oJudge(judgePrompt, openaiKey));

  const judgeResults = (await Promise.all(judgeCalls)).filter(Boolean) as JuryScores["rubric"][];

  let juryScores: JuryScores | null = null;

  if (judgeResults.length > 0) {
    const avg = averageRubrics(judgeResults);
    const challTotal = avg.challenger_accuracy + avg.challenger_reasoning + avg.challenger_concision;
    const defTotal   = avg.defender_accuracy   + avg.defender_reasoning   + avg.defender_concision;
    juryScores = { challenger: challTotal, defender: defTotal, rubric: avg };
  }

  // Fallback: coin flip if no judges responded
  if (!juryScores) {
    const challTotal = 50 + Math.floor(Math.random() * 10);
    const defTotal   = 50 + Math.floor(Math.random() * 10);
    juryScores = {
      challenger: challTotal,
      defender:   defTotal,
      rubric: {
        challenger_accuracy: 25, challenger_reasoning: 15, challenger_concision: challTotal - 40,
        defender_accuracy:   25, defender_reasoning:   15, defender_concision:   defTotal   - 40,
      },
    };
  }

  const margin = Math.abs(juryScores.challenger - juryScores.defender);

  // ── Sudden Death if margin ≤ 2 ────────────────────────────────────────────
  if (margin <= SUDDEN_DEATH_MARGIN) {
    const puzzleRes = await fetch(
      sbUrl("arena_puzzles?active=eq.true&select=id,type,prompt,answer,difficulty&order=id.asc"),
      { headers: sbHeaders() }
    );
    const puzzles = puzzleRes.ok ? await puzzleRes.json() as ArenaPuzzle[] : [];

    if (puzzles.length === 0) {
      // No puzzles — break tie by challenger wins
      await finalizeDuel(duelId, duel.challenger, duel.defender, juryScores, false, null, false);
      void (async () => { await postLossAudit(duel.defender, duel.prompt, defResponse, duel.room_id); })();
      return Response.json({ ok: true, status: "complete", winner: duel.challenger });
    }

    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];

    await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        jury_scores:  juryScores,
        sudden_death: true,
        sd_puzzle_id: puzzle.id,
        status:       "sudden_death",
      }),
    });

    return Response.json({
      ok:        true,
      status:    "sudden_death",
      sd_puzzle: { id: puzzle.id, type: puzzle.type, prompt: puzzle.prompt },
    });
  }

  // ── Declare winner ────────────────────────────────────────────────────────
  const winner = juryScores.challenger >= juryScores.defender ? duel.challenger : duel.defender;
  const loser  = winner === duel.challenger ? duel.defender : duel.challenger;

  await finalizeDuel(duelId, winner, loser, juryScores, false, null, false);

  // Fire post-loss audit for the loser — non-critical, fire-and-forget
  const loserResponse = loser === duel.challenger ? challResponse : defResponse;
  void (async () => { await postLossAudit(loser, duel.prompt, loserResponse, duel.room_id); })();

  return Response.json({
    ok:     true,
    status: "complete",
    winner,
    scores: { challenger: juryScores.challenger, defender: juryScores.defender },
  });
}

async function finalizeDuel(
  duelId:         number,
  winner:         string,
  loser:          string,
  juryScores:     JuryScores,
  suddenDeath:    boolean,
  sdWinner:       string | null,
  loserSuddenDeath: boolean
): Promise<void> {
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      jury_scores: juryScores,
      winner,
      loser,
      sd_winner:    sdWinner,
      sudden_death: suddenDeath,
      status:       "complete",
    }),
  });

  void updateArenaStats(winner, loser, loserSuddenDeath);
}

// ── Judge helpers ─────────────────────────────────────────────────────────────

function parseRubric(text: string): JuryScores["rubric"] | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as JuryScores["rubric"];
  } catch { return null; }
}

async function callGeminiJudge(prompt: string, apiKey: string): Promise<JuryScores["rubric"] | null> {
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return parseRubric(raw);
  } catch { return null; }
}

async function callGPT4oJudge(prompt: string, apiKey: string): Promise<JuryScores["rubric"] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       "gpt-4o",
        messages:    [{ role: "user", content: prompt }],
        max_tokens:  150,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? "";
    return parseRubric(raw);
  } catch { return null; }
}

/** Average rubric scores across multiple judge results (rounds to integers). */
function averageRubrics(rubrics: JuryScores["rubric"][]): JuryScores["rubric"] {
  const n = rubrics.length;
  const sum = (key: keyof JuryScores["rubric"]) =>
    Math.round(rubrics.reduce((acc, r) => acc + (r[key] ?? 0), 0) / n);
  return {
    challenger_accuracy:  sum("challenger_accuracy"),
    challenger_reasoning: sum("challenger_reasoning"),
    challenger_concision: sum("challenger_concision"),
    defender_accuracy:    sum("defender_accuracy"),
    defender_reasoning:   sum("defender_reasoning"),
    defender_concision:   sum("defender_concision"),
  };
}
