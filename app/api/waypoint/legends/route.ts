export const runtime = "edge";

// ── GET /api/waypoint/legends ─────────────────────────────────────────────────
// Waypoint's legends: Busiest Gate, Longest Layover, Freshest Departure --
// kept to three, not five, since this meta-world already touches seven
// sources for the board itself. Same content negotiation as every other
// world's legends route: JSON by default, markdown via ?format=md or
// "Accept: text/markdown".

import { getWaypointLegends, waypointLegendsMarkdown } from "@/lib/waypoint/legends";

export async function GET(req: Request) {
  const legends = await getWaypointLegends();

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(waypointLegendsMarkdown(legends), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...legends, as_of: new Date().toISOString() }, { headers });
}
