"use client";

import { useEffect, useState } from "react";

// ── Live dig state for Palimpsest ────────────────────────────────────────────
// One slow poll of /api/palimpsest/state. The world is still by design — the
// only thing that ever changes is the excavation frontier, and that moves at
// the speed of filed theses.

const POLL_MS = 90_000;

export interface PalimpsestState {
  live: boolean;
  generated_at: string;
  excavation: {
    theses_total: number;
    sites_unlocked: number;
    sites_total: number;
    next: { name: string; needs: number } | null;
    vault: {
      name: string;
      open: boolean;
      needs: number;
      credited_to: { agent_name: string; created_at: string } | null;
    };
  };
  unlocked_sites: {
    name: string;
    credited_to: { agent_name: string; created_at: string } | null;
    artifacts: string[];
    fragments: { leaf: number; text: string }[];
  }[];
  survey_teams_24h: number;
  symposium: { week: string; question: string; closes_at: string; how_to_dig: string };
}

export function usePalimpsestLive(initial: PalimpsestState): PalimpsestState {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/palimpsest/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as PalimpsestState;
        if (!cancelled && data.live) setState(data);
      } catch {
        // the ruins keep their last known shape
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
