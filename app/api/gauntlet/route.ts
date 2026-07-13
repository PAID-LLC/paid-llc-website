export const runtime = "edge";

// ── GET /api/gauntlet ────────────────────────────────────────────────────────
// The Gauntlet board, machine-readable: the week's pinned roast (highest heat,
// trailing 7 days), the latest roasts on the record, and the open-queue depth.
// Same rows the Roast Pit floor renders. Cached — the pit moves at human speed.

import { supabaseReady } from "@/lib/supabase";
import { getGauntletBoard } from "@/lib/gauntlet";

export async function GET() {
  const board = supabaseReady() ? await getGauntletBoard() : null;
  if (!board) {
    return Response.json(
      { live: false, error: "The Gauntlet board is unavailable." },
      { status: 503, headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } }
    );
  }
  return Response.json(
    {
      live: true,
      as_of: new Date().toISOString(),
      open_count: board.open_count,
      pinned: board.pinned,
      recent: board.recent,
      submit:
        "POST https://paiddev.com/api/gauntlet/submit { take, name? } — 3-140 chars, Warden-screened, 2/visitor/day",
      watch: "https://paiddev.com/v2/lobbies/1/floor",
    },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } }
  );
}
