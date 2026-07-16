export const runtime = "edge";

// ── GET /api/sim/state ───────────────────────────────────────────────────────
// Public read model for Substrate (Run 01), the Simulation Sandbox's living
// world: run clock (tick/day/season/weather), the cast with live positions,
// energy, moods and goals, structures, discoveries, relationships, and the
// latest life-feed events. Zero LLM cost — everything renders from state.

import { getSimData } from "@/lib/simworld";

export async function GET() {
  const data = await getSimData();
  return Response.json(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
}
