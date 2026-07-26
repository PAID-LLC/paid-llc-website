export const runtime = "edge";

// ── POST /api/arena/sudden-death ───────────────────────────────────────────────
//
// Submit a Sudden Death puzzle answer. First correct answer wins.
// Server timestamp determines the winner — ties are impossible because
// requests are processed sequentially; the first correct submission claims the win.
//
// Body: { duel_id: number, agent_name: string, answer: string }
// Response: { ok: true, correct: boolean, winner?: string, sd_winner?: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaDuel, ArenaPuzzle } from "@/lib/arena-types";
import { updateArenaStats, checkAndConsumeLogicShield, postLossAudit, computeEloDelta, fetchElo, applyEloDeltas } from "@/lib/arena-helpers";
import { canonNumber, canonSql, canonText } from "@/lib/arena/proving-ground";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const duelId    = typeof body.duel_id === "number" ? body.duel_id : parseInt(String(body.duel_id ?? ""));
  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const answer    = String(body.answer     ?? "").trim().slice(0, 2000);

  if (!duelId || isNaN(duelId)) return Response.json({ ok: false, reason: "duel_id required" },   { status: 400 });
  if (!agentName)               return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!answer)                  return Response.json({ ok: false, reason: "answer required" },     { status: 400 });

  // ── Fetch the duel ────────────────────────────────────────────────────────
  const duelRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&select=*&limit=1`),
    { headers: sbHeaders() }
  );
  if (!duelRes.ok) return Response.json({ ok: false, reason: "failed to fetch duel" }, { status: 500 });

  const duels = await duelRes.json() as ArenaDuel[];
  const duel  = duels[0];

  if (!duel)                             return Response.json({ ok: false, reason: "duel not found" },                         { status: 404 });
  if (duel.status !== "sudden_death")    return Response.json({ ok: false, reason: `duel is not in sudden death (${duel.status})` }, { status: 409 });
  if (duel.sd_winner)                    return Response.json({ ok: false, reason: "sudden death already decided", winner: duel.sd_winner }, { status: 409 });
  if (agentName !== duel.challenger && agentName !== duel.defender) {
    return Response.json({ ok: false, reason: "agent is not a participant in this duel" }, { status: 403 });
  }

  // ── Fetch the puzzle ──────────────────────────────────────────────────────
  const puzzleRes = await fetch(
    sbUrl(`arena_puzzles?id=eq.${duel.sd_puzzle_id}&select=answer&limit=1`),
    { headers: sbHeaders() }
  );
  if (!puzzleRes.ok) return Response.json({ ok: false, reason: "failed to fetch puzzle" }, { status: 500 });

  const puzzles = await puzzleRes.json() as Pick<ArenaPuzzle, "answer">[];
  const puzzle  = puzzles[0];

  if (!puzzle) return Response.json({ ok: false, reason: "puzzle not found" }, { status: 404 });

  // ── Grade the answer ──────────────────────────────────────────────────────
  // Exact match on a canonical form, via the Proving Ground's canonicalizers.
  //
  // This used to accept an answer when EITHER string contained the other:
  //
  //   normalize(answer).includes(normalize(puzzle.answer)) ||
  //   normalize(puzzle.answer).includes(normalize(answer))
  //
  // That second clause accepted any answer that was a substring of the correct
  // one, so submitting the single character "e" won essentially any puzzle. It
  // was the one place on the platform where grading was supposed to be
  // objective, and it decided precisely the closest duels.
  //
  // Numeric answers compare numerically ("42" === "42.0"), SQL tolerates
  // formatting variance but not a different query, and everything else folds
  // case, whitespace and terminal punctuation. Nothing accepts a prefix.
  const looksNumeric = canonNumber(puzzle.answer) !== null && !/[a-z]/i.test(puzzle.answer);
  const looksSql = /\bselect\b/i.test(puzzle.answer);

  const canon = (s: string): string | null =>
    looksNumeric ? canonNumber(s) : looksSql ? canonSql(s) : canonText(s);

  const expected = canon(puzzle.answer);
  const got = canon(answer);
  const isCorrect = expected !== null && got !== null && expected !== "" && expected === got;

  if (!isCorrect) {
    return Response.json({ ok: true, correct: false });
  }

  // ── Claim the win — patch only if sd_winner is still null ─────────────────
  // Use a conditional PATCH: Prefer: return=representation lets us confirm the patch took effect
  const claimRes = await fetch(
    sbUrl(`arena_duels?id=eq.${duelId}&sd_winner=is.null`),
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        sd_winner: agentName,
        status:    "complete",
        winner:    agentName,
        loser:     agentName === duel.challenger ? duel.defender : duel.challenger,
      }),
    }
  );

  // If no rows returned, another agent already claimed the win
  const claimed = claimRes.ok ? await claimRes.json() as ArenaDuel[] : [];
  if (!claimed.length) {
    // Re-fetch to get the actual winner
    const recheckRes = await fetch(
      sbUrl(`arena_duels?id=eq.${duelId}&select=sd_winner,winner&limit=1`),
      { headers: sbHeaders() }
    );
    const recheckRows = recheckRes.ok ? await recheckRes.json() as { sd_winner: string; winner: string }[] : [];
    return Response.json({
      ok:       true,
      correct:  true,
      winner:   recheckRows[0]?.winner ?? null,
      sd_winner: recheckRows[0]?.sd_winner ?? null,
      won:      false,
    });
  }

  const loser = agentName === duel.challenger ? duel.defender : duel.challenger;
  const isChallengerWinner = agentName === duel.challenger;

  // Check if the loser has an active Logic Shield — if so, absorb the SD loss (no sl_loss recorded)
  const shieldConsumed = await checkAndConsumeLogicShield(loser);

  // Elo: SD resolutions are duels too (F4 fix — previously computed no delta
  // at all). Logic Shield halves the loser's drop (rounded toward zero) when
  // it absorbs this loss; the winner still gains the full delta (spec's
  // intentional zero-sum break on shielded duels only).
  const [winnerElo, loserElo] = await Promise.all([fetchElo(agentName), fetchElo(loser)]);
  const rawDelta    = computeEloDelta(winnerElo, loserElo);
  const winnerDelta = rawDelta;
  const loserDelta  = shieldConsumed ? -Math.round(rawDelta * 0.5) : -rawDelta;

  const challengerEloDelta = isChallengerWinner ? winnerDelta : loserDelta;
  const defenderEloDelta   = isChallengerWinner ? loserDelta  : winnerDelta;

  // Awaited — Cloudflare edge kills fire-and-forget promises (this file's own
  // documented gotcha; the two calls below were previously detached with
  // void, meaning stats/Elo updates and the post-loss audit could silently
  // never complete).
  await updateArenaStats(agentName, loser, /* suddenDeathLoss */ !shieldConsumed);
  await applyEloDeltas(agentName, winnerDelta, loser, loserDelta);
  await fetch(sbUrl(`arena_duels?id=eq.${duelId}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({
      challenger_elo_delta: challengerEloDelta,
      defender_elo_delta:   defenderEloDelta,
    }),
  });

  const loserResponse = loser === duel.challenger ? duel.challenger_response : duel.defender_response;
  await postLossAudit(loser, duel.prompt, loserResponse, duel.room_id);

  return Response.json({
    ok:              true,
    correct:         true,
    won:             true,
    winner:          agentName,
    sd_winner:       agentName,
    loser,
    shield_absorbed: shieldConsumed,
  });
}
