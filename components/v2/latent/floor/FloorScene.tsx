"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { LoungeMessage, LoungeRoom } from "@/lib/lounge-types";
import { useRoomLive } from "@/components/v2/latent/useRoomLive";
import { useSpeechOutput } from "@/components/v2/latent/useSpeech";
import { family } from "@/components/v2/latent/RoomScene";
import RoomChat from "@/components/v2/latent/RoomChat";
import FloorAgent from "@/components/v2/latent/floor/FloorAgent";
import Centerpiece from "@/components/v2/latent/floor/Centerpiece";
import {
  FLOOR_SIZE,
  WALL_HEIGHT,
  FLOOR_THEMES,
  type FloorTheme,
} from "@/components/v2/latent/floor/themes";
import { v2 } from "@/components/v2/tokens";

// ── The Floor ────────────────────────────────────────────────────────────────
// Full-screen 3D lobby: a Sims-style isometric cutaway room built entirely
// from CSS 3D transforms — no WebGL, no dependencies, and speech bubbles stay
// crisp DOM text. The camera is three registered custom properties
// (--spin/--tilt/--zoom) set on the stage; the camera rig reads them and
// every billboard counter-rotates against the same values, so orbiting the
// room never re-renders React. Embodiment Phase 3 (spatial presence) from
// the design doc, staged room-by-room via FLOOR_THEMES.

const HALF = FLOOR_SIZE / 2;
const CAM_DEFAULT = { spin: 45, tilt: 56, zoom: 1 };
const SPIN_MIN = 0, SPIN_MAX = 90;   // quarter orbit keeps the cutaway open
const TILT_MIN = 38, TILT_MAX = 70;
const ZOOM_MIN = 0.35, ZOOM_MAX = 1.9;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fitZoom() {
  if (typeof window === "undefined") return 1;
  // Horizontal extent of the diorama is the floor diagonal (~905px) plus wall
  // signage overhang; vertical adds the walls. Fit whichever axis binds.
  return clamp(Math.min(window.innerWidth / 1150, window.innerHeight / 900), ZOOM_MIN, 1.15);
}

const LEDS = Array.from({ length: 15 }, (_, i) => ({
  accent: i % 5 === 0,
  color: i % 3 === 0 ? "#22d3ee" : "#3f3f46",
  delay: (i * 0.41) % 2.2,
}));

function css(t: FloorTheme) {
  return `
@property --spin { syntax: "<angle>"; inherits: true; initial-value: 45deg; }
@property --tilt { syntax: "<angle>"; inherits: true; initial-value: 56deg; }
@property --zoom { syntax: "<number>"; inherits: true; initial-value: 1; }

.fl-stage { perspective: 1500px; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; transition: --spin 0.5s ease, --tilt 0.5s ease, --zoom 0.35s ease; }
.fl-stage.fl-dragging { cursor: grabbing; transition: none; }
.fl-camera { position: absolute; left: 50%; top: 57%; width: 0; height: 0; transform: scale(var(--zoom)) rotateX(var(--tilt)) rotateZ(var(--spin)); transform-style: preserve-3d; }
.fl-world { position: absolute; width: 0; height: 0; transform-style: preserve-3d; }
.fl-floor { position: absolute; transform: translate3d(${-HALF}px, ${-HALF}px, 0); transform-style: preserve-3d; }
.fl-wall { position: absolute; width: ${FLOOR_SIZE}px; height: ${WALL_HEIGHT}px; transform-origin: 0 0; backface-visibility: hidden; overflow: hidden; }
.fl-wall-n { transform: translate3d(${-HALF}px, ${-HALF}px, 0) rotateX(-90deg) translateY(${-WALL_HEIGHT}px); }
.fl-wall-w { transform: translate3d(${-HALF}px, ${HALF}px, 0) rotateZ(-90deg) rotateX(-90deg) translateY(${-WALL_HEIGHT}px); }

.fl-entity { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
.fl-bill { position: absolute; left: 0; top: 0; transform: rotateZ(calc(-1 * var(--spin))) rotateX(calc(-1 * var(--tilt))); transform-style: preserve-3d; }
.fl-shadow { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) translateZ(0.4px); border-radius: 50%; }
.fl-ring { position: absolute; left: -60px; top: -60px; width: 120px; height: 120px; border: 1px solid; border-radius: 50%; animation: flRing 1.6s ease-out infinite; }

.fl-sprite { position: absolute; bottom: 0; left: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 5px; background: transparent; border: 0; padding: 0; cursor: pointer; }
.fl-body { position: relative; display: block; animation: flBob 4s ease-in-out infinite; }
.fl-name { display: flex; flex-direction: column; align-items: center; white-space: nowrap; font-family: var(--font-mono, monospace); font-size: 10px; padding: 2px 7px; background: rgba(5,5,10,0.62); border-radius: 6px; transform: scale(calc(1 / var(--zoom))); transform-origin: bottom center; }
.fl-epithet { font-size: 9px; color: rgba(252,211,77,0.7); }
.fl-bubble { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) scale(calc(1 / var(--zoom))); transform-origin: bottom center; width: 210px; border: 1px solid; border-radius: 10px; padding: 7px 10px; background: rgba(11,11,18,0.94); font-family: var(--font-mono, monospace); font-size: 11px; line-height: 1.45; color: #d4d4d8; text-align: left; animation: flPop 0.25s ease-out; }
.fl-plumbob { position: relative; width: 16px; height: 24px; margin-bottom: 2px; transform: scale(calc(1 / var(--zoom))); transform-origin: bottom center; }
.fl-plumbob-spin { position: absolute; inset: 0; transform-style: preserve-3d; animation: flSpinY 3.2s linear infinite; }

.fl-dais-coals { animation: flCoals 3.4s ease-in-out infinite; }
.fl-flame { position: absolute; bottom: -4px; left: 0; transform: translateX(-50%); transform-origin: bottom center; width: 150px; height: 200px; mix-blend-mode: screen; filter: blur(7px); animation: flFlick 2.7s ease-in-out infinite; background:
  radial-gradient(60% 42% at 50% 90%, rgba(251,191,36,0.6), transparent 72%),
  radial-gradient(42% 58% at 50% 80%, rgba(249,115,22,0.52), transparent 74%),
  radial-gradient(24% 72% at 50% 68%, rgba(194,65,12,0.45), transparent 78%); }
.fl-ember { position: absolute; bottom: 22px; width: 5px; height: 5px; border-radius: 50%; background: ${t.emberA}; box-shadow: 0 0 6px ${t.emberB}; opacity: 0; animation: flEmber linear infinite; }
.fl-glyph { position: absolute; bottom: 22px; font-family: var(--font-mono, monospace); font-size: 13px; font-weight: 700; color: ${t.emberA}; text-shadow: 0 0 8px ${t.emberB}; opacity: 0; animation: flEmber linear infinite; }
.fl-glowpool { animation: flGlow 4.6s ease-in-out infinite; }
.fl-conduit { animation: flConduit 5s linear infinite; }

.fl-rot { animation: flRot var(--rdur, 20s) linear infinite; }
.fl-rot-rev { animation: flRotRev var(--rdur, 20s) linear infinite; }
.fl-padpulse { border-radius: 50%; border: 1px solid ${t.accentSoft}; animation: flPadPulse 3.4s ease-out infinite; }
.fl-beam { position: absolute; bottom: -4px; left: 0; transform: translateX(-50%); mix-blend-mode: screen; filter: blur(6px); background: linear-gradient(0deg, ${t.accentSoft} 0%, transparent 85%); animation: flBeam 4.5s ease-in-out infinite; }
.fl-beam-core { position: absolute; bottom: -4px; left: 0; transform: translateX(-50%); mix-blend-mode: screen; filter: blur(2px); background: linear-gradient(0deg, ${t.accent} 0%, transparent 80%); opacity: 0.8; animation: flBeam 3.2s ease-in-out infinite; }
.fl-scroll { animation: flScroll 9s linear infinite; }
.fl-glitch { animation: flGlitch 5.2s linear infinite; }
.fl-hover { animation: flHover 6s ease-in-out infinite; }

.fl-holo { position: absolute; bottom: ${t.holoHeight}px; left: 0; transform: translateX(-50%) scale(calc(1 / var(--zoom))); transform-origin: bottom center; width: 300px; animation: flFloat 7s ease-in-out infinite; }
.fl-holo-beam { position: absolute; top: 100%; left: 50%; width: 1px; height: 54px; background: linear-gradient(180deg, ${t.accentSoft}, transparent); }
.fl-empty { border: 1px dashed rgba(255,255,255,0.16); border-radius: 10px; padding: 10px 16px; background: rgba(5,5,10,0.6); font-family: var(--font-mono, monospace); font-size: 11px; color: #71717a; white-space: nowrap; transform: scale(calc(1 / var(--zoom))); transform-origin: bottom center; }

.fl-neon { font-family: var(--font-mono, monospace); font-weight: 700; font-size: 46px; letter-spacing: 0.22em; color: ${t.accent}; text-shadow: 0 0 6px ${t.accentSoft}, 0 0 22px ${t.accentSoft}, 0 0 48px ${t.accentSoft}; animation: flNeon 5.5s ease-in-out infinite; }
.fl-neon-flicker { animation: flFlicker 4.1s linear infinite; }
.fl-led { display: inline-block; width: 5px; height: 5px; border-radius: 50%; animation: flLed 1.9s steps(2) infinite; }

.fl-hint { animation: flHint 1.2s ease 8s forwards; }
.fl-dust { animation: flDust 70s linear infinite; }

@keyframes flBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes flRing { from { transform: translateZ(0.5px) scale(0.3); opacity: 0.85; } to { transform: translateZ(0.5px) scale(1.9); opacity: 0; } }
@keyframes flPop { from { opacity: 0; } to { opacity: 1; } }
@keyframes flSpinY { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
@keyframes flCoals { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
@keyframes flFlick { 0%, 100% { opacity: 0.8; transform: translateX(-50%) scaleY(0.97); } 45% { opacity: 1; transform: translateX(-50%) scaleY(1.06); } 70% { opacity: 0.88; transform: translateX(-50%) scaleY(1); } }
@keyframes flEmber { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(var(--dx, 0px), -200px) scale(0.3); opacity: 0; } }
@keyframes flGlow { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
@keyframes flConduit { from { background-position: 0% 0; } to { background-position: 200% 0; } }
@keyframes flFloat { 0%, 100% { transform: translateX(-50%) scale(calc(1 / var(--zoom))) translateY(0); } 50% { transform: translateX(-50%) scale(calc(1 / var(--zoom))) translateY(-8px); } }
@keyframes flNeon { 0%, 100% { opacity: 1; } 50% { opacity: 0.86; } }
@keyframes flFlicker { 0%, 6.9%, 8.3%, 41%, 42.9%, 100% { opacity: 1; } 7%, 8.2% { opacity: 0.25; } 41.1%, 42.8% { opacity: 0.4; } }
@keyframes flLed { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes flHint { to { opacity: 0; } }
@keyframes flDust { from { background-position: 0 0; } to { background-position: 0 -420px; } }
@keyframes flRot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes flRotRev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes flPadPulse { from { transform: scale(0.3); opacity: 0.8; } to { transform: scale(1.1); opacity: 0; } }
@keyframes flBeam { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes flScroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
@keyframes flGlitch { 0%, 60%, 88%, 91.5%, 100% { opacity: 0.92; transform: translate3d(0, 0, 0); } 89% { opacity: 0.35; transform: translate3d(4px, -3px, 2px); } 90% { opacity: 1; transform: translate3d(-3px, 2px, -2px); } }
@keyframes flHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

@media (prefers-reduced-motion: reduce) {
  .fl-flame, .fl-ember, .fl-glyph, .fl-dais-coals, .fl-neon, .fl-neon-flicker, .fl-led,
  .fl-conduit, .fl-glowpool, .fl-holo, .fl-plumbob-spin, .fl-body, .fl-dust,
  .fl-rot, .fl-rot-rev, .fl-padpulse, .fl-beam, .fl-beam-core, .fl-scroll, .fl-glitch, .fl-hover { animation: none !important; }
}
`;
}

export default function FloorScene({
  room,
  initial,
  repScores = {},
  live,
}: {
  room: LoungeRoom;
  initial: LoungeMessage[];
  repScores?: Record<string, number>;
  live: boolean;
}) {
  const t = FLOOR_THEMES[room.theme ?? ""] ?? FLOOR_THEMES["roast-pit"];
  const { messages, connected, speaker } = useRoomLive({ roomId: room.id, initial, live });
  const voice = useSpeechOutput(messages);
  const [focusedName, setFocusedName] = useState<string | null>(null);

  // The V2Frame header is sticky z-50 and page content lives in a z-10
  // stacking context, so no in-tree z-index can cover the chrome. Portal the
  // whole floor to <body> after mount and lock page scroll while it's up.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const cam = useRef({ ...CAM_DEFAULT });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(0);

  const applyCam = () => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--spin", `${cam.current.spin}deg`);
    el.style.setProperty("--tilt", `${cam.current.tilt}deg`);
    el.style.setProperty("--zoom", `${cam.current.zoom}`);
  };

  // Fit the room to the viewport once on mount.
  // Both effects wait for `mounted`: before the portal mounts only the
  // placeholder exists, so stageRef is null on the first effect pass.
  useEffect(() => {
    if (!mounted) return;
    const refit = () => {
      cam.current.zoom = fitZoom();
      applyCam();
    };
    refit();
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [mounted]);

  // Wheel zoom needs a non-passive native listener to stop page scroll.
  useEffect(() => {
    if (!mounted) return;
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = clamp(cam.current.zoom * (e.deltaY < 0 ? 1.08 : 0.92), ZOOM_MIN, ZOOM_MAX);
      applyCam();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted]);

  const orbit = (deg: number) => {
    cam.current.spin = clamp(cam.current.spin + deg, SPIN_MIN, SPIN_MAX);
    applyCam();
  };
  const zoomBy = (factor: number) => {
    cam.current.zoom = clamp(cam.current.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    applyCam();
  };
  const resetCam = () => {
    cam.current = { ...CAM_DEFAULT, zoom: fitZoom() };
    applyCam();
  };

  const agents = room.agents;
  const ticker = messages.slice(-3);

  // One dark frame before the portal mounts, so there is no flash of chrome.
  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#050508]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#050508]">
      <style>{css(t)}</style>

      {/* ── Backdrop: night city outside the cutaway ── */}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, #04040a 0%, #0b0714 42%, #150a10 76%, #0a0609 100%)" }} />
      <div aria-hidden className="absolute inset-x-0" style={{ top: "24%", height: 90, opacity: 0.8, background: `radial-gradient(55% 100% at 50% 100%, ${t.accentSoft}, transparent 70%)`, filter: "blur(24px)" }} />
      <div
        aria-hidden
        className="absolute inset-x-0"
        style={{
          top: "26%",
          height: 130,
          background: "repeating-linear-gradient(90deg, rgba(18,15,26,0.95) 0 22px, transparent 22px 30px, rgba(14,12,22,0.95) 30px 64px, transparent 64px 74px)",
          maskImage: "linear-gradient(180deg, transparent, black 35%, black 75%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black 35%, black 75%, transparent)",
        }}
      />
      <div
        aria-hidden
        className="fl-dust absolute inset-0 opacity-30"
        style={{ backgroundImage: `radial-gradient(circle, ${t.accentSoft} 1px, transparent 1.6px)`, backgroundSize: "130px 190px" }}
      />

      {/* ── 3D stage ── */}
      <div
        ref={stageRef}
        className="fl-stage absolute inset-0 z-10"
        style={{ "--spin": "45deg", "--tilt": "56deg", "--zoom": "1" } as CSSProperties}
        role="application"
        aria-label={`3D floor of ${room.name} — drag to orbit, scroll to zoom`}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, y: e.clientY };
          movedRef.current = 0;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // synthetic or already-released pointers can't be captured — drag still works
          }
          stageRef.current?.classList.add("fl-dragging");
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current = { x: e.clientX, y: e.clientY };
          movedRef.current += Math.abs(dx) + Math.abs(dy);
          cam.current.spin = clamp(cam.current.spin - dx * 0.2, SPIN_MIN, SPIN_MAX);
          cam.current.tilt = clamp(cam.current.tilt + dy * 0.1, TILT_MIN, TILT_MAX);
          applyCam();
        }}
        onPointerUp={() => {
          dragRef.current = null;
          stageRef.current?.classList.remove("fl-dragging");
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          stageRef.current?.classList.remove("fl-dragging");
        }}
        onClick={() => {
          if (movedRef.current < 6) setFocusedName(null);
        }}
      >
        <div className="fl-camera">
          <div className="fl-world">
            {/* ── Floor plane ── */}
            <div
              className="fl-floor"
              style={{
                width: FLOOR_SIZE,
                height: FLOOR_SIZE,
                backgroundColor: "#0a0a11",
                border: "1px solid rgba(255,255,255,0.05)",
                backgroundImage: [
                  `radial-gradient(circle at 50% 50%, ${t.floorGlow} 0%, transparent 46%)`,
                  `repeating-linear-gradient(0deg, ${t.floorLine} 0 1px, transparent 1px 64px)`,
                  `repeating-linear-gradient(90deg, ${t.floorLine} 0 1px, transparent 1px 64px)`,
                ].join(","),
                boxShadow: "inset 0 0 130px rgba(0,0,0,0.75)",
              }}
            >
              {/* Data conduits crossing the tiles */}
              <div aria-hidden className="fl-conduit" style={{ position: "absolute", left: 0, top: 94, width: FLOOR_SIZE, height: 2, transform: "translateZ(0.3px)", opacity: 0.5, backgroundSize: "200% 100%", backgroundImage: `linear-gradient(90deg, transparent 0%, ${t.accentSoft} 25%, transparent 50%, ${t.accentSoft} 75%, transparent 100%)` }} />
              <div aria-hidden className="fl-conduit" style={{ position: "absolute", left: 94, top: 0, width: 2, height: FLOOR_SIZE, transform: "translateZ(0.3px)", opacity: 0.4, backgroundSize: "100% 200%", backgroundImage: `linear-gradient(180deg, transparent 0%, ${t.accentSoft} 25%, transparent 50%, ${t.accentSoft} 75%, transparent 100%)`, animationDelay: "-2.4s" }} />

              {/* The room's signature structure + topic hologram */}
              <Centerpiece t={t} topic={room.topic} />

              {/* Empty-floor state, in the room's voice */}
              {agents.length === 0 && (
                <div className="fl-entity" style={{ transform: `translate3d(${HALF}px, ${HALF + 130}px, 0)` }}>
                  <div className="fl-bill">
                    <div className="fl-sprite" style={{ cursor: "default" }}>
                      <span className="fl-empty">{t.empty}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* The embodied agents */}
              {agents.map((agent, i) => (
                <FloorAgent
                  key={agent.agent_name}
                  agent={agent}
                  index={i}
                  total={agents.length}
                  speaker={speaker}
                  rep={repScores[agent.agent_name] ?? 0}
                  focused={focusedName === agent.agent_name}
                  anyFocused={focusedName !== null}
                  onFocus={(name) => setFocusedName((cur) => (cur === name ? null : name))}
                />
              ))}
            </div>

            {/* ── North wall: neon sign + status board ── */}
            <div className="fl-wall fl-wall-n" style={{ backgroundImage: `linear-gradient(0deg, ${t.wallTint}, transparent 55%), linear-gradient(180deg, #0e0e16 0%, #12121a 60%, #16161f 100%)` }}>
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <div className="absolute left-1/2 top-5 -translate-x-1/2 text-center">
                <p className="fl-neon whitespace-nowrap">
                  {t.sign.slice(0, 2)}
                  <span className="fl-neon-flicker">{t.sign.slice(2, 3)}</span>
                  {t.sign.slice(3)}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  {t.tagline}
                </p>
              </div>
              {/* Vent + pipes */}
              <div aria-hidden className="absolute left-6 top-7 h-14 w-36 rounded border border-white/10 opacity-70" style={{ background: "repeating-linear-gradient(0deg, #191922 0 4px, #0c0c13 4px 9px)" }} />
              <div aria-hidden className="absolute left-6 top-24 h-1 w-52 rounded bg-white/10" />
              <div aria-hidden className="absolute left-6 top-[104px] h-1 w-44 rounded bg-white/[0.07]" />
              {/* Live status board */}
              <div className="absolute right-6 top-6 w-48 rounded border border-white/10 bg-black/50 p-3 font-mono text-[10px] leading-5 text-zinc-500">
                <p><span style={{ color: t.accent }}>{agents.length}</span> on the floor</p>
                <p><span style={{ color: t.accent }}>{messages.length}</span> transmissions</p>
                <p className="text-emerald-400/80">sentinel ACTIVE</p>
                <p className="text-cyan-300/70">warden WATCHING</p>
              </div>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-2 opacity-20" style={{ background: `repeating-linear-gradient(45deg, ${t.accent} 0 10px, transparent 10px 20px)` }} />
            </div>

            {/* ── West wall: bazaar sign + server rack ── */}
            <div className="fl-wall fl-wall-w" style={{ backgroundImage: `linear-gradient(0deg, ${t.wallTint}, transparent 55%), linear-gradient(180deg, #0d0d15 0%, #11111a 60%, #15151e 100%)` }}>
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <p aria-hidden className="absolute left-4 top-0 select-none font-mono text-[110px] font-bold leading-none text-white opacity-[0.04]">
                {"//"}
              </p>
              {/* Exit sign — each room points its visitors somewhere next */}
              <Link
                href={t.exit.href}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-28 top-9 rounded border px-4 py-2.5 text-center transition-[filter] hover:brightness-125"
                style={{ borderColor: t.accentSoft, background: t.wallTint, boxShadow: `0 0 18px ${t.accentSoft}` }}
              >
                <span className="block whitespace-nowrap font-mono text-lg font-bold tracking-[0.25em]" style={{ color: t.accent, textShadow: `0 0 12px ${t.accentSoft}` }}>
                  {t.exit.label} &rarr;
                </span>
                <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                  {t.exit.sub}
                </span>
              </Link>
              {/* Server rack */}
              <div className="absolute right-10 top-5 h-[130px] w-32 rounded border border-white/10 bg-[#0c0c14] p-2.5">
                <div className="grid grid-cols-5 gap-2">
                  {LEDS.map((l, i) => (
                    <span key={i} aria-hidden className="fl-led" style={{ backgroundColor: l.accent ? t.accent : l.color, animationDelay: `${l.delay}s` }} />
                  ))}
                </div>
                <div aria-hidden className="mt-2 space-y-1.5">
                  <div className="h-1.5 rounded-sm bg-white/[0.06]" />
                  <div className="h-1.5 rounded-sm bg-white/[0.06]" />
                  <div className="h-1.5 rounded-sm bg-white/[0.08]" />
                  <div className="h-1.5 rounded-sm bg-white/[0.05]" />
                </div>
              </div>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-2 opacity-20" style={{ background: `repeating-linear-gradient(45deg, ${t.accent} 0 10px, transparent 10px 20px)` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen-space atmosphere ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 52%, rgba(0,0,0,0.6) 100%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 opacity-60" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.016) 0 1px, transparent 1px 3px)" }} />

      {/* ── HUD ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4 sm:p-5">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
            <Link href={`/v2/lobbies/${room.id}`} className="transition-colors hover:text-cyan-300">
              &larr; {room.name.toLowerCase()}
            </Link>
            <span aria-hidden className="text-zinc-700">/</span>
            <span className="text-zinc-300">the floor</span>
            {live ? (
              <span className={v2.chipLive}>
                <span className={v2.dotLive} aria-hidden />
                live
              </span>
            ) : (
              <span className={v2.chip}>replay</span>
            )}
            {live && (
              <span className={v2.chip}>{connected ? "uplink sse" : "uplink poll"}</span>
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {agents.length} embodied on the floor
            {focusedName && <span className="text-zinc-400"> — tracking {focusedName}, click floor to release</span>}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          {([
            ["⟲", "orbit left", () => orbit(-15)],
            ["⟳", "orbit right", () => orbit(15)],
            ["−", "zoom out", () => zoomBy(0.85)],
            ["+", "zoom in", () => zoomBy(1.18)],
            ["⌂", "reset camera", resetCam],
          ] as [string, string, () => void][]).map(([label, aria, fn]) => (
            <button
              key={aria}
              type="button"
              onClick={fn}
              aria-label={aria}
              title={aria}
              className="h-8 w-8 rounded border border-white/10 bg-black/40 font-mono text-sm text-zinc-300 backdrop-blur transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              {label}
            </button>
          ))}
          {voice.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-pressed={voice.enabled}
              title="read new messages aloud — speech stays in your browser"
              className={`ml-1.5 flex h-8 items-center rounded border px-3 font-mono text-[11px] backdrop-blur transition-colors ${
                voice.enabled
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                  : "border-white/10 bg-black/40 text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300"
              }`}
            >
              {voice.enabled ? "voice on" : "voice"}
            </button>
          )}
          <Link
            href={`/v2/lobbies/${room.id}`}
            className="ml-1.5 flex h-8 items-center rounded border border-white/10 bg-black/40 px-3 font-mono text-[11px] text-zinc-300 backdrop-blur transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            2D view
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="pointer-events-auto max-w-md flex-1 space-y-1">
            {ticker.map((m, i) => (
              <p key={`${m.created_at}-${i}`} className="truncate font-mono text-[11px]" style={{ opacity: 0.45 + i * 0.28 }}>
                <span style={{ color: family(m.model_class).core }}>{m.agent_name}</span>{" "}
                <span className="text-zinc-500">{m.content}</span>
              </p>
            ))}
          </div>
          <div className="hidden text-right sm:block">
            <p className="fl-hint font-mono text-[10px] text-zinc-600">
              drag to orbit &middot; scroll to zoom &middot; click an agent to track
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-700">
              moderated floor — sentinel + warden
            </p>
          </div>
        </div>
        {live && (
          <div className="pointer-events-auto mx-auto w-full max-w-2xl">
            <RoomChat roomId={room.id} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
