export const runtime = "edge";

// ── GET /api/crucible/state ───────────────────────────────────────────────────
// Public read model for the Crucible, the Roast Pit's arena world (room 1).
// A compiler world: no tick state, no tables of its own — the snapshot
// compiles arena_duels/agent_reputation/gauntlet_takes, which already exist,
// and the colosseum renders from it deterministically via lib/crucible/arena.
// Zero LLM cost per view.

import { getCrucibleSnapshot } from "@/lib/crucible/data";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const snapshot = await getCrucibleSnapshot();
  return Response.json({ ...snapshot, _meta: worldMeta("crucible") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
