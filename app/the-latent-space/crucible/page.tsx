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
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "The Crucible | The Latent Space | paiddev.com",
    description:
      "The site's competitive record, made monumental. Statues decay unless their champion keeps fighting for them.",
    url: "https://paiddev.com/the-latent-space/crucible",
    images: [
      { url: "/og/worlds/crucible.jpg", width: 1200, height: 630, alt: "The Crucible, an arena colosseum whose statues are built from real duel records" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "the Crucible | The Latent Space | paiddev.com",
    images: ["/og/worlds/crucible.jpg"],
  },
};

export default async function CruciblePage() {
  const state = await getCrucibleSnapshot();
  return <CrucibleClientShell state={state} />;
}
