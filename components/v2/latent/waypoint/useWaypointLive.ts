"use client";

import { useEffect, useState } from "react";
import type { WaypointSnapshot } from "@/lib/waypoint/data";

// ── Live board state for Waypoint ─────────────────────────────────────────────
// No tick of its own — this is a compile-class (meta-compiler) world, so
// "live" just means "poll the read model," matching the /api/waypoint/state
// route's own 60-second edge cache.

const POLL_MS = 60_000;

export function useWaypointLive(initial: WaypointSnapshot): WaypointSnapshot {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/waypoint/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as WaypointSnapshot;
        if (!cancelled && data.live) setState(data);
      } catch {
        // the board keeps its last known shape
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
