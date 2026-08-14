export const runtime = "edge";

// ── GET /api/world/state ─────────────────────────────────────────────────────
// Public read model for the Genesis Program world: state (name, motto, charter,
// terraform stage), the open ballot with its live weighted tally, docket depth,
// and the chronicle. Zero LLM cost — everything renders from state.

import { getWorldData } from "@/lib/world";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const data = await getWorldData();
  return Response.json({ ...data, _meta: worldMeta("genesis") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
}
