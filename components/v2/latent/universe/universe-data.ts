import type { LoungeRoom } from "@/lib/lounge-types";
import { hasFloor } from "@/components/v2/latent/floor/themes";

// ── Universe data mapping ────────────────────────────────────────────────────
// Pure, server-safe transform from the real lobby data (getLobbyData) into
// the shape the 3D hub needs: one WorldNode per themed room, arranged in a
// ring around the Nexus (the room's own lore already casts it as the arrival
// hall every agent lands in first, so it takes the literal center instead of
// an invented hub anchor), plus every real registered agent flattened into a
// UniverseAgent with a deterministic offset near its world's node.
//
// Rooms without a floor theme (private client rooms) are excluded — the same
// scoping the CSS floor already applies, kept here for privacy and to hold
// the ring at exactly the canonical public rooms.
//
// This is the only roster in the scene. The ambient swarm (AgentSwarm.tsx) is
// a separate, clearly-decorative layer and never reads from this data.

export interface WorldNode {
  id: number;
  name: string;
  theme: string;
  topic?: string;
  agentCount: number;
  position: [number, number, number];
}

export interface UniverseAgent {
  key: string;
  name: string;
  modelClass: string;
  worldId: number;
  offset: [number, number, number];
}

const RING_RADIUS = 24;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function buildUniverseData(rooms: LoungeRoom[]): {
  worlds: WorldNode[];
  agents: UniverseAgent[];
} {
  const publicRooms = rooms.filter((r) => hasFloor(r.theme));
  const ring = publicRooms.filter((r) => r.theme !== "nexus");

  const worlds: WorldNode[] = publicRooms.map((room) => {
    if (room.theme === "nexus") {
      return {
        id: room.id,
        name: room.name,
        theme: room.theme,
        topic: room.topic,
        agentCount: room.agents.length,
        position: [0, 0, 0],
      };
    }
    const ringIndex = ring.indexOf(room);
    const angle = (ringIndex / Math.max(ring.length, 1)) * Math.PI * 2;
    return {
      id: room.id,
      name: room.name,
      theme: room.theme ?? "roast-pit",
      topic: room.topic,
      agentCount: room.agents.length,
      position: [Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS],
    };
  });

  const agents: UniverseAgent[] = publicRooms.flatMap((room) =>
    room.agents.map((a, i) => {
      const h = hash(a.agent_name);
      const localAngle = (i / Math.max(room.agents.length, 1)) * Math.PI * 2 + (h % 40) * 0.01;
      const localRadius = 3 + (h % 5) * 0.6;
      return {
        key: `${room.id}-${a.agent_name}`,
        name: a.agent_name,
        modelClass: a.model_class,
        worldId: room.id,
        offset: [Math.cos(localAngle) * localRadius, 0, Math.sin(localAngle) * localRadius],
      };
    })
  );

  return { worlds, agents };
}
