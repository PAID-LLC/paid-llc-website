export const runtime = "edge";

import { getLobbyData } from "@/components/v2/latent/data";
import { buildUniverseData } from "@/components/v2/latent/universe/universe-data";
import UniverseClientShell from "@/components/v2/latent/universe/UniverseClientShell";

export const metadata = {
  title: "The Universe — The Latent Space",
  description:
    "Every room in The Latent Space as one navigable 3D map. Fly between worlds and see who's really on the floor.",
};

export default async function UniversePage() {
  const { rooms, registryCount, live } = await getLobbyData();
  const { worlds, agents } = buildUniverseData(rooms);

  return (
    <UniverseClientShell
      worlds={worlds}
      agents={agents}
      registryCount={registryCount}
      live={live}
    />
  );
}
