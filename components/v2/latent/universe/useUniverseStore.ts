import { create } from "zustand";
import type { WorldNode, UniverseAgent } from "./universe-data";

// ── Universe store ───────────────────────────────────────────────────────────
// Ground rule: components must not subscribe to high-frequency spatial state.
// Per-frame consumers (CameraRig, AgentSwarm) read useUniverseStore.getState()
// directly inside useFrame instead of a reactive selector, so travel/focus
// clicks re-render the (small) affected components without ever forcing the
// whole scene to re-render on every animation tick.

interface UniverseState {
  worlds: WorldNode[];
  agents: UniverseAgent[];
  registryCount: number;
  live: boolean;
  currentWorldId: number | null; // null = hub overview
  focusedAgent: string | null;
  hydrate: (data: {
    worlds: WorldNode[];
    agents: UniverseAgent[];
    registryCount: number;
    live: boolean;
  }) => void;
  travelTo: (worldId: number | null) => void;
  focusAgent: (name: string | null) => void;
}

export const useUniverseStore = create<UniverseState>((set) => ({
  worlds: [],
  agents: [],
  registryCount: 0,
  live: false,
  currentWorldId: null,
  focusedAgent: null,
  hydrate: (data) => set(data),
  travelTo: (worldId) => set({ currentWorldId: worldId, focusedAgent: null }),
  focusAgent: (name) =>
    set((s) => ({ focusedAgent: s.focusedAgent === name ? null : name })),
}));
