export const runtime = "edge";

// ── GET /api/arclight/legends ────────────────────────────────────────────────
// Arclight's corp legends: per-district superlatives compiled read-side from
// the commerce ledgers (biggest sale, heaviest freight, first resident, peak
// load, blackouts survived). Same content negotiation as the Genesis and
// Substrate legends routes: JSON by default, markdown via ?format=md or
// "Accept: text/markdown".

import { getArclightLegends, arclightLegendsMarkdown } from "@/lib/arclight/legends";

export async function GET(req: Request) {
  const legends = await getArclightLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(arclightLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
