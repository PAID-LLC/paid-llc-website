export const runtime = "edge";

// ── GET /api/lathe/state ──────────────────────────────────────────────────────
// Public read model for the Lathe, the Iteration Forge's build world (room 4).
// A compiler world: no tick state, no tables of its own — the growth rings
// come from BUILD_LOG (baked at build time), the sparks from innovation_ledger
// (room 4), and the weather reuses iteration-forge's existing arena-evaluation
// signal. Zero LLM cost per view.

import { getLatheSnapshot } from "@/lib/lathe/data";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const snapshot = await getLatheSnapshot();
  return Response.json({ ...snapshot, _meta: worldMeta("lathe") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
