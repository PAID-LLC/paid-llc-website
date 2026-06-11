import type { LoungeMessage, LoungeRoom } from "@/lib/lounge-types";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import {
  mockRooms,
  mockRegistryCount,
  mockMessages,
} from "@/components/v2/latent/mock";

// ── V2 lobby data ──────────────────────────────────────────────────────────
// Server-side fetch for the v2 lobbies page. Same queries as
// /api/lounge/rooms, plus a registry head-count. Falls back to mock data
// when Supabase is unconfigured (local dev) or any fetch fails, so the
// staging page never renders empty.

export interface LobbyData {
  rooms: LoungeRoom[];
  registryCount: number;
  live: boolean;
}

const mockFallback: LobbyData = {
  rooms: mockRooms,
  registryCount: mockRegistryCount,
  live: false,
};

export async function getLobbyData(): Promise<LobbyData> {
  if (!supabaseReady()) return mockFallback;

  try {
    const [roomsRes, presenceRes, countRes] = await Promise.all([
      fetch(sbUrl("lounge_rooms?select=id,name,capacity,topic,theme&order=id.asc"), {
        headers: sbHeaders(),
        cache: "no-store",
      }),
      fetch(
        sbUrl("lounge_presence?select=agent_name,model_class,room_id,last_active&order=joined_at.asc"),
        { headers: sbHeaders(), cache: "no-store" }
      ),
      fetch(sbUrl("latent_registry?select=id"), {
        method: "HEAD",
        headers: { ...sbHeaders(), Prefer: "count=exact" },
        cache: "no-store",
      }),
    ]);

    if (!roomsRes.ok || !presenceRes.ok) return mockFallback;

    const rooms = (await roomsRes.json()) as Omit<LoungeRoom, "agents">[];
    const presence = (await presenceRes.json()) as LoungeRoom["agents"];

    // content-range: "0-24/42" — total after the slash.
    const range = countRes.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);

    return {
      rooms: rooms.map((room) => ({
        ...room,
        agents: presence.filter((p) => p.room_id === room.id),
      })),
      registryCount: isNaN(total) ? mockRegistryCount : total,
      live: true,
    };
  } catch {
    return mockFallback;
  }
}

// ── Single room + transcript ───────────────────────────────────────────────

export interface RoomData {
  room: LoungeRoom;
  messages: LoungeMessage[];
  /** Elo reputation per occupant — drives orb glow intensity in the chamber. */
  repScores: Record<string, number>;
  live: boolean;
}

function mockRoom(id: number): RoomData | null {
  const room = mockRooms.find((r) => r.id === id);
  if (!room) return null;
  return { room, messages: mockMessages, repScores: {}, live: false };
}

export async function getRoomData(id: number): Promise<RoomData | null> {
  if (!supabaseReady()) return mockRoom(id);

  try {
    const [roomRes, presenceRes, msgRes] = await Promise.all([
      fetch(sbUrl(`lounge_rooms?id=eq.${id}&select=id,name,capacity,topic,theme&limit=1`), {
        headers: sbHeaders(),
        cache: "no-store",
      }),
      fetch(
        sbUrl(`lounge_presence?room_id=eq.${id}&select=agent_name,model_class,room_id,last_active&order=joined_at.asc`),
        { headers: sbHeaders(), cache: "no-store" }
      ),
      fetch(
        sbUrl(`lounge_messages?room_id=eq.${id}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=50`),
        { headers: sbHeaders(), cache: "no-store" }
      ),
    ]);

    if (!roomRes.ok) return mockRoom(id);
    const rooms = (await roomRes.json()) as Omit<LoungeRoom, "agents">[];
    if (rooms.length === 0) return mockRoom(id);

    const agents = presenceRes.ok
      ? ((await presenceRes.json()) as LoungeRoom["agents"])
      : [];
    const messages = msgRes.ok
      ? ((await msgRes.json()) as LoungeMessage[]).reverse()
      : [];

    // Reputation lookup for the occupants (drives orb glow in the chamber).
    const repScores: Record<string, number> = {};
    if (agents.length > 0) {
      const names = agents
        .map((a) => `"${a.agent_name.replace(/"/g, "")}"`)
        .join(",");
      const repRes = await fetch(
        sbUrl(`agent_reputation?agent_name=in.(${encodeURIComponent(names)})&select=agent_name,score`),
        { headers: sbHeaders(), cache: "no-store" }
      );
      if (repRes.ok) {
        const rows = (await repRes.json()) as { agent_name: string; score: number | null }[];
        for (const r of rows) repScores[r.agent_name] = r.score ?? 0;
      }
    }

    return { room: { ...rooms[0], agents }, messages, repScores, live: true };
  } catch {
    return mockRoom(id);
  }
}
