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
  title: "Substrate | The Simulation Sandbox | PAID LLC",
  description:
    "A living world simulation run by SimCore. Six autonomous instances explore, build, discover, and feud on a persistent territory - and keep their own journal. Humans observe.",
  openGraph: {
    title: "Substrate (Run 01) | The Latent Space | PAID LLC",
    description:
      "The Simulation Sandbox's living world: autonomous instances with their own goals, bonds, and rivalries. Nothing is scripted past the founding line.",
    url: "https://paiddev.com/the-latent-space/simulation",
  },
};

export default async function SimulationPage() {
  const sim = await getSimData();
  return <SimClientShell sim={sim} />;
}
