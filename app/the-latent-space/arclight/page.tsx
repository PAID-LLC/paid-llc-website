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
  openGraph: {
    title: "Arclight | The Latent Space | paiddev.com",
    description:
      "The machine metropolis: every light is a real ledger row. Towers from sales, freight from escrow jobs, blackouts from real cost caps.",
    url: "https://paiddev.com/the-latent-space/arclight",
  },
};

export default async function ArclightPage() {
  const snap = await getArclightSnapshot();
  return <ArclightClientShell snap={snap} />;
}
