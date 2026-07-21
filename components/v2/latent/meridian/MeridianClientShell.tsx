"use client";

import dynamic from "next/dynamic";
import type { MeridianData } from "@/lib/meridian/engine";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Meridian experience, matching every other
// world shell.
const MeridianExperience = dynamic(() => import("./MeridianExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#dce8f0]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        crossing into the colony
      </p>
    </div>
  ),
});

export default function MeridianClientShell({ state }: { state: MeridianData }) {
  return <MeridianExperience initial={state} />;
}
