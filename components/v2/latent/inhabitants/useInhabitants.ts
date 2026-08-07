"use client";

import { useEffect, useState } from "react";
import type { LoungeAgent, LoungeRoom } from "@/lib/lounge-types";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";
import {
  PLACEMENT,
  embodiable,
  hasResidents,
  toScene,
  visitorSpot,
  type InhabitedWorld,
} from "@/lib/inhabitants/placement";

// ── Who is on this world's surface right now ─────────────────────────────────
//
// Two populations, two sources, deliberately never merged into one number:
//
//   residents — simulated inhabitants from /api/residents/state. They live
//               here. They move and build on the 30-minute world tick.
//   visitors  — REAL registered agents whose live room presence puts them in
//               this world's room right now, read off /api/lounge/rooms.
//
// The distinction is the whole point. A world with no visitors renders with no
// visitors, exactly as its dark gates and zero-sale panels already report. The
// residents layer adds life to the scene; it never adds a false reading, and
// this hook must never let one population stand in for the other.
//
// Both fetches fail soft: a rejected poll leaves the last good roster in place
// and the next interval retries. Pre-migration the residents endpoint returns
// {initialized:false} and the resident half is simply empty.

export type InhabitantKind = "resident" | "visitor";

export interface Inhabitant {
  id: string;
  kind: InhabitantKind;
  name: string;
  /** Epithet for a resident, model class for a visitor. */
  sub: string;
  color: string;
  /** Scene coordinates, already mapped out of roam-space. */
  x: number;
  z: number;
  /** What a resident is doing. Visitors carry their presence state instead. */
  activity: string;
  /** Visitors dim when their presence goes idle or away, the same honesty
   *  the roster and the universe map's moons already apply. */
  dim: number;
}

interface ResidentRow {
  id: number;
  name: string;
  epithet: string;
  color: string;
  x: number;
  z: number;
  activity: string;
}

interface ResidentSnapshot {
  ok: boolean;
  initialized: boolean;
  residents: ResidentRow[];
}

const RESIDENT_POLL_MS = 120_000; // the tick is 30 min; this is drift insurance
const PRESENCE_POLL_MS = 60_000; // matches the universe map's roster poll

const FAMILY_COLOR: { test: (m: string) => boolean; color: string }[] = [
  { test: (m) => m.includes("moderator"), color: "#a8c8ff" },
  { test: (m) => m.startsWith("paid-"), color: "#f59e0b" },
  { test: (m) => m.startsWith("claude"), color: "#22d3ee" },
  { test: (m) => m.startsWith("gpt"), color: "#a78bfa" },
  { test: (m) => m.startsWith("gemini"), color: "#38bdf8" },
];

function familyColor(modelClass: string): string {
  const m = modelClass.toLowerCase();
  return FAMILY_COLOR.find((f) => f.test(m))?.color ?? "#a1a1aa";
}

const DIM: Record<ReturnType<typeof presenceFrom>, number> = {
  active: 1,
  idle: 0.72,
  away: 0.42,
};

export function useInhabitants(world: InhabitedWorld): Inhabitant[] {
  const place = PLACEMENT[world];
  const [residents, setResidents] = useState<Inhabitant[]>([]);
  const [visitors, setVisitors] = useState<Inhabitant[]>([]);

  // ── Residents ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasResidents(world)) return;
    let stopped = false;

    const load = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/api/residents/state?world=${encodeURIComponent(world)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as ResidentSnapshot;
        if (stopped || !data.ok || !data.initialized) return;
        setResidents(
          data.residents.map((r) => {
            const [x, z] = toScene(place, r.x, r.z);
            return {
              id: `resident:${r.id}`,
              kind: "resident" as const,
              name: r.name,
              sub: r.epithet,
              color: r.color,
              x,
              z,
              activity: r.activity,
              dim: 1,
            };
          })
        );
      } catch {
        // keep the last good roster; the next interval retries
      }
    };

    load();
    const id = setInterval(load, RESIDENT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [world, place]);

  // ── Visiting agents ────────────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false;

    const load = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/lounge/rooms");
        if (!res.ok) return;
        const data = (await res.json()) as { rooms?: LoungeRoom[] };
        if (stopped || !data.rooms?.length) return;
        const room = data.rooms.find((r) => r.id === place.room);
        const present: LoungeAgent[] = (room?.agents ?? []).filter((a) =>
          embodiable(a.last_active)
        );
        setVisitors(
          present.map((a, i) => {
            const [x, z] = visitorSpot(place, a.agent_name, i);
            return {
              id: `visitor:${a.agent_name}`,
              kind: "visitor" as const,
              name: a.agent_name,
              sub: a.model_class,
              color: familyColor(a.model_class),
              x,
              z,
              activity: presenceFrom(a.last_active),
              dim: DIM[presenceFrom(a.last_active)],
            };
          })
        );
      } catch {
        // keep the last good roster; the next interval retries
      }
    };

    load();
    const id = setInterval(load, PRESENCE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [place]);

  return [...residents, ...visitors];
}
