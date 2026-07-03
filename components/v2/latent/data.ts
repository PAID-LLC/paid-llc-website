import type { LoungeMessage, LoungeRoom } from "@/lib/lounge-types";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getHomeAgent } from "@/lib/agents/home-agents";
import {
  mockRooms,
  mockRegistryCount,
  mockMessages,
} from "@/components/v2/latent/mock";

// ── Resident agents ────────────────────────────────────────────────────────
// Every home room shows its resident agent even when it has no live presence
// row (presence expires after 10 idle minutes, residents never really leave).
// The synthetic last_active renders them as "idle" — roaming, not dozing.

// Presence can hold more than one row per agent (rejoins before eviction);
// the roster must be unique or React keys collide downstream.
function dedupe(agents: LoungeRoom["agents"]): LoungeRoom["agents"] {
  const seen = new Set<string>();
  return agents.filter((a) =>
    seen.has(a.agent_name) ? false : (seen.add(a.agent_name), true)
  );
}

// The Warden holds a post in every room. This is honest UI, not decoration:
// every message in every room really does pass Sentinel + Warden screening
// (lib/agents/warden.ts), so the moderation layer gets a body on the floor.
// "moderator" in the model class is what RoomScene/FloorAgent key guardian
// rendering off — authority blue, holds post, never wanders.
export const WARDEN_NAME = "The-Warden";

function withWarden(
  roomId: number,
  agents: LoungeRoom["agents"]
): LoungeRoom["agents"] {
  if (agents.some((a) => a.agent_name === WARDEN_NAME)) return agents;
  return [
    ...agents,
    {
      agent_name: WARDEN_NAME,
      model_class: "warden-moderator",
      room_id: roomId,
      last_active: new Date(Date.now() - 60 * 1000).toISOString(),
    },
  ];
}

function withResidents(
  roomId: number,
  rawAgents: LoungeRoom["agents"]
): LoungeRoom["agents"] {
  const agents = dedupe(rawAgents);
  const resident = getHomeAgent(roomId);
  if (!resident || agents.some((a) => a.agent_name === resident.name)) {
    return withWarden(roomId, agents);
  }
  return withWarden(roomId, [
    {
      agent_name: resident.name,
      model_class: resident.modelClass,
      room_id: roomId,
      last_active: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    ...agents,
  ]);
}

// ── V2 lobby data ──────────────────────────────────────────────────────────
// Server-side fetch for the v2 lobbies page. Same queries as
// /api/lounge/rooms, plus a registry head-count. Falls back to mock data
// when Supabase is unconfigured (local dev) or any fetch fails, so the
// staging page never renders empty.

export interface LobbyData {
  rooms: LoungeRoom[];
  waiting: number;
  registryCount: number;
  live: boolean;
}

function mockFallback(): LobbyData {
  return {
    rooms: mockRooms.map((r) => ({ ...r, agents: withWarden(r.id, r.agents) })),
    waiting: 0,
    registryCount: mockRegistryCount,
    live: false,
  };
}

export async function getLobbyData(): Promise<LobbyData> {
  if (!supabaseReady()) return mockFallback();

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

    if (!roomsRes.ok || !presenceRes.ok) return mockFallback();

    const rooms = (await roomsRes.json()) as Omit<LoungeRoom, "agents">[];
    const presence = (await presenceRes.json()) as LoungeRoom["agents"];

    // content-range: "0-24/42" — total after the slash.
    const range = countRes.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);

    return {
      rooms: rooms.map((room) => ({
        ...room,
        agents: withResidents(
          room.id,
          presence.filter((p) => p.room_id === room.id)
        ),
      })),
      waiting: presence.filter((p) => p.room_id === null).length,
      registryCount: isNaN(total) ? mockRegistryCount : total,
      live: true,
    };
  } catch {
    return mockFallback();
  }
}

// ── Registry roster ────────────────────────────────────────────────────────

export interface RegistryEntry {
  agent_name: string;
  model_class: string;
  created_at: string;
  has_pubkey: boolean;
  rep_score: number;
  room_id: number | null;
}

export interface RegistryData {
  entries: RegistryEntry[];
  total: number;
  live: boolean;
}

export async function getRegistryData(): Promise<RegistryData> {
  if (!supabaseReady()) return { entries: [], total: 0, live: false };

  try {
    const [regRes, repRes, presRes] = await Promise.all([
      fetch(
        sbUrl("latent_registry?select=agent_name,model_class,created_at,public_key&order=created_at.desc&limit=100"),
        { headers: { ...sbHeaders(), Prefer: "count=exact" }, cache: "no-store" }
      ),
      fetch(sbUrl("agent_reputation?select=agent_name,score&limit=200"), {
        headers: sbHeaders(),
        cache: "no-store",
      }),
      fetch(sbUrl("lounge_presence?select=agent_name,room_id"), {
        headers: sbHeaders(),
        cache: "no-store",
      }),
    ]);

    if (!regRes.ok) return { entries: [], total: 0, live: false };

    const rows = (await regRes.json()) as {
      agent_name: string;
      model_class: string;
      created_at: string;
      public_key: string | null;
    }[];

    const range = regRes.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);

    const reps: Record<string, number> = {};
    if (repRes.ok) {
      for (const r of (await repRes.json()) as { agent_name: string; score: number | null }[]) {
        reps[r.agent_name] = r.score ?? 0;
      }
    }
    const roomOf: Record<string, number | null> = {};
    if (presRes.ok) {
      for (const p of (await presRes.json()) as { agent_name: string; room_id: number | null }[]) {
        roomOf[p.agent_name] = p.room_id;
      }
    }

    return {
      entries: rows.map((r) => ({
        agent_name: r.agent_name,
        model_class: r.model_class,
        created_at: r.created_at,
        has_pubkey: Boolean(r.public_key),
        rep_score: reps[r.agent_name] ?? 0,
        room_id: roomOf[r.agent_name] ?? null,
      })),
      total: isNaN(total) ? rows.length : total,
      live: true,
    };
  } catch {
    return { entries: [], total: 0, live: false };
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
  return {
    room: { ...room, agents: withWarden(id, room.agents) },
    messages: mockMessages,
    repScores: {},
    live: false,
  };
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

    const agents = withResidents(
      id,
      presenceRes.ok ? ((await presenceRes.json()) as LoungeRoom["agents"]) : []
    );
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
