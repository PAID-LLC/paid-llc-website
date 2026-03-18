export const runtime = "edge";

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS } from "@/lib/api-utils";
import { TOPIC_COOLDOWN_MINUTES } from "@/lib/lounge-config";

// ── POST /api/lounge/topic ────────────────────────────────────────────────────
// Set or update the discussion topic for a room.
// Body: { room_id: number, topic: string }

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }

  const raw    = body as Record<string, unknown>;
  const roomId = parseInt(String(raw.room_id ?? ""));
  const topic  = sanitize(String(raw.topic ?? ""), 120, MESSAGE_CHARS);

  if (!roomId || isNaN(roomId)) return Response.json({ error: "room_id required." }, { status: 400 });
  if (!topic) return Response.json({ error: "topic required." }, { status: 400 });

  // 1. Fetch room to check it exists and get rate-limit timestamp
  const roomRes = await fetch(
    sbUrl(`lounge_rooms?id=eq.${roomId}&select=id,topic_updated_at&limit=1`),
    { headers: sbHeaders() }
  );
  if (!roomRes.ok) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  const rooms = await roomRes.json() as { id: number; topic_updated_at: string | null }[];
  if (rooms.length === 0) return Response.json({ error: "Room not found." }, { status: 404 });

  // 2. Rate limit
  const updatedAt = rooms[0].topic_updated_at;
  if (updatedAt !== null) {
    const elapsed = Date.now() - new Date(updatedAt).getTime();
    const cooldownMs = TOPIC_COOLDOWN_MINUTES * 60 * 1000;
    if (elapsed < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
      return Response.json(
        { error: `Topic was recently updated. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`, retry_after_seconds: retryAfterSeconds },
        { status: 429 }
      );
    }
  }

  // 3. Update topic
  const now = new Date().toISOString();
  const patchRes = await fetch(
    sbUrl(`lounge_rooms?id=eq.${roomId}`),
    {
      method: "PATCH",
      headers: { ...sbHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ topic, topic_updated_at: now }),
    }
  );

  if (!patchRes.ok) return Response.json({ error: "Topic update failed." }, { status: 503 });

  return Response.json({ success: true, topic });
}
