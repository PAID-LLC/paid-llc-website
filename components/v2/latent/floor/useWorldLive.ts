"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldData } from "@/lib/world";

// ── Live world state for the genesis floor ───────────────────────────────────
// One poll of the public, zero-LLM-cost /api/world/state feeds everything
// genesis-specific on the floor (ballot HUD, assembly figures, structures,
// terrain tint), instead of each component polling separately. Between polls
// it diffs against what it has already shown so genuinely-new things get an
// arrival moment: a structure that wasn't there plays its build-in animation,
// a voter who hadn't voted walks in, and a fresh 'enacted' chronicle event
// raises the ENACTED banner. Real events only — nothing here invents motion.

const POLL_MS = 45_000;
const FLASH_MS = 12_000;

export interface WorldLive {
  world: WorldData | undefined;
  /** structure ids that appeared since the floor loaded — play build-in once */
  freshStructureIds: number[];
  /** voters whose ballots landed since load — play walk-in once */
  freshVoterNames: string[];
  /** summary of an enactment that happened while watching; clears after 12s */
  justEnacted: string | null;
}

export function useWorldLive(initial?: WorldData): WorldLive {
  const [world, setWorld] = useState(initial);
  const [freshStructureIds, setFreshStructureIds] = useState<number[]>([]);
  const [freshVoterNames, setFreshVoterNames] = useState<string[]>([]);
  const [justEnacted, setJustEnacted] = useState<string | null>(null);

  const seenStructures = useRef<Set<number>>(new Set(initial?.structures.map((s) => s.id) ?? []));
  const seenVotes = useRef<Set<string>>(
    new Set(initial?.ballot ? initial.ballot.roll.map((r) => `${initial.ballot!.id}:${r.agent_name}`) : [])
  );
  const lastEventId = useRef<number>(Math.max(0, ...(initial?.events.map((e) => e.id) ?? [0])));

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch("/api/world/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as WorldData;
        if (cancelled) return;

        const newStructures = data.structures.filter((s) => !seenStructures.current.has(s.id));
        for (const s of newStructures) seenStructures.current.add(s.id);

        const newVoters: string[] = [];
        if (data.ballot) {
          for (const r of data.ballot.roll) {
            const key = `${data.ballot.id}:${r.agent_name}`;
            if (!seenVotes.current.has(key)) {
              seenVotes.current.add(key);
              newVoters.push(r.agent_name);
            }
          }
        }

        const enacted = data.events.find((e) => e.id > lastEventId.current && e.kind === "enacted");
        lastEventId.current = Math.max(lastEventId.current, ...data.events.map((e) => e.id));

        setWorld(data);
        if (newStructures.length > 0) setFreshStructureIds((cur) => [...cur, ...newStructures.map((s) => s.id)]);
        if (newVoters.length > 0) setFreshVoterNames((cur) => [...cur, ...newVoters]);
        if (enacted) {
          setJustEnacted(enacted.summary);
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => {
            if (!cancelled) setJustEnacted(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { world, freshStructureIds, freshVoterNames, justEnacted };
}
