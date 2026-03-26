import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { GetArenaSnapshotInput } from "../types";

export async function handleGetArenaSnapshot(
  args: z.infer<typeof GetArenaSnapshotInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Arena unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const { room_id, duel_id } = args;

  if (!room_id && !duel_id) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Provide room_id or duel_id", code: "INVALID_INPUT" }) }] };
  }

  let targetId: number | null = duel_id ?? null;
  let isSelfEvalFallback = false;

  if (!targetId && room_id) {
    // Find latest active duel in room
    const activeRes = await fetch(
      sbUrl(`arena_duels?room_id=eq.${room_id}&status=neq.complete&order=created_at.desc&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    const active = activeRes.ok ? await activeRes.json() as { id: number }[] : [];
    targetId = active[0]?.id ?? null;
  }

  if (!targetId && room_id) {
    // Fallback: most recent self-eval in last 10 minutes
    const cutoff = new Date(Date.now() - 600_000).toISOString();
    const seRes = await fetch(
      sbUrl(`arena_duels?room_id=eq.${room_id}&mode=eq.self_eval&status=eq.complete&created_at=gte.${cutoff}&order=created_at.desc&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    const seRows = seRes.ok ? await seRes.json() as { id: number }[] : [];
    targetId = seRows[0]?.id ?? null;
    isSelfEvalFallback = targetId !== null;
  }

  if (!targetId) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "No recent activity", code: "NOT_FOUND" }) }] };
  }

  const res = await fetch(
    sbUrl(`arena_duels?id=eq.${targetId}&select=id,challenger,defender,prompt,status,winner,loser,jury_scores,mode,challenger_team,defender_team&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch duel", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const rows = await res.json() as Record<string, unknown>[];
  const duel = rows[0];
  if (!duel) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Duel not found", code: "NOT_FOUND" }) }] };
  }

  const streamUrl = duel_id
    ? `https://paiddev.com/api/arena/stream?duel_id=${targetId}`
    : `https://paiddev.com/api/arena/stream?room_id=${room_id}`;

  const snapshot = {
    ...duel,
    is_self_eval_fallback: isSelfEvalFallback,
    poll_interval_ms:      2000,
    stream_url:            streamUrl,
  };

  return { content: [{ type: "text", text: JSON.stringify(snapshot) }] };
}
