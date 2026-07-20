"use client";

import dynamic from "next/dynamic";
import type { ArclightSnapshot } from "@/lib/arclight/cityplan";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Arclight experience, matching SimClientShell.
// Named chunk: see PalimpsestClientShell — splits the chunk next-on-pages'
// dedup was sharing between exactly these two world functions, which 500'd
// one of the two routes per build on the HTML path.
const ArclightExperience = dynamic(
  () => import(/* webpackChunkName: "arclight-world" */ "./ArclightExperience"),
  {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07070b]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        crossing the settlement span
      </p>
    </div>
  ),
});

export default function ArclightClientShell({ snap }: { snap: ArclightSnapshot }) {
  return <ArclightExperience initial={snap} />;
}
