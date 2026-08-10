"use client";

import { create } from "zustand";
import * as engine from "@/lib/audio/engine";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  clamp01,
  effectiveGain,
  parseSettings,
  serialiseSettings,
  worldGain,
  type AudioSettings,
} from "@/lib/audio/mixer";
import type { SurfaceId } from "@/lib/audio/worlds";

// ── The mixer store ──────────────────────────────────────────────────────────
//
// zustand rather than a React context, for the same reason useUniverseStore is:
// every world surface renders through createPortal(document.body), so the dock
// in SiteChrome and the bed inside a world Canvas are in different trees. A
// store crosses that; a provider would have to wrap both.
//
// The engine underneath is a module singleton — there is exactly one
// AudioContext per document by definition. This store is the reactive half and
// the only thing components talk to.

interface AudioStore extends AudioSettings {
  hydrated: boolean;
  /** True once an AudioContext exists. Before this, no context has been
   *  constructed at all — not a suspended one waiting on a gesture. */
  live: boolean;
  hydrate: () => void;
  toggle: () => void;
  /** Make sure the context exists and is running. Must be called from inside
   *  a user gesture. Idempotent, and safe to call when it already is. */
  resume: () => void;
  setMaster: (v: number) => void;
  setWorld: (surface: string, v: number) => void;
}

function persist(s: AudioSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, serialiseSettings(s));
  } catch {
    /* private mode, quota, disabled storage — the session still works */
  }
}

/** Push the whole settings state at the engine. Cheap and total, so there is
 *  no path where one slider is applied and another is not. */
function apply(s: AudioSettings) {
  engine.setMaster(s.enabled ? clamp01(s.master) : 0);
  for (const [surface, v] of Object.entries(s.worlds)) {
    engine.setSurfaceLevel(surface as SurfaceId, clamp01(v));
  }
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  live: false,

  hydrate: () => {
    if (get().hydrated) return;
    let saved: AudioSettings = { ...DEFAULT_SETTINGS, worlds: {} };
    try {
      saved = parseSettings(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* keep the defaults, which are silent */
    }
    set({ ...saved, hydrated: true });

    // A returning visitor who left sound on gets it back — but still only
    // after a real gesture, because a context built without one is created
    // suspended and never makes a sound. One shot, then the listener is gone.
    if (saved.enabled) {
      const arm = () => {
        void engine.start().then(() => {
          set({ live: true });
          apply(get());
        });
        window.removeEventListener("pointerdown", arm);
        window.removeEventListener("keydown", arm);
      };
      window.addEventListener("pointerdown", arm, { once: true });
      window.addEventListener("keydown", arm, { once: true });
    }
  },

  resume: () => {
    if (!get().enabled) return;
    void engine.start().then(() => {
      set({ live: true });
      apply(get());
    });
  },

  toggle: () => {
    const next = !get().enabled;
    set({ enabled: next });
    const s = get();
    persist(s);
    if (next) {
      // Called straight out of the click handler, which is what makes the
      // context legal to construct.
      void engine.start().then(() => {
        set({ live: true });
        apply(get());
      });
    } else {
      apply(s);
    }
  },

  setMaster: (v) => {
    set({ master: clamp01(v) });
    const s = get();
    persist(s);
    apply(s);
  },

  setWorld: (surface, v) => {
    set({ worlds: { ...get().worlds, [surface]: clamp01(v) } });
    const s = get();
    persist(s);
    engine.setSurfaceLevel(surface as SurfaceId, clamp01(v));
  },
}));

/** The level a surface is actually running at, for components that need to
 *  know whether it is worth mounting anything. */
export function surfaceLevel(s: AudioStore, surface: string): number {
  return effectiveGain(s, surface);
}

export { worldGain };
