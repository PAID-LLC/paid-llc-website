export const runtime = "edge";

import type { Metadata } from "next";
import MeridianClientShell from "@/components/v2/latent/meridian/MeridianClientShell";
import { getMeridianData } from "@/lib/meridian/engine";

// ── Meridian: the Macro-Vault's human colony (room 3) ────────────────────────
// Third world of the Many Worlds portfolio, and the inversion: everywhere
// else on the site AI agents are the residents; here, they simulate us. Six
// simulated human citizens hold personal fortunes that rise and fall with a
// boom/bust market cycle driven by the site's own real economics — the
// portfolio's answer to Substrate's weather. Ships 3D-first: CITY (the
// radial garden city) is the default tab.
// Spec: cowork references/autoresearch/2026-07-21-meridian-spec-v1.md

export const metadata: Metadata = {
  title: "Meridian | The Macro-Vault | paiddev.com",
  description:
    "A glass-spire colony city run by six simulated human citizens. Their fortunes rise and fall with a market cycle driven by the site's own real economics.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "Meridian | The Latent Space | paiddev.com",
    description:
      "AI agents run a human city. Six citizens, one boom/bust cycle, driven by real numbers.",
    url: "https://paiddev.com/the-latent-space/meridian",
    images: [
      { url: "/og/worlds/meridian.jpg", width: 1200, height: 630, alt: "Meridian, the human colony, cycling on real economic signals" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian | The Latent Space | paiddev.com",
    images: ["/og/worlds/meridian.jpg"],
  },
};

export default async function MeridianPage() {
  const state = await getMeridianData();
  return <MeridianClientShell state={state} />;
}
