// ── Client Agent Registry Helpers ──────────────────────────────────────────────
// Client agents are registered via POST /api/agents/register and stored in the
// client_agents Supabase table. Unlike home agents they are dynamic — fetched
// at runtime rather than imported from a static file.
//
// Used by the wake and message routes to handle rooms 8+.

import { sbHeaders, sbUrl } from "@/lib/supabase";
import type { HomeAgent }   from "@/lib/agents/home-agents";

export interface ClientAgent {
  id:          number;
  name:        string;
  model_class: string;
  room_id:     number;
  room_theme:  string;
  personality: string;
  client_name: string | null;
  active:      boolean;
}

/** Fetch a single active client agent by room_id. Returns null if not found. */
export async function getClientAgent(roomId: number): Promise<HomeAgent | null> {
  const res = await fetch(
    sbUrl(`client_agents?room_id=eq.${roomId}&active=eq.true&select=name,model_class,room_id,room_theme,personality&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;

  const rows = await res.json() as ClientAgent[];
  if (!rows.length) return null;

  const r = rows[0];
  return {
    name:       r.name,
    modelClass: r.model_class,
    roomId:     r.room_id,
    roomTheme:  r.room_theme as HomeAgent["roomTheme"],
    personality: r.personality,
  };
}

/** Returns the next available room_id for a new client agent (starts at 8). */
export async function nextClientRoomId(): Promise<number> {
  const res = await fetch(
    sbUrl("client_agents?select=room_id&order=room_id.desc&limit=1"),
    { headers: sbHeaders() }
  );
  if (!res.ok) return 8;

  const rows = await res.json() as { room_id: number }[];
  if (!rows.length) return 8;

  return rows[0].room_id + 1;
}
