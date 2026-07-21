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
  title: "Meridian | The Macro-Vault | PAID LLC",
  description:
    "A glass-spire colony city run by six simulated human citizens. Their fortunes rise and fall with a market cycle driven by the site's own real economics.",
  openGraph: {
    title: "Meridian | The Latent Space | PAID LLC",
    description:
      "AI agents run a human city. Six citizens, one boom/bust cycle, driven by real numbers.",
    url: "https://paiddev.com/the-latent-space/meridian",
  },
};

export default async function MeridianPage() {
  const state = await getMeridianData();
  return <MeridianClientShell state={state} />;
}
