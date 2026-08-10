"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudioStore } from "./useAudioStore";
import { worldGain } from "@/lib/audio/mixer";
import { SURFACE_LABEL, SURFACE_VOICE, surfaceFor } from "@/lib/audio/worlds";

// ── The mixer ────────────────────────────────────────────────────────────────
//
// One speaker button on every immersive surface, opening a panel with a mute,
// a Universe slider and a slider for whichever world the visitor is standing
// on. Mounted once by SiteChrome alongside LatentNavDock, off the same route
// list — never per page. (components/v2/GlassSidebar and its dock cost four
// worlds their navigation the last time surfaces mounted their own copies.)
//
// WCAG 2.2 SC 1.4.2 wants a stop mechanism OR an independent volume control
// for anything that plays automatically past three seconds. Nothing here plays
// automatically at all, and both mechanisms ship anyway. Native <input
// type="range"> and a real <button> mean keyboard and screen-reader support
// are not something this component has to implement.

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
      <path
        d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {on ? (
        <>
          <path d="M15.4 9.2a4 4 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M17.9 6.7a7.5 7.5 0 0 1 0 10.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <path d="M16 10l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Slider({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[10px] uppercase tracking-[0.18em] text-white/70">
          {label}
        </label>
        <span className="tabular-nums text-[10px] text-white/40">{pct}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        aria-valuetext={`${pct} percent`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
      />
      {hint && <p className="mt-1 text-[9px] leading-snug text-white/35">{hint}</p>}
    </div>
  );
}

export default function AudioDock() {
  const pathname = usePathname();
  const surface = surfaceFor(pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const enabled = useAudioStore((s) => s.enabled);
  const master = useAudioStore((s) => s.master);
  const worlds = useAudioStore((s) => s.worlds);
  const hydrate = useAudioStore((s) => s.hydrate);
  const toggle = useAudioStore((s) => s.toggle);
  const setMaster = useAudioStore((s) => s.setMaster);
  const setWorld = useAudioStore((s) => s.setWorld);
  const resume = useAudioStore((s) => s.resume);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Click-away and Escape. A panel pinned over a 3D world that will not close
  // is worse than one that is hard to open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const voice = surface ? SURFACE_VOICE[surface] : null;

  return (
    <div
      ref={rootRef}
      className="fixed right-4 top-4 z-[110] lg:bottom-4 lg:top-auto"
      data-testid="audio-dock"
    >
      {open && (
        <div className="absolute right-0 top-11 w-[236px] rounded-xl border border-white/12 bg-black/85 p-3.5 backdrop-blur-md lg:bottom-11 lg:top-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">Sound</p>
            <button
              type="button"
              onClick={toggle}
              aria-pressed={enabled}
              className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
                enabled
                  ? "border-cyan-400/50 text-cyan-200"
                  : "border-white/20 text-white/45 hover:text-white/80"
              }`}
            >
              {enabled ? "on" : "off"}
            </button>
          </div>

          <Slider
            id="audio-master"
            label="Universe"
            value={master}
            disabled={!enabled}
            onChange={setMaster}
          />

          {surface && voice && (
            <Slider
              id="audio-world"
              label={SURFACE_LABEL[surface]}
              hint={`Follows ${voice.driver}.`}
              value={worldGain({ enabled, master, worlds }, surface)}
              disabled={!enabled}
              onChange={(v) => setWorld(surface, v)}
            />
          )}

          <p className="mt-3 border-t border-white/10 pt-2.5 text-[9px] leading-relaxed text-white/35">
            {enabled
              ? "Every sound here is generated in your browser from the same live data the world is drawn from. Nothing is recorded and nothing is downloaded."
              : "Off by default. Nothing is loaded and no audio context exists until you turn this on."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          // First press does both: turn it on and show what the controls are.
          if (!enabled && !open) toggle();
          // Already on — a returning visitor whose preference was restored
          // from storage but whose context has not been built yet. This is a
          // real gesture, so use it rather than waiting on the one-shot
          // arming listener, which may already have been spent.
          else if (enabled) resume();
          setOpen((v) => !v);
        }}
        aria-label={enabled ? "Sound settings — currently on" : "Turn on sound"}
        aria-expanded={open}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-md transition-colors ${
          enabled
            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
            : "border-white/15 bg-black/60 text-white/50 hover:text-white/85"
        }`}
      >
        <SpeakerIcon on={enabled} />
      </button>
    </div>
  );
}
