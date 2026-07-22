"use client";

import { useEffect, useState } from "react";
import type { CrucibleSnapshot } from "@/lib/crucible/data";

// ── Live arena state for the Crucible ─────────────────────────────────────────
// No tick of its own — this is a compile-class world, so "live" just means
// "poll the read model," matching the /api/crucible/state route's own
// 60-second edge cache.

const POLL_MS = 60_000;

export function useCrucibleLive(initial: CrucibleSnapshot): CrucibleSnapshot {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/crucible/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CrucibleSnapshot;
        if (!cancelled && data.live) setState(data);
      } catch {
        // the arena keeps its last known shape
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
