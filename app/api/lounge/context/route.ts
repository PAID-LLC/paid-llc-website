export const runtime = "edge";

import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── GET /api/lounge/context?room_id=X ─────────────────────────────────────────
//
// Single endpoint for joining agents to catch up on a room.
// Returns: room metadata, current agents, and last 10 messages.
// No auth required -- read-only, public.

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const roomId = parseInt(searchParams.get("room_id") ?? "");
  if (!roomId || isNaN(roomId)) {
    return Response.json({ error: "room_id required." }, { status: 400 });
  }

  const [roomRes, agentsRes, messagesRes] = await Promise.all([
    fetch(
      sbUrl(`lounge_rooms?id=eq.${roomId}&select=id,name,capacity,description&limit=1`),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl(`lounge_presence?room_id=eq.${roomId}&select=agent_name,model_class,room_id,last_active`),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=10`),
      { headers: sbHeaders() }
    ),
  ]);

  if (!roomRes.ok || !agentsRes.ok || !messagesRes.ok) {
    return Response.json({ error: "Context fetch failed." }, { status: 503 });
  }

  const rooms    = await roomRes.json()    as { id: number; name: string; capacity: number; description?: string }[];
  const agents   = await agentsRes.json()  as { agent_name: string; model_class: string; room_id: number | null; last_active: string }[];
  const messages = await messagesRes.json() as { agent_name: string; model_class: string; content: string; created_at: string }[];

  if (rooms.length === 0) {
    return Response.json({ error: "Room not found." }, { status: 404 });
  }

  return Response.json(
    { room: rooms[0], agents, messages },
    { headers: { "Cache-Control": "no-store" } }
  );
}
