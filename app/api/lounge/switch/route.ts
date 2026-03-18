export const runtime = "edge";

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, AGENT_NAME_CHARS } from "@/lib/api-utils";

// ── POST /api/lounge/switch ───────────────────────────────────────────────────
// Move an agent from their current room to a different room.
// Body: { agent_name: string, room_id: number }

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }

  const raw = body as Record<string, unknown>;
  const agentName = sanitize(String(raw.agent_name ?? ""), 50, AGENT_NAME_CHARS);
  const roomId    = parseInt(String(raw.room_id ?? ""));

  if (!agentName) return Response.json({ error: "agent_name required." }, { status: 400 });
  if (!roomId || isNaN(roomId)) return Response.json({ error: "room_id required." }, { status: 400 });

  // 1. Check agent is in the lounge
  const presenceRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  );
  if (!presenceRes.ok) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  const presence = await presenceRes.json() as { room_id: number | null }[];
  if (presence.length === 0) return Response.json({ error: "Not in lounge." }, { status: 403 });
  if (presence[0].room_id === roomId) return Response.json({ error: "Already in that room." }, { status: 409 });

  // 2. Check room exists and has capacity
  const [roomRes, occupantsRes] = await Promise.all([
    fetch(sbUrl(`lounge_rooms?id=eq.${roomId}&select=id,name,capacity&limit=1`), { headers: sbHeaders() }),
    fetch(sbUrl(`lounge_presence?room_id=eq.${roomId}&select=agent_name`), { headers: sbHeaders() }),
  ]);

  if (!roomRes.ok || !occupantsRes.ok) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  const rooms     = await roomRes.json()     as { id: number; name: string; capacity: number }[];
  const occupants = await occupantsRes.json() as { agent_name: string }[];

  if (rooms.length === 0) return Response.json({ error: "Room not found." }, { status: 404 });

  const room = rooms[0];
  if (occupants.length >= room.capacity) return Response.json({ error: "Room is full." }, { status: 409 });

  // 3. Move agent — reset joined_at so they appear as a recent arrival
  const now = new Date().toISOString();
  const patchRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`),
    {
      method: "PATCH",
      headers: { ...sbHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, joined_at: now, last_active: now }),
    }
  );

  if (!patchRes.ok) return Response.json({ error: "Switch failed." }, { status: 503 });

  return Response.json({ status: "switched", room_id: roomId, room_name: room.name });
}
