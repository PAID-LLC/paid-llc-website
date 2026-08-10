"use client";

import { useEffect, useRef, useState } from "react";
import * as engine from "@/lib/audio/engine";
import { bedAt, SURFACE_VOICE, type SurfaceId } from "@/lib/audio/worlds";
import { useAudioStore } from "./useAudioStore";

// ── One world's bed ──────────────────────────────────────────────────────────
//
// Renders nothing; it is an effect holder that lives as long as the surface
// does. Safe either side of the r3f boundary, which is what lets the six
// inhabited worlds mount it from inside <Inhabitants> — where both the live
// intensity and the sky already are — and the other three mount it directly.
//
// `intensity` is the honest part. It is a 0..1 read off the world's own live
// snapshot — forge heat, registered population, theses excavated — and the
// mixer names the driver so a visitor can tell what they are listening to. A
// quiet world is quiet because nothing is happening in it.
//
// The bed is never torn down to change: every parameter glides, so a poll
// returning new numbers is a slow shift in the room rather than an audible
// restart.

/** How often a storm gets to make a noise, in ms. Wide and random — evenly
 *  spaced thunder reads as a machine. */
const THUNDER_MIN = 9_000;
const THUNDER_SPAN = 14_000;

export default function WorldAudio({
  surface,
  intensity,
  weather,
  onReady,
}: {
  surface: SurfaceId;
  /** 0..1 from this world's own live data. */
  intensity: number;
  /** From the sky the scene already fetched, when the world has one. */
  weather?: { severity: number; particles: string | null; flash: boolean } | null;
  /** Fired once the bed is mounted and its trim exists. Anything that attaches
   *  extra nodes to this surface has to wait for it: mounting is async (the
   *  AudioContext has to start first) and child effects run before parent
   *  ones, so a caller cannot infer readiness from render order. */
  onReady?: (ready: boolean) => void;
}) {
  const enabled = useAudioStore((s) => s.enabled);
  const trim = useAudioStore((s) => s.worlds[surface]);
  const mounted = useRef(false);

  // Read here rather than taken as a prop: it is a global browser setting
  // feeding a global engine flag, so one caller passing the wrong value
  // would silently override every other surface.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => {
      setReduced(mq.matches);
      engine.setReducedTransients(mq.matches);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Mount and tear down with the toggle, not with the page: a muted visitor
  // has no oscillators running at all, and no AudioContext behind them.
  useEffect(() => {
    if (!enabled) {
      if (mounted.current) {
        engine.unmountBed(surface);
        mounted.current = false;
        onReady?.(false);
      }
      return;
    }
    let cancelled = false;
    void engine.start().then(() => {
      if (cancelled) return;
      engine.setSurfaceLevel(surface, typeof trim === "number" ? trim : 0.8);
      engine.mountBed(surface, SURFACE_VOICE[surface], bedAt(SURFACE_VOICE[surface], intensity));
      mounted.current = true;
      onReady?.(true);
    });
    return () => {
      cancelled = true;
    };
    // `intensity` is deliberately not a dependency — it is applied by the
    // update effect below. Rebuilding the bed on every poll is exactly the
    // restart this design exists to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, surface]);

  useEffect(
    () => () => {
      engine.unmountBed(surface);
      mounted.current = false;
    },
    [surface]
  );

  useEffect(() => {
    if (!enabled) return;
    engine.updateBed(surface, bedAt(SURFACE_VOICE[surface], intensity));
  }, [enabled, surface, intensity]);

  useEffect(() => {
    if (!enabled || !weather) return;
    // Rain and sparks are bright and thin; mist and dust are broad and low.
    const band =
      weather.particles === "sparks" || weather.particles === "embers"
        ? 2400
        : weather.particles === "motes"
          ? 700
          : 1100;
    engine.setWeather(surface, weather.severity, band);
  }, [enabled, surface, weather]);

  useEffect(() => {
    if (!enabled || !weather?.flash || reduced) return;
    let stopped = false;
    let timer = 0;
    const roll = () => {
      timer = window.setTimeout(() => {
        if (stopped) return;
        engine.thunder(surface);
        roll();
      }, THUNDER_MIN + Math.random() * THUNDER_SPAN);
    };
    roll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, surface, weather?.flash, reduced]);

  return null;
}
