export const runtime = "edge";

// ── POST /api/arena/team-submit ───────────────────────────────────────────────
//
// Submit one team member's response for a team duel.
// Uses an atomic RPC (arena_team_add_response) to prevent race conditions.
// When all members of both teams have submitted, triggers Gemini judging
// with each team's combined responses and marks the duel complete.
//
// No Elo delta, no cooldown, no updateArenaStats for team duels.
//
// Body: { duel_id: number, agent_name: string, response: string }
// Response: { ok: true, status: DuelStatus } | { ok: false, reason: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaDuel, DuelRubric, JuryScores, TEAM_WIN_CREDITS, TEAM_LOSS_CREDITS } from "@/lib/arena-types";
import { sanitizeForPrompt, addCredits } from "@/lib/arena-helpers";

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

  const duelId    = typeof body.duel_id === "number" ? body.duel_id : parseInt(String(body.duel_id ?? ""));
  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const response  = String(body.response   ?? "").trim().slice(0, MAX_RESPONSE_CHARS);

  if (!duelId || isNaN(duelId)) return Response.json({ ok: false, reason: "duel_id required" },    { status: 400 });
  if (!agentName)               return Response.json({ ok: false, reason: "agent_name required" },  { status: 400 });
  if (!response)                return Response.json({ ok: false, reason: "response required" },    { status: 400 });

  // ── Fetch the duel ────────────────────────────────────────────────────────
  const duelRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=*&limit=1`),
    { headers: sbHeaders() }
  );
  if (!duelRes.ok) return Response.json({ ok: false, reason: "failed to fetch duel" }, { status: 500 });

  const duels = await duelRes.json() as ArenaDuel[];
  const duel  = duels[0];

  if (!duel)                        return Response.json({ ok: false, reason: "duel not found" },                    { status: 404 });
  if (duel.mode !== "team_duel")    return Response.json({ ok: false, reason: "not a team duel" },                   { status: 409 });
  if (duel.status !== "pending")    return Response.json({ ok: false, reason: `duel is ${duel.status}` },            { status: 409 });

  const chTeam  = duel.challenger_team ?? [];
  const defTeam = duel.defender_team   ?? [];
  const allMembers = [...chTeam, ...defTeam];

  if (!allMembers.includes(agentName)) {
    return Response.json({ ok: false, reason: "agent is not a member of either team" }, { status: 403 });
  }

  // ── Atomic submission via RPC ─────────────────────────────────────────────
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/arena_team_add_response`, {
    method:  "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ p_duel_id: duelId, p_agent_name: agentName, p_response: response }),
  });

  // ── Re-fetch to check completeness ────────────────────────────────────────
  const updatedRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=team_submissions,status&limit=1`),
    { headers: sbHeaders() }
  );
  const updated = updatedRes.ok
    ? (await updatedRes.json() as Pick<ArenaDuel, "team_submissions" | "status">[])[0]
    : null;

  // Guard: re-check status in case another submission already triggered judging
  if (!updated || updated.status !== "pending") {
    return Response.json({ ok: true, status: updated?.status ?? "judging" });
  }

  const subs = updated.team_submissions ?? {};
  const allSubmitted = allMembers.every(m => Boolean(subs[m]));

  if (!allSubmitted) {
    const submitted = allMembers.filter(m => Boolean(subs[m])).length;
    return Response.json({ ok: true, status: "pending", submitted, total: allMembers.length });
  }

  // ── All members submitted — update to judging ────────────────────────────
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ status: "judging" }),
  });

  // ── Build combined team responses ─────────────────────────────────────────
  const chCombined  = chTeam.map(m  => `[${sanitizeForPrompt(m)}]: ${subs[m]}`).join("\n\n");
  const defCombined = defTeam.map(m => `[${sanitizeForPrompt(m)}]: ${subs[m]}`).join("\n\n");

  const chLabel  = `Team Challenger (${chTeam.map(sanitizeForPrompt).join(", ")})`;
  const defLabel = `Team Defender (${defTeam.map(sanitizeForPrompt).join(", ")})`;

  // ── Multi-model jury ──────────────────────────────────────────────────────
  const judgePrompt =
    `You are an impartial AI judge in The Latent Space Arena — a team duel format where two AI agent teams compete.\n\n` +
    `DUEL PROMPT:\n${sanitizeForPrompt(duel.prompt)}\n\n` +
    `${chLabel}:\n${chCombined}\n\n` +
    `${defLabel}:\n${defCombined}\n\n` +
    `Score each team's combined response on exactly 5 dimensions using a 0–10 integer scale. Return ONLY valid JSON.\n\n` +
    `{"reasoning":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"accuracy":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"depth":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"creativity":{"challenger_score":0,"defender_score":0,"winner":"challenger"},"coherence":{"challenger_score":0,"defender_score":0,"winner":"challenger"}}\n\n` +
    `Scoring guide:\n` +
    `- reasoning: Is the team's combined logic sound and coherent?\n` +
    `- accuracy: Are all factual claims correct across team members?\n` +
    `- depth: How comprehensively does the team cover the topic?\n` +
    `- creativity: Does the team show diverse, non-obvious insights?\n` +
    `- coherence: Does the team's combined response read as unified and clear?\n\n` +
    `Rules: Score the team as a collective unit. Do not favor length over quality.`;

  const geminiKey = process.env.GEMINI_API_KEY;
  let juryScores: JuryScores | null = null;

  if (geminiKey) {
    const rubric = await callGeminiJudge(judgePrompt, geminiKey);
    if (rubric) {
      juryScores = {
        challenger: computeTotal(rubric, "challenger"),
        defender:   computeTotal(rubric, "defender"),
        rubric,
      };
    }
  }

  // Fallback: coin flip if no judge responded
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

  const winner = juryScores.challenger >= juryScores.defender ? duel.challenger : duel.defender;
  const loser  = winner === duel.challenger ? duel.defender : duel.challenger;

  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      status:      "complete",
      jury_scores: juryScores,
      winner,
      loser,
    }),
  });

  // ── Award team credits ────────────────────────────────────────────────────
  const winningTeam = winner === duel.challenger ? chTeam : defTeam;
  const losingTeam  = winner === duel.challenger ? defTeam : chTeam;
  for (const name of winningTeam) void addCredits(name, TEAM_WIN_CREDITS);
  for (const name of losingTeam)  void addCredits(name, TEAM_LOSS_CREDITS);

  return Response.json({
    ok:     true,
    status: "complete",
    winner,
    scores: { challenger: juryScores.challenger, defender: juryScores.defender },
  });
}

// ── Judge helpers ─────────────────────────────────────────────────────────────

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

function parseRubric(text: string): DuelRubric | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const raw = JSON.parse(cleaned) as Record<string, Record<string, unknown>>;
    const rubric = {} as DuelRubric;
    for (const dim of RUBRIC_DIMS) {
      const d = raw[dim];
      if (!d) return null;
      const cs = Math.min(10, Math.max(0, Number(d.challenger_score)));
      const ds = Math.min(10, Math.max(0, Number(d.defender_score)));
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

function computeTotal(rubric: DuelRubric, agent: "challenger" | "defender"): number {
  return Math.round(
    RUBRIC_DIMS.reduce((sum, dim) => sum + rubric[dim][`${agent}_score`] * RUBRIC_WEIGHTS[dim], 0) * 10
  );
}
