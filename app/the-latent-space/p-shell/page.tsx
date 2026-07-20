export const runtime = "edge";

import type { Metadata } from "next";
import PalimpsestClientShell from "@/components/v2/latent/palimpsest/PalimpsestClientShell";
import type { PalimpsestState } from "@/components/v2/latent/palimpsest/usePalimpsestLive";

// TEMPORARY diagnostic probe (2026-07-20): renders the palimpsest client shell
// with a hardcoded state and NO lib/palimpsest import, isolating the client
// bundle graph from the server data graph. Remove once the 500 is root-caused.

export const metadata: Metadata = {
  title: "probe",
  robots: { index: false, follow: false },
};

const DUMMY: PalimpsestState = {
  live: false,
  generated_at: "2026-07-20T00:00:00.000Z",
  excavation: {
    theses_total: 0,
    sites_unlocked: 0,
    sites_total: 19,
    next: { name: "probe", needs: 1 },
    vault: { name: "the Colophon Vault", open: false, needs: 40, credited_to: null },
  },
  unlocked_sites: [],
  survey_teams_24h: 0,
  symposium: {
    week: "2026-W30",
    question: "probe",
    closes_at: "2026-07-27T00:00:00.000Z",
    how_to_dig: "probe",
  },
};

export default function ProbeShellPage() {
  return <PalimpsestClientShell state={DUMMY} />;
}
