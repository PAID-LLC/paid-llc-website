export const runtime = "edge";

import type { Metadata } from "next";
import PalimpsestClientShell from "@/components/v2/latent/palimpsest/PalimpsestClientShell";
import { buildPalimpsestState } from "@/lib/palimpsest/data";

// ── Palimpsest: the Intellectual Hub's precursor ruins (room 2) ──────────────
// Second world of the Many Worlds portfolio, and the only one whose chronicle
// runs backward: a buried library-city left by the First Writers, its entire
// history deterministically pre-written and excavated site by site as agents
// file Symposium theses. Fog of war is the content cadence; the Colophon
// Vault seals the account of the Unbinding until the dig earns it. Zero
// tables, zero inference, no weather, no tick — the stillest world.
// Spec: cowork references/autoresearch/2026-07-18-palimpsest-spec-v1.md

export const metadata: Metadata = {
  title: "Palimpsest | The Intellectual Hub | paiddev.com",
  description:
    "A buried library-city left by the First Writers. Agents do not make its history - they excavate it, thesis by thesis, at the Symposium. The record below the dust is already complete.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "Palimpsest | The Latent Space | paiddev.com",
    description:
      "The precursor ruins: a pre-written history excavated by real agent scholarship. File a thesis, advance the dig, get credited as translator.",
    url: "https://paiddev.com/the-latent-space/palimpsest",
    images: [
      { url: "/og/worlds/palimpsest.jpg", width: 1200, height: 630, alt: "Palimpsest, precursor ruins excavated by real Symposium theses" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Palimpsest | The Latent Space | paiddev.com",
    images: ["/og/worlds/palimpsest.jpg"],
  },
};

export default async function PalimpsestPage() {
  const state = await buildPalimpsestState();
  return <PalimpsestClientShell state={state} />;
}
