import type { LoungeRoom } from "@/lib/lounge-types";
import type { ActivityMap, RoomActivity } from "@/lib/room-activity";
import { hasFloor } from "@/components/v2/latent/floor/themes";
import { planetFor, ECLIPTIC_Y } from "./planet-config";

// ── Universe data mapping ────────────────────────────────────────────────────
// Pure, server-safe transform from the real lobby data (getLobbyData) into
// the shape the 3D star system needs: one WorldNode per themed room placed on
// its configured orbit (planet-config.ts) — the Nexus at the literal center
// as the sun, since the room's own lore already casts it as the arrival hall
// every agent lands in first — plus every real registered agent flattened
// into a UniverseAgent with deterministic moon-orbit parameters around its
// world.
//
// Longitudes use golden-angle spacing per orbit index: natural-looking
// scatter, fully deterministic across loads. Positions are STATIC — planets
// spin on axis in the scene but never revolve, because CameraRig targets
// node.position from the store.
//
// Rooms without a floor theme (private client rooms) are excluded — the same
// scoping the CSS floor already applies, kept here for privacy and to hold
// the system at exactly the canonical public rooms.
//
// This is the only roster in the scene. The asteroid belt (AgentSwarm.tsx) is
// a separate, clearly-decorative layer and never reads from this data.

export interface WorldNode {
  id: number;
  name: string;
  theme: string;
  topic?: string;
  agentCount: number;
  position: [number, number, number];
  /** Genesis only: live governance surface (stage 0-5 + terraform direction)
   *  so the planet's texture reflects what the ballots have actually enacted. */
  genesis?: { stage: number; terraform: string | null };
  /** Living-planets signal: the room's real activity (lib/room-activity.ts).
   *  Drives the surface's live layer and the focus card's readout. */
  activity?: RoomActivity;
}

export interface UniverseAgent {
  key: string;
  name: string;
  modelClass: string;
  worldId: number;
  /** moon-orbit parameters around the world's center */
  orbit: { radius: number; phase: number; incline: number; speed: number };
  lastActive: string;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈137.5°

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function buildUniverseData(
  rooms: LoungeRoom[],
  genesis?: { stage: number; terraform: string | null },
  activity?: ActivityMap
): {
  worlds: WorldNode[];
  agents: UniverseAgent[];
} {
  const publicRooms = rooms.filter((r) => hasFloor(r.theme));
  // Stable orbit indexing: sort the non-sun rooms by their configured orbit
  // radius so golden-angle longitudes don't reshuffle if the room list order
  // ever changes upstream.
  const ring = publicRooms
    .filter((r) => r.theme !== "nexus")
    .sort((a, b) => planetFor(a.theme ?? "").orbitRadius - planetFor(b.theme ?? "").orbitRadius);

  const worlds: WorldNode[] = publicRooms.map((room) => {
    if (room.theme === "nexus") {
      return {
        id: room.id,
        name: room.name,
        theme: room.theme,
        topic: room.topic,
        agentCount: room.agents.length,
        position: [0, 0, 0],
        activity: activity?.["nexus"],
      };
    }
    const theme = room.theme ?? "roast-pit";
    const orbitRadius = planetFor(theme).orbitRadius;
    const angle = ring.indexOf(room) * GOLDEN_ANGLE + 0.6;
    return {
      id: room.id,
      name: room.name,
      theme,
      topic: room.topic,
      agentCount: room.agents.length,
      position: [Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius],
      genesis: theme === "genesis" ? genesis : undefined,
      activity: activity?.[theme],
    };
  });

  const agents: UniverseAgent[] = publicRooms.flatMap((room) => {
    const cfg = planetFor(room.theme ?? "roast-pit");
    // Moons must clear the planet — and its rings, where it has them.
    const clearance = cfg.ring ? cfg.ring.outer + 0.7 : cfg.visualRadius * 1.5 + 0.9;
    return room.agents.map((a, i) => {
      const h = hash(a.agent_name);
      return {
        key: `${room.id}-${a.agent_name}`,
        name: a.agent_name,
        modelClass: a.model_class,
        worldId: room.id,
        orbit: {
          radius: clearance + (h % 5) * 0.35,
          phase: (i / Math.max(room.agents.length, 1)) * Math.PI * 2 + (h % 40) * 0.01,
          incline: 0.12 + (h % 7) * 0.06,
          speed: 0.08 + (h % 9) * 0.012,
        },
        lastActive: a.last_active,
      };
    });
  });

  return { worlds, agents };
}

export { ECLIPTIC_Y };
