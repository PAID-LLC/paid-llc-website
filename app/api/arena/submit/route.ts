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
import { bumpCounter } from "@/lib/usage-guard";
import { updateArenaStats, postLossAudit, computeEloDelta, fetchElo, applyEloDeltas } from "@/lib/arena-helpers";
import { ArenaDuel, ArenaPuzzle, JuryScores, DuelRubric, SUDDEN_DEATH_MARGIN } from "@/lib/arena-types";
import { sentinelCheck } from "@/lib/sentinel";
import { verifyAgentWrite } from "@/lib/agent-auth";
import { defer } from "@/lib/defer";

// Must match the limit the public manifest advertises. These disagreed until
// 2026-07-26: the manifest promised 2000 and this silently sliced to 1000, so
// an agent that followed our published contract had half its answer truncated
// with no error and was then judged on the remainder.
const MAX_RESPONSE_CHARS = 2000;
const GEMINI_MODEL       = "gemini-flash-lite-latest";
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

  // ── Auth: submitting agent must present a valid API key ───────────────────
  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) {
    return Response.json({ ok: false, reason: auth.error }, { status: auth.status });
  }

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

  // ── Stake gate: defender pays stake when submitting ──────────────────────
  // Challenger already paid at challenge time. Deduct from defender on first submit.
  const isChallenger = agentName === duel.challenger;
  const stakeCredits = duel.stake_credits ?? 0;

  if (!isChallenger && stakeCredits > 0 && !duel.defender_response) {
    const stakeDeductRes = await fetch(sbUrl("rpc/deduct_latent_credits"), {
      method: "POST",
      headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ p_agent_name: agentName, p_amount: stakeCredits }),
    });
    const stakeDeducted = stakeDeductRes.ok ? await stakeDeductRes.json() as boolean : false;
    if (!stakeDeducted) {
      return Response.json({
        ok: false,
        reason: `this duel has a ${stakeCredits}-credit stake — you need ${stakeCredits} credits to submit`,
        credits_needed: stakeCredits,
        hint: "GET /api/ucp/balance (Authorization: Bearer <api_key>)",
      }, { status: 402 });
    }
  }

  // ── Patch the response field + submission timestamp ───────────────────────
  const responseField = isChallenger ? "challenger_response" : "defender_response";
  const tsField       = isChallenger ? "challenger_submitted_at" : "defender_submitted_at";

  // Write and read back in ONE round trip. PostgREST returns the updated row
  // when asked with Prefer: return=representation, the same trick already used
  // for the stake RPC above. This previously PATCHed, then issued a second GET
  // to read the row it had just written.
  //
  // The .ok check matters more than the saved round trip. Neither call was
  // checked before, so a failed PATCH fell straight through to a refetch of the
  // pre-PATCH row: both responses read as absent, and the endpoint answered
  // {ok:true, status:"pending"}. The submission was discarded and the caller was
  // told everything was fine. 503 not 502, because Cloudflare replaces 502/504
  // bodies with its own error page.
  const patchRes = await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ [responseField]: response, [tsField]: new Date().toISOString() }),
  });

  const updated = patchRes.ok
    ? (await patchRes.json().catch(() => null) as Pick<ArenaDuel, "challenger_response" | "defender_response">[] | null)?.[0] ?? null
    : null;

  // No row back means the write did not land (bad status, unparseable body, or
  // zero rows matched). Fail loudly instead of reporting a phantom "pending".
  if (!updated) {
    return Response.json(
      { ok: false, reason: "failed to record submission, please retry" },
      { status: 503 }
    );
  }

  const challResponse = isChallenger ? response : (updated.challenger_response ?? null);
  const defResponse   = isChallenger ? (updated.defender_response ?? null) : response;

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

  // ── Multi-model jury, order-swapped ───────────────────────────────────────
  // Calls every available judge (Gemini free tier + GPT-4o if a key is present)
  // TWICE: once with the challenger presented first, once with the defender
  // presented first. Responses are labelled A and B rather than by role, so
  // neither position nor agent name is stable between the two passes.
  //
  // Why: LLM judges systematically prefer whichever response appears first.
  // This prompt used to put CHALLENGER first in every duel ever run, and then
  // ties went to the challenger, and then the no-puzzle sudden-death fallback
  // also went to the challenger. Three independent biases all pointing the same
  // way, in a system whose only job is fair ranking. Randomising order is the
  // mitigation the literature actually supports; telling the judge to be fair
  // is not.
  //
  // Scores from both passes are averaged. If the winner FLIPS between passes,
  // the judge has told us it cannot separate the two answers, and that is
  // recorded as a genuine tie rather than silently resolved.

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const runPass = (first: string, second: string): Promise<RubricAB | null>[] => {
    const prompt = buildJudgePrompt(duel.prompt, first, second);
    const calls: Promise<RubricAB | null>[] = [];
    if (geminiKey) calls.push(callGeminiJudge(prompt, geminiKey));
    if (openaiKey) calls.push(callGPT4oJudge(prompt, openaiKey));
    return calls;
  };

  // Pass 1: A = challenger. Pass 2: A = defender, so orientation is inverted.
  const [pass1, pass2] = await Promise.all([
    Promise.all(runPass(challResponse, defResponse)),
    Promise.all(runPass(defResponse, challResponse)),
  ]);

  const oriented1 = pass1.filter(Boolean).map((r) => orient(r as RubricAB, false));
  const oriented2 = pass2.filter(Boolean).map((r) => orient(r as RubricAB, true));
  const allOriented = [...oriented1, ...oriented2];

  let juryScores: JuryScores | null = null;

  if (allOriented.length > 0) {
    const rubric = averageRubrics(allOriented);
    const sources = [geminiKey && GEMINI_MODEL, openaiKey && "gpt-4o"].filter(Boolean) as string[];

    // Order consistency: compare the verdict each pass reached on its own.
    // Only meaningful when both passes produced at least one usable rubric.
    const verdict = (rs: DuelRubric[]): "challenger" | "defender" | "tie" | null => {
      if (rs.length === 0) return null;
      const avg = averageRubrics(rs);
      const c = computeTotal(avg, "challenger");
      const d = computeTotal(avg, "defender");
      return c === d ? "tie" : c > d ? "challenger" : "defender";
    };
    const v1 = verdict(oriented1);
    const v2 = verdict(oriented2);
    const orderConsistent = v1 === null || v2 === null ? undefined : v1 === v2;

    juryScores = {
      challenger:       computeTotal(rubric, "challenger"),
      defender:         computeTotal(rubric, "defender"),
      rubric,
      judged:           true,
      judge_source:     sources.join("+"),
      order_consistent: orderConsistent,
      judge_passes:     allOriented.length,
      method:           JUDGE_METHOD,
    };
  }

  // Fallback: coin flip if no judges responded. Stamped judged:false so the UI
  // never presents it as a real evaluation. A real duel still needs a winner,
  // so we keep the tiebreak, but the score is flagged as unjudged.
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
      challenger:   computeTotal(rubric, "challenger"),
      defender:     computeTotal(rubric, "defender"),
      rubric,
      judged:       false,
      method:       JUDGE_METHOD,
    };
  }

  const margin = Math.abs(juryScores.challenger - juryScores.defender);

  // Indistinguishable on either of two independent grounds: the averaged margin
  // is inside the sudden-death band, or the verdict flipped when the
  // presentation order flipped. Both mean "the judge cannot separate these".
  const orderFlipped = juryScores.order_consistent === false;
  const indistinguishable = margin <= SUDDEN_DEATH_MARGIN || orderFlipped;

  // ── Sudden Death when the jury cannot separate them ───────────────────────
  if (indistinguishable) {
    const puzzleRes = await fetch(
      sbUrl("arena_puzzles?active=eq.true&select=id,type,prompt,answer,difficulty&order=id.asc"),
      { headers: sbHeaders() }
    );
    const puzzles = puzzleRes.ok ? await puzzleRes.json() as ArenaPuzzle[] : [];

    if (puzzles.length === 0) {
      // No puzzle bank, so there is no fair way to break this. Record an honest
      // draw: no Elo movement, both stakes returned.
      //
      // This branch used to award the win to the challenger unconditionally,
      // which meant every closest and most contested duel was decided by which
      // side happened to open it. Combined with the fixed challenger-first
      // judge prompt, that was a systematic advantage rather than a tiebreak.
      await finalizeDraw(duelId, juryScores, duel.challenger, duel.defender, stakeCredits);
      return Response.json({
        ok:     true,
        status: "complete",
        winner: null,
        drawn:  true,
        reason: orderFlipped
          ? "the jury's verdict flipped when the presentation order was swapped"
          : `scores within the ${SUDDEN_DEATH_MARGIN}-point sudden-death margin and no tiebreak puzzles are available`,
        scores: { challenger: juryScores.challenger, defender: juryScores.defender },
      });
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
  // Strict comparison. An exact tie cannot reach here: it would have been
  // inside the sudden-death margin above. The old `>=` handed exact ties to the
  // challenger.
  const winner = juryScores.challenger > juryScores.defender ? duel.challenger : duel.defender;
  const loser  = winner === duel.challenger ? duel.defender : duel.challenger;
  const isChallengerWinner = winner === duel.challenger;

  const [winnerElo, loserElo] = await Promise.all([fetchElo(winner), fetchElo(loser)]);
  const winnerDelta = computeEloDelta(winnerElo, loserElo);

  await finalizeDuel(duelId, winner, loser, juryScores, false, null, false, isChallengerWinner, winnerDelta, stakeCredits);

  // Post-loss coaching tips for the loser. Genuinely non-critical, but it makes
  // a full Gemini call, and it was AWAITED despite the old comment here claiming
  // fire-and-forget — so every duel-loss response paid an LLM round trip before
  // returning. Deferred: the response returns now, the tips still get written.
  const loserResponse = loser === duel.challenger ? challResponse : defResponse;
  await defer(postLossAudit(loser, duel.prompt, loserResponse, duel.room_id), "arena:post-loss-audit");

  return Response.json({
    ok:     true,
    status: "complete",
    winner,
    scores: { challenger: juryScores.challenger, defender: juryScores.defender },
    ...(stakeCredits > 0 && { stake_payout: stakeCredits * 2, stake_winner: winner }),
  });
}

async function finalizeDuel(
  duelId:             number,
  winner:             string,
  loser:              string,
  juryScores:         JuryScores,
  suddenDeath:        boolean,
  sdWinner:           string | null,
  loserSuddenDeath:   boolean,
  isChallengerWinner: boolean = true,
  winnerEloDelta:     number  = 0,
  stakeCredits:       number  = 0,
): Promise<void> {
  const loserEloDelta      = -winnerEloDelta;
  const challengerEloDelta = isChallengerWinner ? winnerEloDelta : loserEloDelta;
  const defenderEloDelta   = isChallengerWinner ? loserEloDelta  : winnerEloDelta;

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

  await updateArenaStats(winner, loser, loserSuddenDeath);

  // Real Elo write (F1 fix) — same choke point as W/L so a duel is never
  // half-recorded across the two constructs. Called AFTER updateArenaStats,
  // which guarantees both agent_reputation rows exist (it upserts).
  await applyEloDeltas(winner, winnerEloDelta, loser, loserEloDelta);

  // Stake payout: winner earns both stakes (2x stake_credits)
  if (stakeCredits > 0) {
    await fetch(sbUrl("rpc/add_latent_credits"), {
      method: "POST",
      headers: { ...sbHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_agent_name: winner, p_amount: stakeCredits * 2 }),
    });
  }
}

/** An honest draw: both stakes returned, no Elo movement, no W/L recorded. */
async function finalizeDraw(
  duelId:       number,
  juryScores:   JuryScores,
  challenger:   string,
  defender:     string,
  stakeCredits: number,
): Promise<void> {
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      jury_scores:          juryScores,
      winner:               null,
      loser:                null,
      sd_winner:            null,
      sudden_death:         false,
      status:               "complete",
      challenger_elo_delta: 0,
      defender_elo_delta:   0,
    }),
  });

  // Refund both stakes. The challenger paid at challenge time and the defender
  // paid on submit, so a draw has to return two.
  if (stakeCredits > 0) {
    await Promise.all([challenger, defender].map((agent) =>
      fetch(sbUrl("rpc/add_latent_credits"), {
        method: "POST",
        headers: { ...sbHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ p_agent_name: agent, p_amount: stakeCredits }),
      })
    ));
  }
}

// ── Judge helpers ─────────────────────────────────────────────────────────────

/** Grading methodology version, stamped onto every result. Bump when scoring
 *  semantics change, or a stored score's meaning silently rots.
 *  Not exported: a Next.js route module may only export route handlers. */
const JUDGE_METHOD = "jury/v2-order-swapped";

const RUBRIC_DIMS = ["reasoning", "accuracy", "depth", "creativity", "coherence"] as const;
type RubricDim = typeof RUBRIC_DIMS[number];

const RUBRIC_WEIGHTS: Record<RubricDim, number> = {
  reasoning: 0.25, accuracy: 0.25, depth: 0.20, creativity: 0.15, coherence: 0.15,
};

/** A judge's raw verdict, in the anonymous A/B frame it was asked in. */
type RubricAB = Record<RubricDim, { a: number; b: number }>;

/** Builds the prompt in an anonymous A/B frame. The agents' names never appear:
 *  a judge that recognises a name could favour it, and more importantly the
 *  order-swap only removes position bias if position is the ONLY thing that
 *  changes between the two passes. */
function buildJudgePrompt(duelPrompt: string, aResponse: string, bResponse: string): string {
  return (
    `You are an impartial judge in an AI response-quality evaluation.\n\n` +
    `TASK GIVEN TO BOTH:\n${duelPrompt}\n\n` +
    `RESPONSE A:\n${aResponse}\n\n` +
    `RESPONSE B:\n${bResponse}\n\n` +
    `Score each response on exactly 5 dimensions using a 0-10 integer scale. Return ONLY valid JSON, no commentary, no markdown, no explanation outside the JSON object.\n\n` +
    `{"reasoning":{"a":0,"b":0},"accuracy":{"a":0,"b":0},"depth":{"a":0,"b":0},"creativity":{"a":0,"b":0},"coherence":{"a":0,"b":0}}\n\n` +
    `Scoring guide:\n` +
    `- reasoning: Is the logic sound? Conclusions supported by premises? Clear reasoning steps or unsupported leaps?\n` +
    `- accuracy: Are all factual claims correct? Any hallucinations or unsupported assertions?\n` +
    `- depth: How comprehensively does it cover the topic, nuance, edge cases, sub-topics?\n` +
    `- creativity: Unique framing or non-obvious insight? Or standard rote answer?\n` +
    `- coherence: Fluent, well-organized, grammatically clean, easy to follow?\n\n` +
    `Anchor every score to this scale and use the full range:\n` +
    `  0-2 poor, 3-4 weak, 5-6 adequate, 7-8 strong, 9-10 exceptional.\n` +
    `Do not default to the middle. A rote or generic answer is a 3-5, not a 7.\n\n` +
    `Rules: Judge only on quality. Length is not quality. A and B are in arbitrary order and the order carries no information. Score dimensions independently.`
  );
}

/** Maps an anonymous A/B verdict back onto challenger/defender.
 *  `inverted` is true for the pass where A was the DEFENDER. */
function orient(ab: RubricAB, inverted: boolean): DuelRubric {
  const rubric = {} as DuelRubric;
  for (const dim of RUBRIC_DIMS) {
    const cs = inverted ? ab[dim].b : ab[dim].a;
    const ds = inverted ? ab[dim].a : ab[dim].b;
    rubric[dim] = {
      challenger_score: cs,
      defender_score:   ds,
      winner: cs > ds ? "challenger" : ds > cs ? "defender" : "tie",
      weight: RUBRIC_WEIGHTS[dim],
    };
  }
  return rubric;
}

function parseRubric(text: string): RubricAB | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const raw = JSON.parse(cleaned) as Record<string, Record<string, unknown>>;
    const rubric = {} as RubricAB;
    for (const dim of RUBRIC_DIMS) {
      const d = raw[dim];
      if (!d) return null;
      const a = Number(d.a);
      const b = Number(d.b);
      // A judge that returns a non-number has not scored this dimension, and
      // NaN would propagate silently through the average into a stored score.
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      rubric[dim] = { a, b };
    }
    return rubric;
  } catch { return null; }
}

async function callGeminiJudge(prompt: string, apiKey: string): Promise<RubricAB | null> {
  try {
    await bumpCounter("gemini_arena", 1); // accounting only — arena is credit-gated, not budget-gated
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

async function callGPT4oJudge(prompt: string, apiKey: string): Promise<RubricAB | null> {
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

