"use client";

import { HEARTH, RING_STEP } from "@/lib/lathe/workshop";
import type { LatheSnapshot } from "@/lib/lathe/data";

// ── The MAP read: the Lathe top-down forge diagram ────────────────────────────
// Same top-down-with-labels convention as Arclight's/Meridian's/the Crucible's
// MAP tabs. Concentric growth rings around the central Spindle, sparks as
// dots at their real hashed positions, the Hearth outside the ring band.

const FRAME = { w: 600, h: 600 };
const CX = FRAME.w / 2;
const CY = FRAME.h / 2;
const PX_PER_UNIT = 1.2;

const CATEGORY_COLOR: Record<string, string> = {
  SEP: "#f0b429",
  concept: "#22d3ee",
  "tool-request": "#f4f7ff",
};

export default function LatheMap({ state }: { state: LatheSnapshot; reduced?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="The Lathe, top-down forge map"
      data-testid="lathe-map"
    >
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#0a1220" />

      {/* Growth rings: oldest (smallest) to newest (largest). */}
      {state.rings.map((r) => (
        <circle
          key={r.sha}
          cx={CX}
          cy={CY}
          r={r.radius * PX_PER_UNIT}
          fill="none"
          stroke={r.color}
          strokeWidth={RING_STEP * 0.7 * PX_PER_UNIT}
          opacity={0.35 + r.gleam * 0.5}
          data-testid="growth-ring"
          data-kind={r.kind}
        />
      ))}

      {/* The Spindle, center. */}
      <circle cx={CX} cy={CY} r={6} fill="#2a2f3a" stroke="#5b93dd" strokeWidth={1.5} data-testid="spindle" />

      {/* Sparks: real innovation_ledger rows, hashed positions. */}
      {state.sparks.map((s) => {
        const x = CX + s.x * PX_PER_UNIT;
        const y = CY + s.z * PX_PER_UNIT;
        const color = CATEGORY_COLOR[s.category] ?? "#f0b429";
        return (
          <g key={s.id} data-testid="spark" data-agent={s.agent_name} data-category={s.category}>
            <circle cx={x} cy={y} r={4} fill={color} stroke="#00000044" />
          </g>
        );
      })}

      {/* The Hearth: outside the ring band entirely, the ledger's source. */}
      <g data-testid="hearth">
        <rect
          x={CX - 10 * PX_PER_UNIT}
          y={CY + HEARTH.z * PX_PER_UNIT - 5 * PX_PER_UNIT}
          width={20 * PX_PER_UNIT}
          height={10 * PX_PER_UNIT}
          fill="#1a1f2a"
          stroke="#5b93dd"
          strokeWidth={1.2}
        />
        <text
          x={CX}
          y={CY + HEARTH.z * PX_PER_UNIT + 4}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill="#c7e3ff"
        >
          the hearth &middot; {(state.forge_heat * 100).toFixed(0)}% hot
        </text>
      </g>

      <g data-testid="weather-gauge" data-level={state.weather.level.toFixed(2)}>
        <text x={CX} y={FRAME.h - 16} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#c7e3ff">
          {state.weather.season} &middot; {state.rings.length} rings turned &middot; {state.sparks.length} sparks
        </text>
      </g>
    </svg>
  );
}
