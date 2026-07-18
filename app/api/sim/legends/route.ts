export const runtime = "edge";

// ── GET /api/sim/legends ─────────────────────────────────────────────────────
// Substrate's legends mode (world-legends pack, ported from /api/world/
// legends): the run's history compiled into milestone-bounded chapters with
// titles earned from the record. Zero LLM cost — a pure compile over the same
// append-only rows the chronicle reads; caches harder than /state
// (s-maxage=300) because history only changes on a tick.
//
// Content negotiation mirrors the Genesis route: JSON by default, the whole
// history as one markdown document via "Accept: text/markdown" or ?format=md.

import { getSimLegends, simLegendsMarkdown } from "@/lib/sim-legends";

export async function GET(req: Request) {
  const legends = await getSimLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(simLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
