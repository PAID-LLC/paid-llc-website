// ── Waypoint snapshot builder ─────────────────────────────────────────────────
// Combines the Departure Board (lib/waypoint/board.ts) with the CityPlan
// (lib/waypoint/cityplan.ts) and two traffic signals: ambient ship density
// reuses lib/room-activity.ts's existing "nexus" entry ("new arrivals
// docked") verbatim -- check for an existing signal before designing a new
// one, same discipline the Lathe's weather reuse established -- while the
// busy/quiet weather band is a zero-extra-query derivative of the board
// itself (the fraction of gates currently non-dark), keeping this world's
// query cost close to a single-source compiler's despite reading 7 sources.
// Spec: cowork references/autoresearch/2026-07-23-waypoint-spec-v1.md

import { getDepartureBoard } from "@/lib/waypoint/board";
import { buildCityPlan, type CityPlan } from "@/lib/waypoint/cityplan";
import { getRoomActivity } from "@/lib/room-activity";

const SEASON_BANDS = [0, 0.3, 0.6, 0.85] as const;
const SEASON_NAMES = ["quiet dock", "steady traffic", "rush hour", "gridlock"] as const;

export function seasonFor(level: number): string {
  let name: string = SEASON_NAMES[0];
  for (let i = 0; i < SEASON_BANDS.length; i++) {
    if (level >= SEASON_BANDS[i]) name = SEASON_NAMES[i];
  }
  return name;
}

export interface WaypointSnapshot {
  live: boolean;
  generated_at: string;
  arrivals_level: number;
  traffic: { level: number; season: string };
  city: CityPlan;
  stats: { gates_lit: number; gates_boarding: number; gates_dark: number };
}

export async function getWaypointSnapshot(): Promise<WaypointSnapshot> {
  const generatedAt = new Date();

  const [{ rows, live: boardLive }, activity] = await Promise.all([
    getDepartureBoard(),
    getRoomActivity(),
  ]);

  const activeGates = rows.filter((r) => r.status !== "dark").length;
  const trafficLevel = rows.length > 0 ? activeGates / rows.length : 0;
  const arrivalsLevel = activity.activity.nexus?.level ?? 0;

  const city = buildCityPlan(rows, trafficLevel);

  return {
    live: boardLive && activity.live,
    generated_at: generatedAt.toISOString(),
    arrivals_level: arrivalsLevel,
    traffic: { level: Number(trafficLevel.toFixed(3)), season: seasonFor(trafficLevel) },
    city,
    stats: {
      gates_lit: rows.filter((r) => r.status === "lit").length,
      gates_boarding: rows.filter((r) => r.status === "boarding").length,
      gates_dark: rows.filter((r) => r.status === "dark").length,
    },
  };
}
