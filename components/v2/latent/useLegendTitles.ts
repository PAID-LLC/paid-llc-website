"use client";

import { useEffect, useState } from "react";

// ── Earned titles, in-world ──────────────────────────────────────────────────
// One cached fetch of a world's legends endpoint (s-maxage=300 at the edge)
// mapped to name → earned titles, so HUDs and canvas labels can show what the
// record remembers without adding a single query to the state-poll hot path.
// Titles change at most once per tick; a mount-time snapshot is plenty.

export function useLegendTitles(url: string): Map<string, string[]> {
  const [titles, setTitles] = useState<Map<string, string[]>>(() => new Map());

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { figures?: { name: string; titles?: string[] }[] } | null) => {
        if (!alive || !d?.figures) return;
        const next = new Map<string, string[]>();
        for (const f of d.figures) {
          if (f.titles && f.titles.length > 0) next.set(f.name, f.titles);
        }
        setTitles(next);
      })
      .catch(() => {}); // titles are garnish — a failed fetch just shows none
    return () => {
      alive = false;
    };
  }, [url]);

  return titles;
}
