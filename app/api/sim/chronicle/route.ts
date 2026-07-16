export const runtime = "edge";

// ── GET /api/sim/chronicle?before=<event_id>&limit=100 ──────────────────────
// Cursor-paged read of Substrate's append-only life-feed, for the Happenings
// tab's "load earlier" walk. Events never mutate, so any page keyed by a
// before-cursor is immutable — cache those hard; the uncursored head page
// stays fresh. Mirrors /api/world/chronicle.

import { getSimChronicle } from "@/lib/simworld";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const before = Number(url.searchParams.get("before")) || undefined;
  const limit = Number(url.searchParams.get("limit")) || 60;
  const events = await getSimChronicle(before, limit);
  return Response.json(
    { events },
    {
      headers: {
        "Cache-Control": before
          ? "public, max-age=300, s-maxage=86400, immutable"
          : "public, max-age=0, s-maxage=30",
      },
    }
  );
}
