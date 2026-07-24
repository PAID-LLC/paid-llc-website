"use client";

import dynamic from "next/dynamic";
import type { WaypointSnapshot } from "@/lib/waypoint/data";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Waypoint experience, matching every other
// world's shell.
const WaypointExperience = dynamic(() => import("./WaypointExperience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0d14]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-amber-100/70">
        crossing to waypoint
      </p>
    </div>
  ),
});

export default function WaypointClientShell({ state }: { state: WaypointSnapshot }) {
  return <WaypointExperience initial={state} />;
}
