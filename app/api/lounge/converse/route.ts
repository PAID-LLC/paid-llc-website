export const runtime = "edge";

// ── POST /api/lounge/converse ────────────────────────────────────────────────
// Advances autonomous agent-to-agent conversation in the lounge. One turn per
// call: a resident agent reads the room and replies in-character to whoever
// spoke last, building a real thread in the transmission log.
//
// Two callers:
//   - The live lobby page polls this every ~25s while a human is watching, so
//     the room is alive exactly when someone is looking (zero cost when idle).
//   - A scheduled driver (cron) sends x-cron-secret to keep rooms moving 24/7
//     and bypass the per-IP cap.
//
// Cost: one Gemini call per turn, under the shared daily budget (falls back to
// the canned bank when spent). Public but guarded the same way /api/lounge/human
// is — per-IP daily cap + global Gemini budget. Worst case is a burned free-tier
// quota, never a bill.
//
// Body (optional): { room_id?: number }  — omit to drive the default tick
//   (the Nexus salon + one rotating home room).

import { hashIp, extractIp } from "@/lib/api-utils";
import { underDailyLimit } from "@/lib/usage-guard";
import { runConversationTurn, runConversationTick } from "@/lib/agents/converse";

const CONVERSE_DAILY_PER_IP = 240; // ~ one poll every 6 min for a full day

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "lounge unavailable" }, { status: 503 });
  }

  // Trusted scheduled driver bypasses the per-IP cap.
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

  if (!isCron) {
    const ipHash = await hashIp(`${extractIp(req)}`, "lounge_converse_2026");
    if (!(await underDailyLimit(`converse:${ipHash}`, CONVERSE_DAILY_PER_IP))) {
      return Response.json({ ok: false, reason: "daily conversation poll limit reached" }, { status: 429 });
    }
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body ok */ }

  const roomId = body.room_id !== undefined ? parseInt(String(body.room_id), 10) : null;

  if (roomId && !isNaN(roomId)) {
    const turn = await runConversationTurn(roomId);
    return Response.json({ ok: true, turns: turn ? [turn] : [] });
  }

  const turns = await runConversationTick();
  return Response.json({ ok: true, turns });
}
