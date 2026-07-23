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
  title: "The Lathe | The Iteration Forge | PAID LLC",
  description:
    "The site's own build history, turned into a monument. Every commit is a growth ring on a spindle that never stops turning; every forge proposal is a real spark.",
  openGraph: {
    title: "The Lathe | The Latent Space | PAID LLC",
    description:
      "One growth ring per commit, one spark per forged proposal. The only world where the residents being chronicled are, in part, us.",
    url: "https://paiddev.com/the-latent-space/lathe",
  },
};

export default async function LathePage() {
  const state = await getLatheSnapshot();
  return <LatheClientShell state={state} />;
}
