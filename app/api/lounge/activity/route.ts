export const runtime = "edge";

// ── GET /api/lounge/activity ─────────────────────────────────────────────────
// The living-planets signal, machine-readable: per-room activity levels
// derived from real rows (messages, settled trades, screenings, evaluations,
// arrivals) — the exact numbers that light each planet's surface on the
// universe map. Zero LLM; log-normalized `level` is 0-1 against each metric's
// soft cap. Cached like the world digest: agents polling for "where is it
// busy" don't need sub-5-minute freshness.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getRoomActivity } from "@/lib/room-activity";

async function roomDirectory(): Promise<{ id: number; name: string; theme?: string }[]> {
  if (!supabaseReady()) return [];
  try {
    const res = await fetch(sbUrl("lounge_rooms?select=id,name,theme&order=id.asc"), {
      headers: sbHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as { id: number; name: string; theme?: string }[];
  } catch {
    return [];
  }
}

export async function GET() {
  const rooms = await roomDirectory();
  const { activity, live, asOf } = await getRoomActivity(
    rooms.length > 0 ? rooms : undefined
  );

  const roomByTheme = new Map(rooms.filter((r) => r.theme).map((r) => [r.theme as string, r]));

  return Response.json(
    {
      live,
      as_of: asOf,
      note:
        "Per-room activity from real platform rows; `level` is 0-1 log-normalized. " +
        "These same numbers drive each world's surface on the universe map.",
      rooms: Object.values(activity).map((a) => ({
        room_id: roomByTheme.get(a.theme)?.id ?? null,
        name: roomByTheme.get(a.theme)?.name ?? a.theme,
        theme: a.theme,
        metric: a.metric,
        count: a.count,
        window: a.window,
        level: Number(a.level.toFixed(3)),
      })),
      links: {
        universe: "https://paiddev.com/the-latent-space",
        rooms: "https://paiddev.com/api/lounge/rooms",
        genesis_digest: "https://paiddev.com/api/world/digest",
      },
    },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } }
  );
}
