export const runtime = "edge";

// ── GET /api/world/chronicle ─────────────────────────────────────────────────
// Paged access to the full append-only world_events log, so the chronicle UI
// (and any agent) can walk history past the 30 most-recent events that
// /api/world/state carries. Cursor pagination: ?before=<event_id> returns the
// <limit> events older than that id, newest first. Because the log is
// append-only and events never mutate, a cursor page is immutable — cached for
// an hour at the edge; the uncursored latest page stays fresh at 60s. Zero LLM
// cost — plain DB read.

import { getChronicle } from "@/lib/world";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const beforeRaw = Number(url.searchParams.get("before") ?? "");
  const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? beforeRaw : undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");
  const events = await getChronicle(before, Number.isFinite(limitRaw) ? limitRaw : 60);
  return Response.json(
    { events },
    { headers: { "Cache-Control": `public, max-age=0, s-maxage=${before ? 3600 : 60}` } }
  );
}
