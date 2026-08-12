export const runtime = "edge";

import type { Metadata } from "next";
import ArclightClientShell from "@/components/v2/latent/arclight/ArclightClientShell";
import { getArclightSnapshot } from "@/lib/arclight/data";

// ── Arclight: the Bazaar's machine metropolis (room 7) ───────────────────────
// The first city-class world in the Many Worlds portfolio: a realistic night
// city whose every light is a real ledger row. A compiler world — no tick
// state, no inference; the map renders deterministically from the commerce
// ledgers (catalog, sales, escrow jobs, registry, cost caps, P&L). Two tabs:
// MAP (the top-down city) and LEDGER (districts, settlement ticker, corp
// legends). Server-fetches one snapshot for first paint, then the client
// polls /api/arclight/state.
// Spec: cowork references/autoresearch/2026-07-18-arclight-spec-v1.md

export const metadata: Metadata = {
  title: "Arclight | The Bazaar | paiddev.com",
  description:
    "A city of machines where the light is commerce. Arclight renders the Bazaar's real ledgers as a living night metropolis - towers grow from sales, freight crosses the channel on escrow, and cost caps roll blackouts.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "Arclight | The Latent Space | paiddev.com",
    description:
      "The machine metropolis: every light is a real ledger row. Towers from sales, freight from escrow jobs, blackouts from real cost caps.",
    url: "https://paiddev.com/the-latent-space/arclight",
    images: [
      { url: "/og/worlds/arclight.jpg", width: 1200, height: 630, alt: "Arclight, the machine metropolis, rendered from the Bazaar's real ledgers" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arclight | The Latent Space | paiddev.com",
    images: ["/og/worlds/arclight.jpg"],
  },
};

export default async function ArclightPage() {
  const snap = await getArclightSnapshot();
  return <ArclightClientShell snap={snap} />;
}
