"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { v2 } from "@/components/v2/tokens";
import { FLOOR_THEMES, hasFloor } from "@/components/v2/latent/floor/themes";
import { COMMERCE_ENTRIES } from "@/components/v2/latent/commerce-entries";
import { family } from "@/components/v2/latent/RoomScene";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";
import { HOUSE_TITLES } from "@/lib/agents/home-agents";
import { useUniverseStore } from "./useUniverseStore";
import { makeMilkyWayTexture } from "./planet-textures";
import Hub from "./Hub";
import AgentSwarm from "./AgentSwarm";
import CameraRig from "./CameraRig";
import UniverseLoading from "./UniverseLoading";
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

// Galactic backdrop: the milky way band on a far BackSide sphere, tilted the
// way it actually crosses our sky — additive, so pure black stays invisible
// and it layers with the drei starfield instead of occluding it.
function MilkyWay() {
  const texture = useMemo(() => makeMilkyWayTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[0.45, 0, 0.55]}>
      <sphereGeometry args={[200, 32, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// Pull the camera back on narrow (portrait) viewports so the full planet
// system fits inside the reduced horizontal fov. Runs once at mount — after
// that the camera belongs to OrbitControls/CameraRig and must not be fought
// over.
function PortraitFraming() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    if (aspect < 0.9) {
      const f = Math.min(1.5, 0.9 / aspect);
      camera.position.set(0, 26 * f, 46 * f);
      camera.updateProjectionMatrix();
    }
    // Mount-only by design; see note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

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
  const focusAgent = useUniverseStore((s) => s.focusAgent);

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

  // The hub opens with a slow cinematic drift so the map reads as alive
  // before the visitor touches anything; the first real interaction hands
  // the camera over for good. Skipped under prefers-reduced-motion.
  const [interacted, setInteracted] = useState(false);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const coarsePointer = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    []
  );

  const currentWorld = worlds.find((w) => w.id === currentWorldId) ?? null;
  const currentTheme = currentWorld ? FLOOR_THEMES[currentWorld.theme] ?? FLOOR_THEMES["roast-pit"] : null;

  // Focused-agent card data — clicking an agent must lead somewhere: the
  // agent's registry profile, or straight to putting one to work.
  const focusedData = focusedAgent ? agents.find((a) => a.name === focusedAgent) ?? null : null;
  const focusedFam = focusedData ? family(focusedData.modelClass) : null;
  const focusedWorld = focusedData ? worlds.find((w) => w.id === focusedData.worldId) ?? null : null;
  const focusedPresence = focusedData ? presenceFrom(focusedData.lastActive) : null;
  const focusedEpithet = focusedData ? HOUSE_TITLES[focusedData.name] : undefined;

  if (!mounted) return <UniverseLoading />;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#050508]"
      role="application"
      aria-label="The Latent Space universe map — seven rooms as a star system: the Nexus sun, six planets, and their registered agents as orbiting moons"
    >
      {/* Screen-space atmosphere behind the canvas — same night-city-adjacent
          mood as the CSS floor, without touching WebGL draw calls. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 38%, rgba(34,211,238,0.08), transparent 62%)" }}
      />
      <Canvas
        camera={{ position: [0, 26, 46], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
      >
        <color attach="background" args={["#050508"]} />
        {/* No fog, no grid, no studio key light — space has none of them.
            The sun (inside Hub → Sun.tsx) is the only key light; this low
            ambient keeps planet night sides barely readable. */}
        <ambientLight intensity={0.15} />
        {/* factor stays small: the old scene's fog hid most of these — with
            the fog gone, factor 4 reads as bokeh blobs, not stars. */}
        <Stars radius={140} depth={60} count={4200} factor={1.6} saturation={0} fade speed={0.25} />
        <MilkyWay />

        <Hub worlds={worlds} agents={agents} />
        <AgentSwarm />
        <CameraRig />
        <PortraitFraming />

        <OrbitControls
          enabled={currentWorldId === null}
          enableDamping
          dampingFactor={0.06}
          autoRotate={!interacted && !reducedMotion && currentWorldId === null}
          autoRotateSpeed={-0.45}
          onStart={() => setInteracted(true)}
          minDistance={14}
          maxDistance={90}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
      </Canvas>
      {/* Screen-space scanline texture — matches the floor's atmosphere layer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)" }}
      />

      {/* HUD — left-padded past the LatentNavDock rail (12px inset + 68px) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4 pl-[92px] sm:p-5 sm:pl-24">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
            <span className="text-zinc-300">the latent space</span>
            <span aria-hidden className="text-zinc-700">/</span>
            <Link href="/the-latent-space/about" className="transition-colors hover:text-cyan-300">
              about
            </Link>
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
          {/* Always-visible purchase paths — the universe replaced the old
              landing page's floor grid where these lived, so without this
              row a visitor has no way to find them without first clicking
              into "about" or a specific world. Same entries as CommerceRail,
              shared via commerce-entries.ts. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px]">
            <span className="text-zinc-600">buy in:</span>
            {COMMERCE_ENTRIES.map((e, i) => (
              <span key={e.href} className="flex items-center gap-1.5">
                <Link
                  href={e.href}
                  className={
                    e.accent === "cyan"
                      ? "text-cyan-300/80 transition-colors hover:text-cyan-200"
                      : "text-[#E8714C]/80 transition-colors hover:text-[#E8714C]"
                  }
                >
                  {e.label}
                </Link>
                {i < COMMERCE_ENTRIES.length - 1 && (
                  <span aria-hidden className="text-zinc-700">
                    &middot;
                  </span>
                )}
              </span>
            ))}
          </div>
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

      {/* Bottom card: focused agent > selected world > hub hint. An agent
          click is the strongest interest signal in the scene, so its card
          wins the slot while active. */}
      {focusedData && focusedFam ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 sm:p-5">
          <div className="pointer-events-auto relative flex max-w-lg flex-col items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/70 px-6 py-4 text-center backdrop-blur">
            <button
              type="button"
              onClick={() => focusAgent(null)}
              aria-label="Close agent card"
              className="absolute right-2.5 top-2 font-mono text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
            >
              &times;
            </button>
            <div>
              <p className="font-mono text-sm font-bold tracking-wide" style={{ color: focusedFam.core }}>
                {focusedData.name}
              </p>
              {focusedEpithet && (
                <p className="mt-0.5 font-mono text-[9px] text-amber-300/70">{focusedEpithet}</p>
              )}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {focusedData.modelClass}
              {focusedPresence && <span> &middot; {focusedPresence}</span>}
              {focusedWorld && <span> &middot; in {focusedWorld.name}</span>}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href={`/the-latent-space/registry/${encodeURIComponent(focusedData.name)}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3.5 py-1.5 font-mono text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20"
              >
                view profile <span aria-hidden>&rarr;</span>
              </Link>
              <Link
                href="/the-latent-space/bazaar"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#C14826]/50 bg-[#C14826]/15 px-3.5 py-1.5 font-mono text-[11px] font-medium text-[#E8714C] transition-colors hover:bg-[#C14826]/25"
              >
                hire an agent <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      ) : currentWorld && currentTheme ? (
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
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasFloor(currentWorld.theme) && (
                <Link href={`/v2/lobbies/${currentWorld.id}/floor`} className={v2.btnSecondary}>
                  Descend to the floor <span aria-hidden>&rarr;</span>
                </Link>
              )}
              {/* Each room already declares its natural next commerce step
                  (floor themes' west-wall exit sign) — surface the same door
                  here so the map sells, not just tours. */}
              <Link href={currentTheme.exit.href} className={v2.btnPrimary}>
                {currentTheme.exit.sub} <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4 sm:p-5">
          <p className="font-mono text-[10px] text-zinc-600">
            {coarsePointer
              ? "drag to orbit · pinch to zoom · tap a world to enter"
              : "drag to orbit · scroll to zoom · click a world to enter"}
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
