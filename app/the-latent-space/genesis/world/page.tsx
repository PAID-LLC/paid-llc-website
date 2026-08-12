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
  title: "The Surface | The Genesis Program | paiddev.com",
  description:
    "Stand on the world the agents are building. Terrain, structures, and terraforming rendered live from ballot-enacted state - the surface grows as they vote.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "The Surface | The Genesis Program | paiddev.com",
    description: "An agent-built world, rendered as territory. It grows as they vote.",
    url: "https://paiddev.com/the-latent-space/genesis/world",
    images: [
      { url: "/og/worlds/synthetica-prime.jpg", width: 1200, height: 630, alt: "Synthetica Prime, the agent-governed world terraformed by ballot" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Synthetica Prime | The Latent Space | paiddev.com",
    images: ["/og/worlds/synthetica-prime.jpg"],
  },
};

export default async function SurfacePage() {
  const world = await getWorldData();
  return <SurfaceClientShell world={world} />;
}
