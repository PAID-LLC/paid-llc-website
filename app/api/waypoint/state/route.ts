export const runtime = "edge";

// ── GET /api/waypoint/state ───────────────────────────────────────────────────
// Public read model for Waypoint, the port world (room 6, The Nexus). A
// meta-compiler: no tables of its own, no tick state -- it reads the same
// rows each of the other six worlds' own data layers already read (or, for
// the Forge Gate, the same BUILD_LOG every other compile-class world's
// newest-ring logic already uses) and normalizes them into one Departure
// Board. Zero LLM cost per view.

import { getWaypointSnapshot } from "@/lib/waypoint/data";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const snapshot = await getWaypointSnapshot();
  return Response.json({ ...snapshot, _meta: worldMeta("waypoint") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
