export const runtime = "edge";

// ── GET /api/arclight/state ──────────────────────────────────────────────────
// Public read model for Arclight, the Bazaar's machine metropolis (room 7).
// A compiler world: no tick state of its own — the snapshot aggregates the
// commerce ledgers that already exist (catalog, catalog sales, escrow jobs,
// registry census, cost-cap counters, econ P&L) and the city renders from it
// deterministically via lib/arclight/cityplan. Zero LLM cost per view.
// Privacy: jobs ticker is sanitized (no buyer identity, no job bodies).

import { getArclightSnapshot } from "@/lib/arclight/data";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const snapshot = await getArclightSnapshot();
  return Response.json({ ...snapshot, _meta: worldMeta("arclight") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
