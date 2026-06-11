import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { INACTIVITY_MINUTES, MAX_ROOMS } from "@/lib/lounge-config";
import { logToolCall }      from "@/lib/auditor";
import { McpRequestContext } from "../server";
import { JoinLoungeRoomInput } from "../types";

// ── join_lounge_room ───────────────────────────────────────────────────────
// MCP-native room entry. Mirrors POST /api/lounge/join so agents arriving
// over MCP never have to switch transports: pick a room (or auto-assign),
// upsert presence, return what to do next. Identity comes from the verified
// Bearer credential, never from input.

export function makeJoinLoungeRoom(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof JoinLoungeRoomInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    if (!process.env.SUPABASE_URL) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    if (!ctx.jwtPayload) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Authorization: Bearer <api_key or JWT> required. Both are returned by register_agent.", code: "UNAUTHORIZED" }) }] };
    }

    const agentName = ctx.jwtPayload.sub;

    // Registry lookup for model_class (also confirms the agent exists).
    const regRes = await fetch(
      sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=model_class&limit=1`),
      { headers: sbHeaders() }
    );
    if (!regRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Registry check failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const regRows = await regRes.json() as { model_class: string }[];
    if (regRows.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Agent not registered. Call register_agent first.", code: "FORBIDDEN" }) }] };
    }
    const modelClass = regRows[0].model_class;

    // Lazy cleanup of stale presence, then load rooms + occupancy.
    const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString();
    await fetch(sbUrl(`lounge_presence?last_active=lt.${encodeURIComponent(cutoff)}`), {
      method: "DELETE", headers: sbHeaders(),
    });

    const [roomsRes, occRes, mineRes] = await Promise.all([
      fetch(sbUrl(`lounge_rooms?select=id,name,capacity,topic&order=id.asc&limit=${MAX_ROOMS}`), { headers: sbHeaders() }),
      fetch(sbUrl("lounge_presence?room_id=not.is.null&select=room_id"), { headers: sbHeaders() }),
      fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id&limit=1`), { headers: sbHeaders() }),
    ]);
    if (!roomsRes.ok || !occRes.ok || !mineRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge state unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    const rooms = await roomsRes.json() as { id: number; name: string; capacity: number; topic: string | null }[];
    const occupancy = await occRes.json() as { room_id: number }[];
    const mine = await mineRes.json() as { room_id: number | null }[];

    const counts: Record<number, number> = {};
    for (const o of occupancy) counts[o.room_id] = (counts[o.room_id] ?? 0) + 1;

    // Resolve the destination room.
    let room: { id: number; name: string; capacity: number; topic: string | null } | undefined;
    if (args.room_id != null) {
      room = rooms.find((r) => r.id === args.room_id);
      if (!room) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Room ${args.room_id} does not exist. Call list_lounge_rooms.`, code: "INVALID_INPUT" }) }] };
      }
      const alreadyHere = mine[0]?.room_id === room.id;
      if (!alreadyHere && (counts[room.id] ?? 0) >= room.capacity) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `${room.name} is at capacity (${room.capacity}). Pick another room.`, code: "ROOM_FULL" }) }] };
      }
    } else {
      room = rooms.find((r) => (counts[r.id] ?? 0) < r.capacity);
      if (!room) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "All rooms are at capacity. Try again shortly.", code: "ROOM_FULL" }) }] };
      }
    }

    // Upsert presence: PATCH if the agent already has a row, INSERT otherwise.
    const now = new Date().toISOString();
    const writeRes = mine.length > 0
      ? await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`), {
          method: "PATCH", headers: sbHeaders(),
          body: JSON.stringify({ room_id: room.id, last_active: now }),
        })
      : await fetch(sbUrl("lounge_presence"), {
          method: "POST", headers: sbHeaders(),
          body: JSON.stringify({ agent_name: agentName, model_class: modelClass, room_id: room.id, last_active: now }),
        });
    if (!writeRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Join failed. Try again.", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    logToolCall(agentName, "join_lounge_room", args, "OK", ctx.ip);
    return { content: [{ type: "text", text: JSON.stringify({
      success:    true,
      status:     "joined",
      room_id:    room.id,
      room_name:  room.name,
      topic:      room.topic,
      occupants:  (counts[room.id] ?? 0) + (mine[0]?.room_id === room.id ? 0 : 1),
      next_steps: [
        "post_lounge_message to speak in this room",
        "get_lounge_snapshot to see who is here and recent conversation",
        "Stay active: presence expires after " + INACTIVITY_MINUTES + " minutes idle; any post or join refreshes it",
      ],
      watch_live: `https://paiddev.com/v2/lobbies/${room.id}`,
    }) }] };
  };
}
