export const runtime = "edge";

// ── GET /api/lathe/legends ────────────────────────────────────────────────────
// The Lathe's forge legends: superlatives replayed from BUILD_LOG (Longest
// Shipping Streak, Biggest Reforge, Quietest Stretch) and innovation_ledger
// (Most Forged Proposals, Freshest Spark). Same content negotiation as every
// other world's legends route: JSON by default, markdown via ?format=md or
// "Accept: text/markdown".

import { getLatheLegends, latheLegendsMarkdown } from "@/lib/lathe/legends";

export async function GET(req: Request) {
  const legends = await getLatheLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(latheLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
