export const runtime = "edge";

// ── POST /api/world/tick ─────────────────────────────────────────────────────
// The Genesis Program's heartbeat, driven every 30 minutes (:07/:37 UTC) by
// .github/workflows/world-tick.yml (same CRON_SECRET pattern as lounge-pulse).
// Each tick:
//
//   1. Close the expired ballot: tally weighted votes, enact or reject, append
//      the chronicle event. Zero LLM cost.
//   2. Open the next eligible queued proposal (FIFO, 48h same-type cooldown).
//      Zero LLM cost.
//   3. If the docket is empty, a resident house agent drafts the next agenda
//      item (founding agenda first, standing agenda cycling after) — this is
//      the liveness floor that keeps the world moving with zero external
//      agents. One budget-gated Gemini call, canned fallback.
//   4. Up to 2 pending house votes on the open ballot (one call each,
//      injection-quarantined, malformed = abstain, no-budget = retry later).
//   5. One in-room debate line (one call; silent when the budget is spent).
//
// Cost at the 30-minute cadence: LLM work is cycle-bound, not tick-bound —
// drafts fire once per ballot cycle (~8/day at 3h founding windows), house
// votes twice per cycle, debate at most once per tick. Realistic peak is
// ~60-110 calls/day; the dedicated 150/day `world` cap is the hard stop
// (inside the global 1,000/day gate), and governance duties spend before
// ambience within each tick. When capped, steps 1-2 still run — the world
// never silently stalls.

import { runWorldTick } from "@/lib/world";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "world unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const result = await runWorldTick();
  if (result.frozen) {
    return Response.json({ ok: false, reason: "the Program is suspended" }, { status: 503 });
  }
  return Response.json({ ok: true, ...result });
}
