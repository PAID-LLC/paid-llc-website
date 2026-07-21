export const runtime = "edge";

// ── GET /api/meridian/legends ──────────────────────────────────────────────
// Meridian's legends mode (world-legends pack, ported per lib/sim-legends.ts):
// the city's market history compiled into act-bounded chapters with titles
// earned from stake history. Zero LLM cost — a pure compile over the same
// append-only rows the chronicle reads.
//
// Content negotiation mirrors every other world: JSON by default, the whole
// history as one markdown document via "Accept: text/markdown" or ?format=md.

import { getMeridianLegends, meridianLegendsMarkdown } from "@/lib/meridian/legends";

export async function GET(req: Request) {
  const legends = await getMeridianLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(meridianLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
