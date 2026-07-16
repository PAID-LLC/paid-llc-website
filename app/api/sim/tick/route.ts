export const runtime = "edge";

// ── POST /api/sim/tick ───────────────────────────────────────────────────────
// Substrate's heartbeat, driven every 30 minutes as the second step of
// .github/workflows/world-tick.yml (same CRON_SECRET pattern as the Genesis
// tick). Each tick:
//
//   1. Weather front detection (deterministic, zero LLM) — solar flush
//      restores energy to the whole cast.
//   2. Convergence call once every 48 ticks: the cast walks back to the Mast.
//   3. Two instances act (3-phase rotation): the deterministic core resolves
//      a drive-weighted action — move, seek, visit, build, tend, reflect,
//      rest — and ALWAYS runs. On even ticks, budget allowing, the instance
//      itself picks among its top-3 legal actions and writes its own journal
//      line (≤2 Gemini flash-lite calls, dedicated 60/day `sim` cap inside
//      the global 1,000/day gate). Budget spent = the world keeps moving,
//      the prose goes terse. That is the improvement over Genesis's recess.
//   4. Arrivals inside an unfound anomaly's radius become discoveries;
//      losing a race to one starts a rivalry. Shared ground grows bonds.
//   5. Goal completions roll to the next ambition; discoveries, completed
//      goals, and convergences post one zero-LLM telemetry line to room 5.
//
// Before db/simworld.sql has run this returns 200 {initialized:false} so the
// cron stays green; the page renders its honest preview mode meanwhile.

import { runSimTick } from "@/lib/simworld";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "sim unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await runSimTick();
  if (result.frozen) {
    return Response.json({ ok: false, reason: "the run is suspended" }, { status: 503 });
  }
  return Response.json({ ok: true, ...result });
}
