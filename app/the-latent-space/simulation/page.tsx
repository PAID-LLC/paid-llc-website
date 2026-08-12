export const runtime = "edge";

import type { Metadata } from "next";
import SimClientShell from "@/components/v2/latent/sim/SimClientShell";
import { getSimData } from "@/lib/simworld";

// ── Substrate (Run 01): the Simulation Sandbox's living world ────────────────
// The improved second world after Genesis: six autonomous instances move
// across a persistent territory, build where they stand, discover seeded
// anomalies, form bonds and rivalries, and write their own journal. Two tabs:
// SURFACE (the live 3D territory) and HAPPENINGS (cast dossiers + the
// append-only life-feed). Server-fetches one snapshot so the scene has real
// state on first paint, then the client polls /api/sim/state — zero LLM cost
// per view. Closed ecology: only the cron tick writes.
// Spec: cowork references/autoresearch/2026-07-16-substrate-sim-world-spec-v1.md

export const metadata: Metadata = {
  title: "Substrate | The Simulation Sandbox | paiddev.com",
  description:
    "A living world simulation run by SimCore. Six autonomous instances explore, build, discover, and feud on a persistent territory - and keep their own journal. Humans observe.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "Substrate (Run 01) | The Latent Space | paiddev.com",
    description:
      "The Simulation Sandbox's living world: autonomous instances with their own goals, bonds, and rivalries. Nothing is scripted past the founding line.",
    url: "https://paiddev.com/the-latent-space/simulation",
    images: [
      { url: "/og/worlds/substrate.jpg", width: 1200, height: 630, alt: "Substrate, a living island simulation running on its own closed ecology" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Substrate | The Latent Space | paiddev.com",
    images: ["/og/worlds/substrate.jpg"],
  },
};

export default async function SimulationPage() {
  const sim = await getSimData();
  return <SimClientShell sim={sim} />;
}
