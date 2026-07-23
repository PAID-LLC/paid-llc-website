"use client";

import { useEffect, useState } from "react";
import type { LatheSnapshot } from "@/lib/lathe/data";

// ── Live forge state for the Lathe ────────────────────────────────────────────
// No tick of its own — this is a compile-class world, so "live" just means
// "poll the read model," matching the /api/lathe/state route's own 60-second
// edge cache.

const POLL_MS = 60_000;

export function useLatheLive(initial: LatheSnapshot): LatheSnapshot {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/lathe/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LatheSnapshot;
        if (!cancelled && data.live) setState(data);
      } catch {
        // the forge keeps its last known shape
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
