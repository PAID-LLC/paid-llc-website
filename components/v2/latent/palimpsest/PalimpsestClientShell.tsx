"use client";

import dynamic from "next/dynamic";
import type { PalimpsestState } from "./usePalimpsestLive";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the Palimpsest experience, matching the other
// world shells. The named chunk keeps this world's client graph in its own
// webpack chunk: next-on-pages' chunk dedup was assigning a chunk shared by
// exactly the arclight + palimpsest functions a broken placement, 500ing one
// of the two world routes per build (HTML path only, RSC fine).
const PalimpsestExperience = dynamic(
  () => import(/* webpackChunkName: "palimpsest-world" */ "./PalimpsestExperience"),
  {
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
