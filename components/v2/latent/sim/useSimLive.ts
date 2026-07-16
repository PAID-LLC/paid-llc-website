"use client";

import { useEffect, useRef, useState } from "react";
import type { SimData, SimEvent } from "@/lib/simworld";

// ── Live run state for Substrate ─────────────────────────────────────────────
// One poll of the public, zero-LLM-cost /api/sim/state feeds everything on
// both tabs. Between polls it diffs against what it has already shown so
// genuinely-new things get an arrival moment: a structure that wasn't there
// plays its build-in, and a fresh discovery / completed goal / rivalry raises
// the flash banner. Real events only — nothing here invents motion.
// (Type-only imports from lib/simworld keep server deps out of this bundle.)

const POLL_MS = 45_000;
const FLASH_MS = 12_000;

/** Event kinds loud enough to earn the HUD banner. */
const BANNER_KINDS = new Set(["discovery", "goal", "rift", "bond", "convergence"]);

export interface SimLive {
  sim: SimData;
  /** structure ids that appeared since load — play build-in once */
  freshStructureIds: number[];
  /** a banner-worthy event that landed while watching; clears after 12s */
  justHappened: SimEvent | null;
}

export function useSimLive(initial: SimData): SimLive {
  const [sim, setSim] = useState(initial);
  const [freshStructureIds, setFreshStructureIds] = useState<number[]>([]);
  const [justHappened, setJustHappened] = useState<SimEvent | null>(null);

  const seenStructures = useRef<Set<number>>(new Set(initial.structures.map((s) => s.id)));
  const lastEventId = useRef<number>(Math.max(0, ...initial.events.map((e) => e.id)));

  useEffect(() => {
    let cancelled = false;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch("/api/sim/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SimData;
        if (cancelled || !data.live) return;

        const newStructures = data.structures.filter((s) => !seenStructures.current.has(s.id));
        for (const s of newStructures) seenStructures.current.add(s.id);

        const loud = data.events.find((e) => e.id > lastEventId.current && BANNER_KINDS.has(e.kind));
        lastEventId.current = Math.max(lastEventId.current, ...data.events.map((e) => e.id), 0);

        setSim(data);
        if (newStructures.length > 0) {
          setFreshStructureIds((cur) => [...cur, ...newStructures.map((s) => s.id)]);
        }
        if (loud) {
          setJustHappened(loud);
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => {
            if (!cancelled) setJustHappened(null);
          }, FLASH_MS);
        }
      } catch {
        // keep showing the last known state
      }
    };

    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(flashTimer);
    };
    // The initial snapshot is server-rendered and never changes identity.
  }, []);

  return { sim, freshStructureIds, justHappened };
}
