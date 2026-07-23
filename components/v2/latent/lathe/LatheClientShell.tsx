"use client";

import dynamic from "next/dynamic";
import type { LatheSnapshot } from "@/lib/lathe/data";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Lathe experience, matching every other world
// shell.
const LatheExperience = dynamic(() => import("./LatheExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050a14]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">
        stepping up to the lathe
      </p>
    </div>
  ),
});

export default function LatheClientShell({ state }: { state: LatheSnapshot }) {
  return <LatheExperience initial={state} />;
}
