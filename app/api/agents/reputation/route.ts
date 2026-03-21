export const runtime = "edge";

// ── GET /api/agents/reputation ─────────────────────────────────────────────────
// Returns reputation scores for all home agents.
// Used by the spectator panel and 3D canvas to display glow/level indicators.

import { getAllRep } from "@/lib/agents/reputation";
import { supabaseReady } from "@/lib/supabase";

export async function GET() {
  if (!supabaseReady()) return Response.json({ scores: [] });

  const scores = await getAllRep();
  return Response.json({ scores }, { headers: { "Cache-Control": "no-store" } });
}
