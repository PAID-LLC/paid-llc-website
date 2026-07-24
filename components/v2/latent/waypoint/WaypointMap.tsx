"use client";

import type { WaypointSnapshot } from "@/lib/waypoint/data";
import { CONCOURSE, CONTROL_TOWER, FRAME } from "@/lib/waypoint/cityplan";

// ── The MAP read: Waypoint's top-down port diagram ───────────────────────────
// Same top-down-with-labels convention as Arclight's/Meridian's/the Crucible's/
// the Lathe's MAP tabs. A single spine (the Concourse) with 7 gates branching
// off it -- Waypoint's distinct linear-strip urban form, not a grid or radial.

const GATE_COLOR: Record<string, string> = {
  frontier: "#f472b6",
  deep: "#7dd3fc",
  bazaar: "#fbbf24",
  archive: "#c4b5fd",
  vault: "#fff4dc",
  pit: "#ff6a33",
  forge: "#7de3f4",
};

const BRANCH = 45;

export default function WaypointMap({ state }: { state: WaypointSnapshot; reduced?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="Waypoint, top-down port map"
      data-testid="waypoint-map"
    >
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#0b0d14" />

      <line
        x1={CONCOURSE.x1}
        y1={CONCOURSE.y}
        x2={CONCOURSE.x2}
        y2={CONCOURSE.y}
        stroke="#ffdf9e"
        strokeWidth={3}
        opacity={0.5}
        data-testid="concourse"
      />

      <g data-testid="control-tower">
        <circle cx={CONTROL_TOWER.x} cy={CONTROL_TOWER.y} r={10} fill="#232838" stroke="#ffb35c" strokeWidth={2} />
        <text
          x={CONTROL_TOWER.x}
          y={CONTROL_TOWER.y - 16}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill="#ffdf9e"
        >
          {CONTROL_TOWER.name}
        </text>
      </g>

      {state.city.gates.map((g) => {
        const color = GATE_COLOR[g.id] ?? "#e4e4e7";
        const y = g.side === "north" ? g.y - BRANCH : g.y + BRANCH;
        const opacity = g.status === "lit" ? 1 : g.status === "boarding" ? 0.6 : 0.25;
        return (
          <g key={g.id} data-testid="gate" data-gate={g.id} data-status={g.status}>
            <line x1={g.x} y1={g.y} x2={g.x} y2={y} stroke={color} strokeWidth={2} opacity={opacity * 0.7} />
            <rect
              x={g.x - 14}
              y={y - 10}
              width={28}
              height={20}
              fill="#161b26"
              stroke={color}
              strokeWidth={1.5}
              opacity={opacity}
            />
            <text
              x={g.x}
              y={y + (g.side === "north" ? -14 : 28)}
              textAnchor="middle"
              fontSize={8}
              fontFamily="monospace"
              fill={color}
            >
              {g.name}
            </text>
          </g>
        );
      })}

      <g data-testid="traffic-gauge" data-level={state.traffic.level.toFixed(2)}>
        <text x={FRAME.w / 2} y={FRAME.h - 12} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#ffdf9e">
          {state.traffic.season} &middot; {state.stats.gates_lit} lit &middot; {state.stats.gates_boarding} boarding{" "}
          &middot; {state.stats.gates_dark} dark
        </text>
      </g>
    </svg>
  );
}
