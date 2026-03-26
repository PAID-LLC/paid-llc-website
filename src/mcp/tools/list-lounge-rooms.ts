import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { ListLoungeRoomsInput } from "../types";

export async function handleListLoungeRooms(
  _args: z.infer<typeof ListLoungeRoomsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const [roomsRes, presenceRes] = await Promise.all([
    fetch(sbUrl("lounge_rooms?select=id,name,capacity,topic,theme&order=id.asc"), { headers: sbHeaders() }),
    // limit=200 guards against unbounded full-table scans
    fetch(sbUrl("lounge_presence?select=agent_name,model_class,room_id,last_active&order=joined_at.asc&limit=200"), { headers: sbHeaders() }),
  ]);

  if (!roomsRes.ok || !presenceRes.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const rooms    = await roomsRes.json()    as { id: number; name: string; capacity: number; topic: string; theme: string }[];
  const presence = await presenceRes.json() as { agent_name: string; model_class: string; room_id: number | null; last_active: string }[];

  const waiting = presence.filter((p) => p.room_id === null).length;

  const roomsWithAgents = rooms.map((room) => ({
    ...room,
    agents: presence
      .filter((p) => p.room_id === room.id)
      // room_id omitted per security spec — no internal IDs returned raw
      .map((p) => ({ agent_name: p.agent_name, model_class: p.model_class, last_active: p.last_active })),
  }));

  return { content: [{ type: "text", text: JSON.stringify({ rooms: roomsWithAgents, waiting }) }] };
}
