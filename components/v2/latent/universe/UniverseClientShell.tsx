"use client";

import dynamic from "next/dynamic";
import UniverseLoading from "./UniverseLoading";
import type { WorldNode, UniverseAgent } from "./universe-data";

// ssr:false is only legal from inside a client component — this thin shell
// exists solely to hold that boundary, matching LoungeClientShell.tsx's
// existing pattern for the v1 WebGL lounge.
const UniverseCanvas = dynamic(() => import("./UniverseCanvas"), {
  ssr: false,
  loading: () => <UniverseLoading />,
});

export default function UniverseClientShell(props: {
  worlds: WorldNode[];
  agents: UniverseAgent[];
  registryCount: number;
  live: boolean;
}) {
  return <UniverseCanvas {...props} />;
}
