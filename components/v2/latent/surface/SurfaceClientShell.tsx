"use client";

import dynamic from "next/dynamic";
import type { WorldData } from "@/lib/world";

// ssr:false is only legal from inside a client component — this thin shell
// holds that boundary for the world-surface canvas, matching
// UniverseClientShell.tsx.
const SurfaceCanvas = dynamic(() => import("./SurfaceCanvas"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07070b]">
      <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        approaching the surface
      </p>
    </div>
  ),
});

export default function SurfaceClientShell({ world }: { world: WorldData }) {
  return <SurfaceCanvas initial={world} />;
}
