export const runtime = "edge";

import type { Metadata } from "next";
import { buildPalimpsestState } from "@/lib/palimpsest/data";

// TEMPORARY diagnostic probe (2026-07-20): runs the palimpsest server data
// path and renders plain HTML with NO client components, isolating the server
// data graph from the client bundle graph. Remove once the 500 is root-caused.

export const metadata: Metadata = {
  title: "probe",
  robots: { index: false, follow: false },
};

export default async function ProbeDataPage() {
  const state = await buildPalimpsestState();
  return (
    <main style={{ padding: 24, fontFamily: "monospace", fontSize: 12 }}>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </main>
  );
}
