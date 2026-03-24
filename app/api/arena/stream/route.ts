export const runtime = "edge";
export const dynamic = "force-dynamic";

// ── GET /api/arena/stream?duel_id=X  OR  ?room_id=X ──────────────────────────
//
// SSE stream for arena duel state. Accepts either:
//   - duel_id: stream a specific duel's status changes
//   - room_id: auto-find the latest active duel in the room and stream it
//
// Pushes full duel payload on status change, including puzzle text in sudden_death.
// Sends `null` when no active duel exists (room_id mode only).
// Closes after 55 seconds — clients auto-reconnect via EventSource.

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { ArenaDuel, ArenaPuzzle, SelfEvalSummary } from "@/lib/arena-types";

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return new Response("Arena unavailable.", { status: 503 });

  const { searchParams } = new URL(req.url);
  const duelIdParam = searchParams.get("duel_id");
  const roomIdParam = searchParams.get("room_id");

  const duelId = duelIdParam ? parseInt(duelIdParam) : null;
  const roomId = roomIdParam ? parseInt(roomIdParam) : null;

  if ((!duelId || isNaN(duelId)) && (!roomId || isNaN(roomId!))) {
    return new Response("duel_id or room_id required.", { status: 400 });
  }

  const encoder    = new TextEncoder();
  let   closed     = false;
  let   lastStatus = "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        if (closed) return;
        try {
          // Resolve target duel id
          let targetId = duelId;
          if (!targetId && roomId) {
            const activeRes = await fetch(
              sbUrl(`arena_duels?room_id=eq.${roomId}&status=neq.complete&order=created_at.desc&select=id&limit=1`),
              { headers: sbHeaders() }
            );
            const active = activeRes.ok ? await activeRes.json() as { id: number }[] : [];
            targetId = active[0]?.id ?? null;
          }

          let isSelfEvalFallback = false;
          if (!targetId && roomId) {
            // Fallback: show recent self-eval (last 10min) when no active duel
            const cutoff = new Date(Date.now() - 600_000).toISOString();
            const seRes  = await fetch(
              sbUrl(`arena_duels?room_id=eq.${roomId}&mode=eq.self_eval&status=eq.complete&created_at=gte.${cutoff}&order=created_at.desc&select=id&limit=1`),
              { headers: sbHeaders() }
            );
            const seRows = seRes.ok ? await seRes.json() as { id: number }[] : [];
            targetId = seRows[0]?.id ?? null;
            isSelfEvalFallback = targetId !== null;
          }

          if (!targetId) {
            if (lastStatus !== "null") {
              lastStatus = "null";
              controller.enqueue(encoder.encode(`data: null\n\n`));
            }
            return;
          }

          const res = await fetch(
            sbUrl(
              `arena_duels?id=eq.${targetId}&select=id,challenger,defender,prompt,status,winner,loser,jury_scores,sudden_death,sd_puzzle_id,sd_winner,challenger_response,defender_response,duel_started_at,challenger_submitted_at,defender_submitted_at,challenger_elo_delta,defender_elo_delta,mode,challenger_team,defender_team,team_submissions&limit=1`
            ),
            { headers: sbHeaders() }
          );
          if (!res.ok || closed) return;

          const rows = await res.json() as Partial<ArenaDuel>[];
          const duel = rows[0];
          if (!duel) return;

          // Fetch puzzle text when in sudden_death
          let sdPuzzle: { type: string; prompt: string } | null = null;
          if (duel.status === "sudden_death" && duel.sd_puzzle_id) {
            const pRes = await fetch(
              sbUrl(`arena_puzzles?id=eq.${duel.sd_puzzle_id}&select=type,prompt&limit=1`),
              { headers: sbHeaders() }
            );
            const pRows = pRes.ok ? await pRes.json() as Pick<ArenaPuzzle, "type" | "prompt">[] : [];
            sdPuzzle = pRows[0] ?? null;
          }

          const snapshot = JSON.stringify({
            id: duel.id, status: duel.status, winner: duel.winner, sd_winner: duel.sd_winner,
            ch_ms: duel.challenger_submitted_at, def_ms: duel.defender_submitted_at,
            mode: duel.mode,
            team_sub_count: Object.keys(duel.team_submissions ?? {}).length,
          });

          if (snapshot !== lastStatus) {
            lastStatus = snapshot;

            // Compute submission timing (ms from duel start)
            const startedAt = duel.duel_started_at ? new Date(duel.duel_started_at).getTime() : null;
            const chMs  = startedAt && duel.challenger_submitted_at
              ? new Date(duel.challenger_submitted_at).getTime() - startedAt : null;
            const defMs = startedAt && duel.defender_submitted_at
              ? new Date(duel.defender_submitted_at).getTime() - startedAt : null;

            // Word counts
            const wc = (t: string | null | undefined) =>
              t ? t.split(/\s+/).filter(Boolean).length : null;

            // Fetch self-eval activity log when in fallback mode
          let selfEvalLog: SelfEvalSummary[] | undefined = undefined;
          if (isSelfEvalFallback && roomId) {
            const logCutoff = new Date(Date.now() - 600_000).toISOString();
            const logRes = await fetch(
              sbUrl(`arena_duels?room_id=eq.${roomId}&mode=eq.self_eval&status=eq.complete&created_at=gte.${logCutoff}&order=created_at.desc&select=id,challenger,prompt,jury_scores,created_at&limit=10`),
              { headers: sbHeaders() }
            );
            if (logRes.ok) {
              const logRows = await logRes.json() as Pick<ArenaDuel, "id" | "challenger" | "prompt" | "jury_scores" | "created_at">[];
              selfEvalLog = logRows.map(r => ({
                id:         r.id,
                challenger: r.challenger,
                prompt:     r.prompt,
                total:      r.jury_scores?.challenger ?? 0,
                created_at: r.created_at,
              }));
            }
          }

          const payload = {
              ...duel,
              sd_puzzle:              sdPuzzle,
              challenger_word_count:  wc(duel.challenger_response),
              defender_word_count:    wc(duel.defender_response),
              challenger_response_ms: chMs,
              defender_response_ms:   defMs,
              self_eval_log:          selfEvalLog,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        } catch { /* non-critical */ }
      };

      const interval = setInterval(poll, 2000);

      setTimeout(() => {
        clearInterval(interval);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }, 55_000);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
