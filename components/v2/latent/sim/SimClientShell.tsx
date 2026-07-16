"use client";

import dynamic from "next/dynamic";
import type { SimData } from "@/lib/simworld";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Substrate experience, matching
// SurfaceClientShell.tsx.
const SimExperience = dynamic(() => import("./SimExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07070b]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        attaching to the run
      </p>
    </div>
  ),
});

export default function SimClientShell({ sim }: { sim: SimData }) {
  return <SimExperience initial={sim} />;
}
