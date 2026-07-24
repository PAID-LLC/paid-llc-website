// ── Waypoint: the linear port strip (room 6, The Nexus) ─────────────────────
// Third city-class world (after Arclight's bay-grid, Meridian's radial garden
// city), with its own distinct urban form per the portfolio plan's City Plan
// design system: a single spine (the Concourse) with 7 gates branching off
// it, one per already-shipped world. Fixed macro-geography, pure function --
// same contract as lib/arclight/cityplan.ts: compiles identically on the
// server, in the MAP view, and in the 3D scene.
// Spec: cowork references/autoresearch/2026-07-23-waypoint-spec-v1.md

import type { DepartureRow, GateId } from "@/lib/waypoint/board";

export const WAYPOINT_SEED = 0x00016a06;

export const FRAME = { w: 640, h: 260 } as const;

/** The Concourse: one signature high-capacity spine, like Arclight's Circuit
 *  or Meridian's spokes -- here a straight runway axis, not a loop or a ring. */
export const CONCOURSE = { x1: 50, x2: 590, y: 130 } as const;

export const CONTROL_TOWER = { x: 50, y: 130, name: "Control Tower" } as const;

export interface GateGeo {
  id: GateId;
  /** Position along the Concourse, evenly spaced. */
  x: number;
  y: number;
  side: "north" | "south";
}

/** Fixed order and position -- never regenerate. Visitors learn this strip
 *  like a real place; only each gate's lit/dark state and headline change. */
export const GATES: GateGeo[] = [
  { id: "frontier", x: 130, y: CONCOURSE.y, side: "north" },
  { id: "deep", x: 210, y: CONCOURSE.y, side: "south" },
  { id: "bazaar", x: 290, y: CONCOURSE.y, side: "north" },
  { id: "archive", x: 370, y: CONCOURSE.y, side: "south" },
  { id: "vault", x: 450, y: CONCOURSE.y, side: "north" },
  { id: "pit", x: 510, y: CONCOURSE.y, side: "south" },
  { id: "forge", x: 570, y: CONCOURSE.y, side: "north" },
];

export interface GateStructure extends GateGeo {
  name: string;
  world: string;
  room: string;
  headline: string;
  at: string | null;
  hours_since: number | null;
  heat: number;
  status: DepartureRow["status"];
}

export interface CityPlan {
  gates: GateStructure[];
  /** 0..1, cross-world event volume -- the "how busy is the crossroads" read. */
  traffic: number;
}

export function buildCityPlan(rows: DepartureRow[], traffic: number): CityPlan {
  const byGate = new Map(rows.map((r) => [r.gate, r]));
  const gates: GateStructure[] = GATES.map((geo) => {
    const row = byGate.get(geo.id);
    return {
      ...geo,
      name: row?.name ?? geo.id,
      world: row?.world ?? geo.id,
      room: row?.room ?? geo.id,
      headline: row?.headline ?? "No traffic recorded yet.",
      at: row?.at ?? null,
      hours_since: row?.hours_since ?? null,
      heat: row?.heat ?? 0,
      status: row?.status ?? "dark",
    };
  });

  return { gates, traffic: Number(Math.max(0, Math.min(1, traffic)).toFixed(3)) };
}

/** SVG path d for an open polyline -- same helper shape as Arclight's linePath. */
export function linePath(pts: readonly [number, number][]): string {
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}
