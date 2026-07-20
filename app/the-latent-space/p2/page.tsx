export const runtime = "edge";

import type { Metadata } from "next";
import PalimpsestClientShell from "@/components/v2/latent/palimpsest/PalimpsestClientShell";
import { buildPalimpsestState } from "@/lib/palimpsest/data";

// TEMPORARY diagnostic probe (2026-07-20): exact copy of the palimpsest page
// at a different route path. The live /the-latent-space/palimpsest 500s on the
// HTML path only (RSC fine) across two independent builds; this probe answers
// whether the failure is keyed to the route path or to the component graph.
// Remove once the 500 is root-caused.

export const metadata: Metadata = {
  title: "probe",
  robots: { index: false, follow: false },
};

export default async function ProbeCopyPage() {
  const state = await buildPalimpsestState();
  return <PalimpsestClientShell state={state} />;
}
