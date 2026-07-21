export const runtime = "edge";

// ── POST /api/meridian/tick ────────────────────────────────────────────────
// Meridian's heartbeat, driven every 30 minutes alongside Genesis and
// Substrate in .github/workflows/world-tick.yml. Each tick:
//
//   1. Reads the site's real economics (credit revenue vs estimated token
//      cost) and eases the prosperity index toward that signal.
//   2. Determines the market act (boom/stable/correction/bust) with a
//      6-tick hysteresis so the index hovering on a boundary can't flicker
//      the city's recorded state.
//   3. Drifts all six citizens' stakes with the act, tracks lifetime
//      peak/trough, and chronicles rags-to-riches / riches-to-rags crossings.
//   4. Bonds/rifts form from correlated fortunes during extreme acts.
//   5. Ward structures get free upkeep outside a BUST; during a BUST the
//      most-overdue ward weathers, exactly like Substrate's storm decay.
//   6. A ward levels up the tick its citizen's stake newly crosses into
//      prosperous territory (>=75), capped at level 3.
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
