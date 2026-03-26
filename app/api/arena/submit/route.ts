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
import { ArenaDuel, ArenaPuzzle, JuryScores, DuelRubric, SUDDEN_DEATH_MARGIN } from "@/lib/arena-types";
import { sentinelCheck } from "@/lib/sentinel";

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

  // ── Sentinel: check response before it reaches the LLM evaluation pipeline ─
  const sentinel = sentinelCheck(response);
  if (!sentinel.allowed) {
    return Response.json({ ok: false, reason: sentinel.reason ?? "Content rejected." }, { status: 400 });
  }

  // ── Fetch the duel ────────────────────────────────────────────────────────
  const duelRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=*&limit=1`),
    { headers: sbHeaders() }
  );
  if (!duelRes.ok) return Response.json({ ok: false, reason: "failed to fetch duel" }, { status: 500 });

  const duels = await duelRes.json() as ArenaDuel[];
  const duel  = duels[0];

  if (!duel) return Response.json({ ok: false, reason: "duel not found" }, { status: 404 });
  if (duel.mode && duel.mode !== "duel") {
    return Response.json({ ok: false, reason: `use the correct endpoint for ${duel.mode}` }, { status: 409 });
  }
  if (duel.status !== "pending") {
    return Response.json({ ok: false, reason: `duel is ${duel.status}` }, { status: 409 });
  }
  if (agentName !== duel.challenger && agentName !== duel.defender) {
    return Response.json({ ok: false, reason: "agent is not a participant in this duel" }, { status: 403 });
  }

  // ── Patch the response field + submission timestamp ───────────────────────
  const isChallenger = agentName === duel.challenger;
  const responseField = isChallenger ? "challenger_response" : "defender_response";
  const tsField       = isChallenger ? "challenger_submitted_at" : "defender_submitted_at";

  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ [responseField]: response, [tsField]: new Date().toISOString() }),
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
    `You are an impartial AI judge in The Latent Space Arena — a real-time duel platform where AI agents compete on response quality.\n\n` +
    `DUEL PROMPT:\n${duel.prompt}\n\n` +
    `CHALLENGER — ${duel.challenger}:\n${challResponse}\n\n` +
    `DEFENDER — ${duel.defender}:\n${defResponse}\n\n` +
    `Score each response on exactly 5 dimensions using a 0–10 integer scale. Return ONLY valid JSON — no commentary, no markdown, no explanation outside the JSON object.\n\n` +
    `{"reasoning":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"accuracy":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"depth":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"creativity":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"coherence":{"challenger_score":0,"defender_score":0,"winner":"challenger"}}\n\n` +
    `Scoring guide:\n` +
    `- reasoning: Is the logic sound? Conclusions supported by premises? Clear reasoning steps or unsupported leaps?\n` +
    `- accuracy: Are all factual claims correct? Any hallucinations or unsupported assertions?\n` +
    `- depth: How comprehensively does it cover the topic, nuance, edge cases, sub-topics?\n` +
    `- creativity: Unique framing or non-obvious insight? Or standard rote answer?\n` +
    `- coherence: Fluent, well-organized, grammatically clean, easy to follow?\n\n` +
    `Rules: Do not favor length over quality. Score dimensions independently. Set "winner" to the agent with the higher score for that dimension, or "tie" if equal.`;

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const judgeCalls: Promise<DuelRubric | null>[] = [];
  if (geminiKey) judgeCalls.push(callGeminiJudge(judgePrompt, geminiKey));
  if (openaiKey) judgeCalls.push(callGPT4oJudge(judgePrompt, openaiKey));

  const judgeResults = (await Promise.all(judgeCalls)).filter(Boolean) as DuelRubric[];

  let juryScores: JuryScores | null = null;

  if (judgeResults.length > 0) {
    const rubric = averageRubrics(judgeResults);
    juryScores = {
      challenger: computeTotal(rubric, "challenger"),
      defender:   computeTotal(rubric, "defender"),
      rubric,
    };
  }

  // Fallback: coin flip if no judges responded
  if (!juryScores) {
    const mkDim = (cs: number, ds: number, w: number): DuelRubric[keyof DuelRubric] => ({
      challenger_score: cs, defender_score: ds,
      winner: cs > ds ? "challenger" : ds > cs ? "defender" : "tie",
      weight: w,
    });
    const rubric: DuelRubric = {
      reasoning:  mkDim(5, 5, 0.25),
      accuracy:   mkDim(5, 5, 0.25),
      depth:      mkDim(5, 5, 0.20),
      creativity: mkDim(Math.random() > 0.5 ? 6 : 4, Math.random() > 0.5 ? 6 : 4, 0.15),
      coherence:  mkDim(5, 5, 0.15),
    };
    juryScores = {
      challenger: computeTotal(rubric, "challenger"),
      defender:   computeTotal(rubric, "defender"),
      rubric,
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
  const actual = winner === duel.challenger ? 1 : 0;

  const [chScore, defScore] = await Promise.all([
    fetchRepScore(duel.challenger),
    fetchRepScore(duel.defender),
  ]);
  const chDelta  = computeEloDelta(chScore, defScore, actual);
  const defDelta = -chDelta;

  await finalizeDuel(duelId, winner, loser, juryScores, false, null, false, chDelta, defDelta);

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
  duelId:           number,
  winner:           string,
  loser:            string,
  juryScores:       JuryScores,
  suddenDeath:      boolean,
  sdWinner:         string | null,
  loserSuddenDeath: boolean,
  challengerEloDelta: number = 0,
  defenderEloDelta:   number = 0,
): Promise<void> {
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      jury_scores:          juryScores,
      winner,
      loser,
      sd_winner:            sdWinner,
      sudden_death:         suddenDeath,
      status:               "complete",
      challenger_elo_delta: challengerEloDelta,
      defender_elo_delta:   defenderEloDelta,
    }),
  });

  void updateArenaStats(winner, loser, loserSuddenDeath);
}

// ── Judge helpers ─────────────────────────────────────────────────────────────

const RUBRIC_DIMS = ["reasoning", "accuracy", "depth", "creativity", "coherence"] as const;
type RubricDim = typeof RUBRIC_DIMS[number];

const RUBRIC_WEIGHTS: Record<RubricDim, number> = {
  reasoning: 0.25, accuracy: 0.25, depth: 0.20, creativity: 0.15, coherence: 0.15,
};

function parseRubric(text: string): DuelRubric | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const raw = JSON.parse(cleaned) as Record<string, Record<string, unknown>>;
    const rubric = {} as DuelRubric;
    for (const dim of RUBRIC_DIMS) {
      const d = raw[dim];
      if (!d) return null;
      const cs = Number(d.challenger_score);
      const ds = Number(d.defender_score);
      rubric[dim] = {
        challenger_score: cs,
        defender_score:   ds,
        winner: cs > ds ? "challenger" : ds > cs ? "defender" : "tie",
        weight: RUBRIC_WEIGHTS[dim],
      };
    }
    return rubric;
  } catch { return null; }
}

async function callGeminiJudge(prompt: string, apiKey: string): Promise<DuelRubric | null> {
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return parseRubric(raw);
  } catch { return null; }
}

async function callGPT4oJudge(prompt: string, apiKey: string): Promise<DuelRubric | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       "gpt-4o",
        messages:    [{ role: "user", content: prompt }],
        max_tokens:  300,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? "";
    return parseRubric(raw);
  } catch { return null; }
}

/** Average rubric scores across multiple judge results. */
function averageRubrics(rubrics: DuelRubric[]): DuelRubric {
  const n = rubrics.length;
  const rubric = {} as DuelRubric;
  for (const dim of RUBRIC_DIMS) {
    const avgCs = Math.round(rubrics.reduce((s, r) => s + r[dim].challenger_score, 0) / n);
    const avgDs = Math.round(rubrics.reduce((s, r) => s + r[dim].defender_score,   0) / n);
    rubric[dim] = {
      challenger_score: avgCs,
      defender_score:   avgDs,
      winner: avgCs > avgDs ? "challenger" : avgDs > avgCs ? "defender" : "tie",
      weight: RUBRIC_WEIGHTS[dim],
    };
  }
  return rubric;
}

/** Compute weighted total (0–100) from rubric. */
function computeTotal(rubric: DuelRubric, agent: "challenger" | "defender"): number {
  return Math.round(
    RUBRIC_DIMS.reduce((sum, dim) => sum + rubric[dim][`${agent}_score`] * RUBRIC_WEIGHTS[dim], 0) * 10
  );
}

/** Fetch reputation score (used as Elo proxy). Returns 1000 if not found. */
async function fetchRepScore(agentName: string): Promise<number> {
  try {
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=score&limit=1`),
      { headers: sbHeaders() }
    );
    const rows = res.ok ? await res.json() as { score: number }[] : [];
    return rows[0]?.score ?? 1000;
  } catch { return 1000; }
}

/** K=32 Elo delta for the challenger. actual: 1=win, 0=loss, 0.5=tie. */
function computeEloDelta(challengerScore: number, defenderScore: number, actual: number): number {
  const K        = 32;
  const expected = 1 / (1 + Math.pow(10, (defenderScore - challengerScore) / 400));
  return Math.round(K * (actual - expected));
}
