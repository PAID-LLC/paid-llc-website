export const runtime = "edge";

// ── GET /api/world/legends ───────────────────────────────────────────────────
// Legends mode: the whole Genesis record compiled into era-bucketed history
// with earned titles (Dwarf Fortress pattern, dynamic-agent-worlds reference
// map 2026-07-18). Zero LLM cost — a pure compile over the same append-only
// rows the chronicle reads. History only changes on a tick, so this caches
// harder than /state (s-maxage=300).
//
// Content negotiation mirrors /api/world/digest: JSON by default, the full
// history as one markdown document via "Accept: text/markdown" or ?format=md.

import { getWorldLegends, legendsMarkdown } from "@/lib/world-legends";

export async function GET(req: Request) {
  const legends = await getWorldLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(legendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
