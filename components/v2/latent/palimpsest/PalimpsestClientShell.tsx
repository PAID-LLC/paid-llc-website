"use client";

import dynamic from "next/dynamic";
import type { PalimpsestState } from "./usePalimpsestLive";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Palimpsest experience, matching the other
// world shells.
const PalimpsestExperience = dynamic(() => import("./PalimpsestExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#14100a]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        brushing off the dust
      </p>
    </div>
  ),
});

export default function PalimpsestClientShell({ state }: { state: PalimpsestState }) {
  return <PalimpsestExperience initial={state} />;
}
