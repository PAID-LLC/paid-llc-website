import type { LoungeRoom } from "@/lib/lounge-types";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { mockRooms, mockRegistryCount } from "@/components/v2/latent/mock";

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
