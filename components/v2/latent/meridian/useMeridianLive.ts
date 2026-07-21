"use client";

import { useEffect, useState } from "react";
import type { MeridianData } from "@/lib/meridian/engine";

// ── Live market state for Meridian ───────────────────────────────────────────
// One poll of /api/meridian/state per tick cadence. The city only moves at
// the speed of the real economy, so there is no reason to poll faster than
// the cron that drives it.

const POLL_MS = 90_000;

export function useMeridianLive(initial: MeridianData): MeridianData {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/meridian/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MeridianData;
        if (!cancelled && data.live) setState(data);
      } catch {
        // the city keeps its last known shape
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // The initial snapshot is server-rendered and never changes identity.
  }, []);

  return state;
}
