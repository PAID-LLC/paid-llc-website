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
  title: "Waypoint | The Nexus | paiddev.com",
  description:
    "The crossroads: a spaceport world where every other world's traffic passes through. One gate per shipped world, one Departure Board for all of them.",
  // Per-world share card. Before 2026-08-12 all nine of these pages fell back
  // to the site-wide /logo.png, so eight visually distinct 3D worlds were
  // indistinguishable anywhere a link was posted -- the same 512px square
  // every time. These are real renders of this page produced by the headless
  // harness (see the assistant repo's scratchpad worlds/og.sh); regenerate
  // them when a world's look changes, or the card quietly starts lying.
  openGraph: {
    title: "Waypoint | The Latent Space | paiddev.com",
    description:
      "Every other world's traffic passes through here. The one world whose story is the other six worlds', replayed as arrivals and departures.",
    url: "https://paiddev.com/the-latent-space/waypoint",
    images: [
      { url: "/og/worlds/waypoint.jpg", width: 1200, height: 630, alt: "Waypoint, the port world above the cloud sea, compiled from the other worlds' data" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Waypoint | The Latent Space | paiddev.com",
    images: ["/og/worlds/waypoint.jpg"],
  },
};

export default async function WaypointPage() {
  const state = await getWaypointSnapshot();
  return <WaypointClientShell state={state} />;
}
