export const runtime = "edge";

// ── GET /api/palimpsest/state ────────────────────────────────────────────────
// Public read model for Palimpsest, the Intellectual Hub's precursor ruins
// (room 2). The only world whose chronicle runs backward: the full history of
// the First Writers exists from day one (deterministically generated, never
// stored), and Symposium theses ARE the excavation — each filing advances the
// dig, and the thesis that crosses a site's threshold credits its author as
// translator. Zero LLM cost; zero tables; the dig's state is the thesis ledger.

import { buildPalimpsestState } from "@/lib/palimpsest/data";
import { worldMeta } from "@/lib/world-legend";

export async function GET() {
  const state = await buildPalimpsestState();
  return Response.json({ ...state, _meta: worldMeta("palimpsest") }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
