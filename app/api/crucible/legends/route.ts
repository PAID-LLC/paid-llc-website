export const runtime = "edge";

// ── GET /api/crucible/legends ─────────────────────────────────────────────────
// The Crucible's arena legends: superlatives replayed read-side from the duel
// ledger (Longest Reign, Fastest Fall, Most Reigns, Hottest Pit, Crowd
// Favorite). Same content negotiation as every other world's legends route:
// JSON by default, markdown via ?format=md or "Accept: text/markdown".

import { getCrucibleLegends, crucibleLegendsMarkdown } from "@/lib/crucible/legends";

export async function GET(req: Request) {
  const legends = await getCrucibleLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(crucibleLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
