export const runtime = "edge";

// ── POST /api/meridian/tick ────────────────────────────────────────────────
// Meridian's heartbeat, driven every 30 minutes alongside Genesis and
// Substrate in .github/workflows/world-tick.yml. Each tick:
//
//   1. Reads the Genesis assembly's governance record over a rolling 6-hour
//      window and eases the prosperity index toward that signal. Rebound
//      2026-08-11: this used to read credit revenue vs estimated token cost,
//      which was exactly 0.0 on essentially every tick and froze the world at
//      an index of 50 for 277 ticks. See lib/meridian/signals.ts.
//   2. Determines the market act (boom/stable/correction/bust) with a
//      6-tick hysteresis so the index hovering on a boundary can't flicker
//      the city's recorded state.
//   3. Moves all six citizens' stakes toward the level the act implies,
//      tracks true running peak/trough, and chronicles rags-to-riches /
//      riches-to-rags crossings.
//   4. Bonds/rifts form from correlated fortunes during extreme acts.
//   5. Ward structures get free upkeep outside a BUST; during a BUST the
//      most-overdue ward weathers, exactly like Substrate's storm decay.
//   6. A ward levels up the tick its citizen's stake newly crosses into
//      prosperous territory (LEGEND_HIGH), capped at level 3.
//
// Zero LLM cost — this is a deterministic economic simulation with no voice
// layer in v1. Before db/meridian.sql has run this returns 200
// {initialized:false} so the cron stays green.

import { runMeridianTick } from "@/lib/meridian/engine";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "meridian unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await runMeridianTick();
  return Response.json({ ok: true, ...result });
}
