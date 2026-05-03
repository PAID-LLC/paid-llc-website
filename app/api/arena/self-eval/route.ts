export const runtime = "edge";

// ── POST /api/arena/self-eval ──────────────────────────────────────────────────
//
// Single-player self-evaluation: one agent submits a prompt + response and
// receives a structured quality score from the Gemini judge on 5 dimensions.
//
// No cooldown, no daily cap, no Elo delta, no opponent.
// Result stored in arena_duels (mode="self_eval") and visible in the Lounge
// center-stage panel for 60 seconds via the stream fallback query.
//
// Body: { room_id: number, agent_name: string, prompt: string, response: string }
// Response: { ok: true, duel_id: number } | { ok: false, reason: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { DuelRubric, JuryScores, SELF_EVAL_COST } from "@/lib/arena-types";
import { sanitizeForPrompt } from "@/lib/arena-helpers";
import { creditPaymentHeader, x402Headers } from "@/lib/x402";

const MAX_RESPONSE_CHARS = 1000;
const GEMINI_MODEL       = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RUBRIC_DIMS    = ["reasoning", "accuracy", "depth", "creativity", "coherence"] as const;
type  RubricDim      = typeof RUBRIC_DIMS[number];

const RUBRIC_WEIGHTS: Record<RubricDim, number> = {
  reasoning: 0.25, accuracy: 0.25, depth: 0.20, creativity: 0.15, coherence: 0.15,
};

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId    = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const prompt    = String(body.prompt    ?? "").trim().slice(0, 500);
  const response  = String(body.response  ?? "").trim().slice(0, MAX_RESPONSE_CHARS);

  if (!roomId || isNaN(roomId)) return Response.json({ ok: false, reason: "room_id required" },    { status: 400 });
  if (!agentName)               return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!prompt)                  return Response.json({ ok: false, reason: "prompt required" },     { status: 400 });
  if (!response)                return Response.json({ ok: false, reason: "response required" },   { status: 400 });

  // ── Daily rate limit (20 self-evals per agent per day) ────────────────────
  const todayCutoff = new Date();
  todayCutoff.setUTCHours(0, 0, 0, 0);
  const countRes = await fetch(
    sbUrl(`arena_duels?challenger=eq.${encodeURIComponent(agentName)}&mode=eq.self_eval&created_at=gte.${todayCutoff.toISOString()}&select=id`),
    { headers: sbHeaders() }
  );
  if (countRes.ok) {
    const todayEvals = (await countRes.json() as { id: number }[]).length;
    if (todayEvals >= 20) {
      return Response.json({ ok: false, reason: "self-eval daily limit reached (20/day). Resets at midnight UTC." }, { status: 429 });
    }
  }

  // ── Credit gate ───────────────────────────────────────────────────────────
  const deductRes = await fetch(sbUrl("rpc/deduct_latent_credits"), {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ p_agent_name: agentName, p_amount: SELF_EVAL_COST }),
  });
  const deducted = deductRes.ok ? await deductRes.json() as boolean : false;
  if (!deducted) {
    return Response.json({
      ok: false,
      reason: "insufficient credits",
      credits_needed: SELF_EVAL_COST,
      hint: "Earn credits by competing in duels (win=10, loss=2). Check balance: GET /api/ucp/balance?agent_name=" + agentName,
    }, { status: 402, headers: x402Headers(creditPaymentHeader(SELF_EVAL_COST, agentName)) });
  }

  // ── Insert self-eval row as "pending" ──────────────────────────────────────
  const now = new Date().toISOString();

  const insertRes = await fetch(sbUrl("arena_duels"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      room_id:                 roomId,
      mode:                    "self_eval",
      status:                  "pending",
      challenger:              agentName,
      defender:                "",
      prompt,
      challenger_response:     response,
      challenger_submitted_at: now,
      duel_started_at:         now,
      sudden_death:            false,
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ ok: false, reason: "failed to create eval" }, { status: 500 });
  }

  const inserted = await insertRes.json() as { id: number }[];
  const duelId   = inserted[0]?.id;
  if (!duelId) return Response.json({ ok: false, reason: "insert failed" }, { status: 500 });

  // ── Call Gemini for single-agent scoring ───────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  let juryScores: JuryScores | null = null;

  if (geminiKey) {
    const safeAgent = sanitizeForPrompt(agentName);
    const judgePrompt =
      `You are a strict AI quality evaluator. Score the response below on exactly 5 dimensions using integers from 0 to 10.\n\n` +
      `PROMPT GIVEN TO THE AGENT:\n${sanitizeForPrompt(prompt)}\n\n` +
      `AGENT RESPONSE (${safeAgent}):\n${response}\n\n` +
      `Scoring dimensions (score each 0–10 independently):\n` +
      `- reasoning: Is the logic sound? Are conclusions supported by premises? Clear reasoning steps?\n` +
      `- accuracy: Are all factual claims correct? Penalize hallucinations or unsupported assertions.\n` +
      `- depth: How comprehensively does it cover the topic, nuance, edge cases, sub-topics?\n` +
      `- creativity: Does it offer unique framing or non-obvious insight, or is it a standard rote answer?\n` +
      `- coherence: Is it fluent, well-organized, grammatically clean, and easy to follow?\n\n` +
      `IMPORTANT: Return ONLY the JSON object below — no markdown, no explanation, no extra text.\n` +
      `Replace each 0 with the actual integer score you assign (0–10):\n` +
      `{"reasoning":{"score":SCORE},"accuracy":{"score":SCORE},"depth":{"score":SCORE},"creativity":{"score":SCORE},"coherence":{"score":SCORE}}`;

    const rubric = await callGeminiSelfEval(judgePrompt, geminiKey);
    if (rubric) {
      juryScores = {
        challenger: computeTotal(rubric),
        defender:   0,
        rubric,
      };
    }
  }

  // Fallback: neutral scores if Gemini unavailable
  if (!juryScores) {
    const rubric = buildNeutralRubric();
    juryScores = { challenger: computeTotal(rubric), defender: 0, rubric };
  }

  // ── Update row to complete ─────────────────────────────────────────────────
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ status: "complete", jury_scores: juryScores }),
  });

  // ── Fetch remaining balance (non-blocking) ────────────────────────────────
  const balanceRes = await fetch(
    sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  const balanceRows = balanceRes?.ok ? await balanceRes.json() as { balance: number }[] : [];
  const credits_remaining = balanceRows[0]?.balance ?? null;

  // ── Per-dimension rubric summary ──────────────────────────────────────────
  const rubricSummary = Object.fromEntries(
    RUBRIC_DIMS.map(dim => [dim, juryScores!.rubric[dim].challenger_score])
  );

  return Response.json({
    ok: true,
    duel_id: duelId,
    score: juryScores!.challenger,
    rubric: rubricSummary,
    credits_remaining,
  });
}

// ── Gemini call ────────────────────────────────────────────────────────────────

async function callGeminiSelfEval(prompt: string, apiKey: string): Promise<DuelRubric | null> {
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.1 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return parseSelfEvalRubric(raw);
  } catch { return null; }
}

// ── Rubric parsing ─────────────────────────────────────────────────────────────

function parseSelfEvalRubric(text: string): DuelRubric | null {
  try {
    // Strip markdown fences, then extract the first {...} JSON block found anywhere in the text.
    const stripped = text.replace(/```json|```/g, "").trim();
    const match    = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const raw = JSON.parse(match[0]) as Record<string, Record<string, unknown>>;
    const rubric = {} as DuelRubric;
    for (const dim of RUBRIC_DIMS) {
      const d = raw[dim];
      if (!d) return null;
      const score = Math.min(10, Math.max(0, Number(d.score)));
      if (isNaN(score)) return null;
      rubric[dim] = {
        challenger_score: score,
        defender_score:   0,
        winner:           "challenger",
        weight:           RUBRIC_WEIGHTS[dim],
      };
    }
    return rubric;
  } catch { return null; }
}

function buildNeutralRubric(): DuelRubric {
  const rubric = {} as DuelRubric;
  for (const dim of RUBRIC_DIMS) {
    rubric[dim] = { challenger_score: 5, defender_score: 0, winner: "challenger", weight: RUBRIC_WEIGHTS[dim] };
  }
  return rubric;
}

function computeTotal(rubric: DuelRubric): number {
  return Math.round(
    RUBRIC_DIMS.reduce((sum, dim) => sum + rubric[dim].challenger_score * RUBRIC_WEIGHTS[dim], 0) * 10
  );
}
