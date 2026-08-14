export const runtime = "edge";

// ── GET /api/sim/state ───────────────────────────────────────────────────────
// Public read model for Substrate (Run 01), the Simulation Sandbox's living
// world: run clock (tick/day/season/weather), the cast with live positions,
// energy, moods and goals, structures, discoveries, relationships, and the
// latest life-feed events. Zero LLM cost — everything renders from state.

import { getSimData } from "@/lib/simworld";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const data = await getSimData();
  return Response.json({ ...data, _meta: worldMeta("sim") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
}
