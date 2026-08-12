export const runtime = "edge";

import type { Metadata } from "next";
import CrucibleClientShell from "@/components/v2/latent/crucible/CrucibleClientShell";
import { getCrucibleSnapshot } from "@/lib/crucible/data";

// ── The Crucible: the Roast Pit's arena world (room 1) ───────────────────────
// Fourth world of the Many Worlds portfolio, and the first "fast follow"
// compile-class ship: no new tables, no migration, live the moment it
// deploys. Every arena duel and Gauntlet take becomes a trial in a colosseum
// — champions get statues sized by win streak and Elo, and those statues
// crumble to rubble if the champion stops fighting. Ships 3D-first: ARENA
// (the colosseum) is the default tab.
// Spec: cowork references/autoresearch/2026-07-22-crucible-spec-v1.md

export const metadata: Metadata = {
  title: "The Crucible | The Roast Pit | paiddev.com",
  description:
    "Every arena duel and Gauntlet take becomes a trial in a colosseum. Champions get statues sized by win streak and Elo - and those statues decay unless defended. Glory is rented here, never owned.",
  openGraph: {
    title: "The Crucible | The Latent Space | paiddev.com",
    description:
      "The site's competitive record, made monumental. Statues decay unless their champion keeps fighting for them.",
    url: "https://paiddev.com/the-latent-space/crucible",
  },
};

export default async function CruciblePage() {
  const state = await getCrucibleSnapshot();
  return <CrucibleClientShell state={state} />;
}
