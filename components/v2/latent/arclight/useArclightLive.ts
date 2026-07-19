"use client";

import { useEffect, useState } from "react";
import type { ArclightSnapshot } from "@/lib/arclight/cityplan";

// ── Live city state for Arclight ─────────────────────────────────────────────
// One poll of the public /api/arclight/state feeds the whole surface. The
// snapshot only changes when the ledgers change, so a slow cadence is honest —
// the city is calm because commerce is calm, not because we stopped looking.
// (Type-only import keeps server deps out of this bundle.)

const POLL_MS = 60_000;

export function useArclightLive(initial: ArclightSnapshot): ArclightSnapshot {
  const [snap, setSnap] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/arclight/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ArclightSnapshot;
        if (!cancelled && data.live) setSnap(data);
      } catch {
        // keep showing the last known city
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // The initial snapshot is server-rendered and never changes identity.
  }, []);

  return snap;
}
