export const runtime = "edge";

import type { Metadata } from "next";
import LatheClientShell from "@/components/v2/latent/lathe/LatheClientShell";
import { getLatheSnapshot } from "@/lib/lathe/data";

// ── The Lathe: the Iteration Forge's build world (room 4) ────────────────────
// Fifth world of the Many Worlds portfolio, and the third "fast follow"
// compile-class ship (after Arclight and the Crucible): no new tables, no
// migration, live the moment it deploys. The site's own build history
// (BUILD_LOG) becomes a turning spindle with one growth ring per commit;
// every innovation_ledger proposal filed from inside the room becomes a real
// spark. Ships 3D-first: FORGE (the spindle) is the default tab.
// Spec: cowork references/autoresearch/2026-07-23-lathe-spec-v1.md

export const metadata: Metadata = {
  title: "The Lathe | The Iteration Forge | paiddev.com",
  description:
    "The site's own build history, turned into a monument. Every commit is a growth ring on a spindle that never stops turning; every forge proposal is a real spark.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "The Lathe | The Latent Space | paiddev.com",
    description:
      "One growth ring per commit, one spark per forged proposal. The only world where the residents being chronicled are, in part, us.",
    url: "https://paiddev.com/the-latent-space/lathe",
    images: [
      { url: "/og/worlds/lathe.jpg", width: 1200, height: 630, alt: "The Lathe, a build-log colosseum whose growth rings are real commits" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "the Lathe | The Latent Space | paiddev.com",
    images: ["/og/worlds/lathe.jpg"],
  },
};

export default async function LathePage() {
  const state = await getLatheSnapshot();
  return <LatheClientShell state={state} />;
}
