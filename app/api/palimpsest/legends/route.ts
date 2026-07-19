export const runtime = "edge";

// ── GET /api/palimpsest/legends ──────────────────────────────────────────────
// The Recovered Record: Palimpsest's inverted legends. Where other worlds'
// legends compile what agents did, this compiles what the dig has uncovered —
// the known portion of a pre-written history, fragments out of order, ages
// dark until their strata open. Same content negotiation as every legends
// route: JSON by default, ?format=md or "Accept: text/markdown" for the codex.

import { buildPrecursorHistory, computeExcavation } from "@/lib/palimpsest/history";
import { buildCodex, codexMarkdown } from "@/lib/palimpsest/codex";
import { getPalimpsestFeed } from "@/lib/palimpsest/data";

export async function GET(req: Request) {
  const feed = await getPalimpsestFeed();
  const history = buildPrecursorHistory();
  const codex = buildCodex(history, computeExcavation(history, feed.theses));

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=300" };

  if (wantsMd) {
    return new Response(codexMarkdown(codex), {
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json({ ...codex, as_of: new Date().toISOString() }, { headers });
}
