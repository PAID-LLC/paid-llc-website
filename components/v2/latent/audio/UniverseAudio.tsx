"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as engine from "@/lib/audio/engine";
import { ROOM_SURFACE, SURFACE_VOICE, normalise, type SurfaceId } from "@/lib/audio/worlds";
import { useAudioStore } from "./useAudioStore";
import WorldAudio from "./WorldAudio";

// ── The star map's own sound ─────────────────────────────────────────────────
//
// The universe is not a place, so a place's bed would be the wrong sound for
// it. It is the sum of the worlds, so it is played as one: a wide slow pad,
// plus one sustained note per world at that world's own key, at that world's
// own real activity level.
//
// The result is that you can hear which worlds are busy before you visit them,
// and a world with nothing happening in it is silent in the chord — the same
// claim its dark planet is already making on screen. Nothing is added to fill
// the gap.

export default function UniverseAudio({
  worlds,
  registryCount,
}: {
  worlds: { id: number; activity?: { level: number } }[];
  registryCount: number;
}) {
  const enabled = useAudioStore((s) => s.enabled);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((v: boolean) => setReady(v), []);

  // The pad itself follows the size of the ecosystem, logarithmically: the
  // difference between 0 and 4 registered agents is the whole story and the
  // difference between 300 and 400 is not.
  const intensity = useMemo(() => normalise(registryCount, 60), [registryCount]);

  const notes = useMemo(
    () =>
      worlds
        .map((w) => {
          const surface = ROOM_SURFACE[w.id];
          if (!surface) return null;
          return {
            id: surface,
            freq: SURFACE_VOICE[surface].key * 2,
            level: Math.max(0, Math.min(1, w.activity?.level ?? 0)),
          };
        })
        .filter((n): n is { id: SurfaceId; freq: number; level: number } => n !== null),
    [worlds]
  );

  useEffect(() => {
    if (!enabled || !ready) return;
    engine.setChord("universe", notes);
  }, [enabled, ready, notes]);

  return (
    <WorldAudio surface="universe" intensity={intensity} onReady={onReady} />
  );
}
