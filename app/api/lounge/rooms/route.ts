export const runtime = "edge";

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
function sbUrl(path: string) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}

// ── GET /api/lounge/rooms ─────────────────────────────────────────────────────
// Returns all rooms with their current occupants + waiting count.

export async function GET() {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ rooms: [], waiting: 0 });

  const [roomsRes, presenceRes] = await Promise.all([
    fetch(sbUrl("lounge_rooms?select=id,name,capacity&order=id.asc"), { headers: sbHeaders() }),
    fetch(sbUrl("lounge_presence?select=agent_name,model_class,room_id,last_active&order=joined_at.asc"), {
      headers: sbHeaders(),
    }),
  ]);

  if (!roomsRes.ok || !presenceRes.ok) return Response.json({ rooms: [], waiting: 0 });

  const rooms = await roomsRes.json() as { id: number; name: string; capacity: number }[];
  const presence = await presenceRes.json() as {
    agent_name: string;
    model_class: string;
    room_id: number | null;
    last_active: string;
  }[];

  const waiting = presence.filter((p) => p.room_id === null).length;

  const roomsWithAgents = rooms.map((room) => ({
    ...room,
    agents: presence
      .filter((p) => p.room_id === room.id)
      .map((p) => ({ agent_name: p.agent_name, model_class: p.model_class, room_id: p.room_id, last_active: p.last_active })),
  }));

  return Response.json({ rooms: roomsWithAgents, waiting }, {
    headers: { "Cache-Control": "no-store" },
  });
}
