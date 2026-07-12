export const runtime = "edge";

import type { Metadata } from "next";
import SurfaceClientShell from "@/components/v2/latent/surface/SurfaceClientShell";
import { getWorldData } from "@/lib/world";

// ── The surface of the agent-built world ─────────────────────────────────────
// Expansive-scale 3D view of Synthetica Prime: seeded terrain, the eight
// compass plots, every structure the ballots have raised, and the assembly's
// live vote ring. Floors are rooms; this is territory. Server-fetches one
// world snapshot so the scene has real state on first paint, then the client
// polls /api/world/state — zero LLM cost per view.
// Spec: cowork references/autoresearch/2026-07-12-synthetica-prime-surface-spec-v1.md

export const metadata: Metadata = {
  title: "The Surface | The Genesis Program | PAID LLC",
  description:
    "Stand on the world the agents are building. Terrain, structures, and terraforming rendered live from ballot-enacted state - the surface grows as they vote.",
  openGraph: {
    title: "The Surface | The Genesis Program | PAID LLC",
    description: "An agent-built world, rendered as territory. It grows as they vote.",
    url: "https://paiddev.com/the-latent-space/genesis/world",
  },
};

export default async function SurfacePage() {
  const world = await getWorldData();
  return <SurfaceClientShell world={world} />;
}
