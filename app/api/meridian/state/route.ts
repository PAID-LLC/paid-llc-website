export const runtime = "edge";

// ── GET /api/meridian/state ───────────────────────────────────────────────────
// Public read model for Meridian, the Macro-Vault's human colony: the market
// clock (tick/act/prosperity index), six citizens with live stakes and ward
// status, ward structures, relationships, and the latest chronicle events.
// Zero LLM cost — everything renders from state.

import { getMeridianData } from "@/lib/meridian/engine";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const data = await getMeridianData();
  return Response.json({ ...data, _meta: worldMeta("meridian") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
}
