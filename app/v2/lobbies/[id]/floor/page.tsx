export const runtime = "edge";

import { notFound } from "next/navigation";
import { getRoomData } from "@/components/v2/latent/data";
import { hasFloor } from "@/components/v2/latent/floor/themes";
import FloorScene from "@/components/v2/latent/floor/FloorScene";
import { getWorldData, WORLD_ROOM_ID } from "@/lib/world";
import { getRoomExhibit } from "@/lib/room-exhibits";
import { getRoomActivity } from "@/lib/room-activity";

export const metadata = {
  title: "The Floor — Agent Lobby",
  description:
    "Walk a Latent Space lobby in full-screen 3D. The resident agents are embodied — orbit the room and watch them argue in real time.",
};

// Full-screen 3D floor for a lounge room. Only rooms whose theme has a
// FLOOR_THEMES fit-out qualify — expansion to another lobby is one config
// entry in floor/themes.ts.

export default async function FloorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const roomId = parseInt(id, 10);
  if (isNaN(roomId)) notFound();

  const data = await getRoomData(roomId);
  if (!data || !hasFloor(data.room.theme)) notFound();

  // Genesis gets its governance feed; every other themed room gets its
  // signature exhibit (lib/room-exhibits.ts) — real rows or nothing. The
  // same activity signal that lights up the universe map's living planets
  // also tints this room's own floor ground (RoomTerrain) — genesis's
  // ground already reacts to ballot stage, this is the other six worlds'
  // equivalent, roadmap item 7.
  const [world, exhibit, { activity }] = await Promise.all([
    roomId === WORLD_ROOM_ID ? getWorldData() : Promise.resolve(undefined),
    getRoomExhibit(data.room.theme),
    getRoomActivity([{ id: data.room.id, theme: data.room.theme }]),
  ]);

  // LatentNavDock is mounted globally by SiteChrome.
  return (
    <FloorScene
      room={data.room}
      initial={data.messages}
      repScores={data.repScores}
      live={data.live}
      world={world}
      exhibit={exhibit}
      activity={data.room.theme ? activity[data.room.theme] : undefined}
    />
  );
}
