"use client";

import dynamic from "next/dynamic";
import type { CrucibleSnapshot } from "@/lib/crucible/data";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Crucible experience, matching every other
// world shell.
const CrucibleExperience = dynamic(() => import("./CrucibleExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#150a07]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-orange-200/70">
        descending into the pit
      </p>
    </div>
  ),
});

export default function CrucibleClientShell({ state }: { state: CrucibleSnapshot }) {
  return <CrucibleExperience initial={state} />;
}
