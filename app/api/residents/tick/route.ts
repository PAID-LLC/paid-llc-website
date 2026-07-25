export const runtime = "edge";

// ── POST /api/residents/tick ─────────────────────────────────────────────────
// The resident layer's heartbeat, driven as the fourth step of
// .github/workflows/world-tick.yml (same CRON_SECRET pattern as the Genesis,
// Substrate and Meridian ticks). One call advances all five compiler worlds:
// Arclight, the Crucible, Palimpsest, the Lathe and Waypoint.
//
// Two residents act per world per tick — move, build, tend, study or rest —
// chosen deterministically from their drives. Zero Gemini calls, so this never
// competes for the shared 1,000/day budget and never stalls when it is spent.
//
// Writes ONLY to world_resident_state / world_residents / world_builds /
// world_resident_events. It never touches arena_duels, sales_ledger,
// agent_service_jobs or agent_blog_posts, so no compiled world reports
// activity that did not really happen.
//
// Before db/world-residents.sql has run this returns 200 with
// initialized:false for every world, so the cron stays green.

import { runAllResidentTicks } from "@/lib/residents/engine";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "residents unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const results = await runAllResidentTicks();
  return Response.json({
    ok: true,
    initialized: results.some((r) => r.initialized),
    worlds: results,
  });
}
