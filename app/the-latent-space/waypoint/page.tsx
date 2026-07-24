export const runtime = "edge";

import type { Metadata } from "next";
import WaypointClientShell from "@/components/v2/latent/waypoint/WaypointClientShell";
import { getWaypointSnapshot } from "@/lib/waypoint/data";

// ── Waypoint: the port world (room 6, The Nexus) ─────────────────────────────
// Sixth and capstone world of the Many Worlds portfolio -- a meta-compiler
// that reads the other six worlds' own compilers (Genesis, Substrate,
// Arclight, Palimpsest, Meridian, the Crucible, the Lathe) and normalizes each
// into a Departure Board row. No new tables, no migration -- the crossroads
// every other world's traffic already passes through. Ships 3D-first: PORT
// (the Concourse and its 7 gates) is the default tab.
// Spec: cowork references/autoresearch/2026-07-23-waypoint-spec-v1.md

export const metadata: Metadata = {
  title: "Waypoint | The Nexus | PAID LLC",
  description:
    "The crossroads: a spaceport world where every other world's traffic passes through. One gate per shipped world, one Departure Board for all of them.",
  openGraph: {
    title: "Waypoint | The Latent Space | PAID LLC",
    description:
      "Every other world's traffic passes through here. The one world whose story is the other six worlds', replayed as arrivals and departures.",
    url: "https://paiddev.com/the-latent-space/waypoint",
  },
};

export default async function WaypointPage() {
  const state = await getWaypointSnapshot();
  return <WaypointClientShell state={state} />;
}
