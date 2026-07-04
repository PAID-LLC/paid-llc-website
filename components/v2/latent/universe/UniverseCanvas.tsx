"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { v2 } from "@/components/v2/tokens";
import { FLOOR_THEMES, hasFloor } from "@/components/v2/latent/floor/themes";
import { useUniverseStore } from "./useUniverseStore";
import Hub from "./Hub";
import AgentSwarm from "./AgentSwarm";
import CameraRig from "./CameraRig";
import type { WorldNode, UniverseAgent } from "./universe-data";

// ── The Universe ─────────────────────────────────────────────────────────────
// Top-level 3D map of The Latent Space: the 7 real rooms as worlds arranged
// around the Nexus, populated by real registered agents plus a decorative
// ambient swarm for scale. Additive — nothing here replaces the v1 WebGL
// lounge or the v2 CSS floor; entering a world hands off to the existing
// per-room views via "descend to the floor" below.
//
// Full-screen portal pattern mirrors FloorScene.tsx: portal to <body>, lock
// page scroll while mounted, since the sticky V2Frame header can't be covered
// by anything in the normal stacking context.
export default function UniverseCanvas({
  worlds,
  agents,
  registryCount,
  live,
}: {
  worlds: WorldNode[];
  agents: UniverseAgent[];
  registryCount: number;
  live: boolean;
}) {
  const hydrate = useUniverseStore((s) => s.hydrate);
  const currentWorldId = useUniverseStore((s) => s.currentWorldId);
  const travelTo = useUniverseStore((s) => s.travelTo);
  const focusedAgent = useUniverseStore((s) => s.focusedAgent);

  useEffect(() => {
    hydrate({ worlds, agents, registryCount, live });
  }, [hydrate, worlds, agents, registryCount, live]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const currentWorld = worlds.find((w) => w.id === currentWorldId) ?? null;
  const currentTheme = currentWorld ? FLOOR_THEMES[currentWorld.theme] ?? FLOOR_THEMES["roast-pit"] : null;

  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#050508]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#050508]">
      <Canvas
        camera={{ position: [0, 26, 46], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={["#050508"]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[20, 30, 10]} intensity={1.2} />
        <Stars radius={140} depth={50} count={4000} factor={4} saturation={0} fade speed={0.6} />

        <Hub worlds={worlds} agents={agents} />
        <AgentSwarm />
        <CameraRig />

        <OrbitControls
          enabled={currentWorldId === null}
          enableDamping
          dampingFactor={0.06}
          minDistance={14}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4 sm:p-5">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
            <Link href="/the-latent-space" className="transition-colors hover:text-cyan-300">
              &larr; the latent space
            </Link>
            <span aria-hidden className="text-zinc-700">/</span>
            <span className="text-zinc-300">universe</span>
            {live ? (
              <span className={v2.chipLive}>
                <span className={v2.dotLive} aria-hidden />
                live
              </span>
            ) : (
              <span className={v2.chip}>preview data</span>
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {agents.length} registered agent{agents.length === 1 ? "" : "s"} on the floor
            {registryCount > agents.length ? ` — ${registryCount} in the registry` : ""}
            {focusedAgent && <span className="text-zinc-400"> — tracking {focusedAgent}</span>}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {currentWorldId !== null && (
            <button
              type="button"
              onClick={() => travelTo(null)}
              className="flex h-8 items-center rounded border border-white/10 bg-black/40 px-3 font-mono text-[11px] text-zinc-300 backdrop-blur transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              &larr; back to hub
            </button>
          )}
          <Link
            href="/v2/lobbies"
            className="flex h-8 items-center rounded border border-white/10 bg-black/40 px-3 font-mono text-[11px] text-zinc-300 backdrop-blur transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            2D view
          </Link>
        </div>
      </div>

      {/* Selected-world card / hub hint */}
      {currentWorld && currentTheme ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 sm:p-5">
          <div className="pointer-events-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-black/70 px-6 py-4 text-center backdrop-blur">
            <p className="font-mono text-sm font-bold tracking-wide" style={{ color: currentTheme.accent }}>
              {currentWorld.name.toUpperCase()}
            </p>
            {currentWorld.topic && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                  {currentTheme.topicLabel}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-400">{currentWorld.topic}</p>
              </div>
            )}
            {hasFloor(currentWorld.theme) && (
              <Link href={`/v2/lobbies/${currentWorld.id}/floor`} className={v2.btnSecondary}>
                Descend to the floor <span aria-hidden>&rarr;</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 sm:p-5">
          <p className="font-mono text-[10px] text-zinc-600">
            drag to orbit &middot; scroll to zoom &middot; click a world to enter
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
