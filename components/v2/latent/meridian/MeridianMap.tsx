"use client";

import { useMemo } from "react";
import { WARDS, type MeridianData, type Ward } from "@/lib/meridian/engine";
import { RING_OUTER, WARD_ANGLE_DEG, WARD_INNER, WARD_OUTER, ringColor } from "@/lib/meridian/skyline";

// ── The MAP read: Meridian top-down radial diagram ───────────────────────────
// Same top-down-with-labels convention as Arclight's MAP tab. Six wards as
// wedges around the Agora, the Green Ring as the outer band (colored by the
// live prosperity index), citizens as color-coded dots. SVG: crisp, tiny,
// DOM-verifiable.

const FRAME = { w: 600, h: 600 };
const CX = FRAME.w / 2;
const CY = FRAME.h / 2;
// World units (RING_OUTER = 70) map to a comfortable inset of the 600x600 frame.
const PX_PER_UNIT = (FRAME.w * 0.4) / RING_OUTER;

const WARD_LABEL: Record<Ward, string> = {
  spire_row: "Spire Row",
  ledger_house: "The Ledger House",
  archive: "The Archive",
  atelier: "The Atelier",
  yards: "The Yards",
  commons: "The Commons",
};

/** World-unit polar coordinate -> SVG pixel coordinate. */
function polarSvg(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const r = radius * PX_PER_UNIT;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function wedgePath(innerR: number, outerR: number, angle: number, halfSpread: number): string {
  const a0 = angle - halfSpread, a1 = angle + halfSpread;
  const [ix0, iy0] = polarSvg(innerR, a0);
  const [ix1, iy1] = polarSvg(innerR, a1);
  const [ox0, oy0] = polarSvg(outerR, a0);
  const [ox1, oy1] = polarSvg(outerR, a1);
  const rOuterPx = outerR * PX_PER_UNIT;
  const rInnerPx = innerR * PX_PER_UNIT;
  return `M ${ix0} ${iy0} L ${ox0} ${oy0} A ${rOuterPx} ${rOuterPx} 0 0 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${rInnerPx} ${rInnerPx} 0 0 0 ${ix0} ${iy0} Z`;
}

const STAKE_COLOR = (stake: number) => (stake >= 65 ? "#22c55e" : stake >= 35 ? "#eab308" : "#ef4444");

export default function MeridianMap({ state }: { state: MeridianData; reduced?: boolean }) {
  const structureByWard = useMemo(
    () => new Map(state.structures.map((s) => [s.ward_kind, s])),
    [state.structures]
  );
  const ring = ringColor(state.clock.prosperityIndex);

  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="Meridian, top-down radial map"
      data-testid="meridian-map"
    >
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#fbf8ee" />

      {/* Green Ring: the outer band, colored by the live prosperity index. */}
      <circle cx={CX} cy={CY} r={RING_OUTER * PX_PER_UNIT} fill="none" stroke={ring} strokeWidth={26} opacity={0.55} data-testid="green-ring" />

      {WARDS.map((ward) => {
        const angle = WARD_ANGLE_DEG[ward];
        const structure = structureByWard.get(ward);
        const [lx, ly] = polarSvg((WARD_INNER + WARD_OUTER) / 2, angle);
        return (
          <g key={ward} data-testid="ward" data-ward={ward} data-level={structure?.level ?? 1}>
            <path d={wedgePath(WARD_INNER, WARD_OUTER, angle, 28)} fill="#e7e0c9" stroke="#c9bd9a" strokeWidth={1.2} opacity={0.7} />
            <text x={lx} y={ly} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#57503f">
              {WARD_LABEL[ward]}
            </text>
          </g>
        );
      })}

      {/* The Agora, center. */}
      <circle cx={CX} cy={CY} r={16} fill="#f2c879" stroke="#a3792f" strokeWidth={1.5} data-testid="agora" />
      <text x={CX} y={CY + 30} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#a3792f">
        the Agora
      </text>

      {state.citizens.map((c) => {
        const angle = WARD_ANGLE_DEG[c.ward];
        const [x, y] = polarSvg((WARD_INNER + WARD_OUTER) / 2, angle);
        return (
          <g key={c.name} data-testid="citizen" data-name={c.name} data-stake={c.stake.toFixed(0)}>
            <circle cx={x} cy={y - 14} r={5} fill={STAKE_COLOR(c.stake)} stroke="#00000022" />
            <text x={x} y={y - 20} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#57503f">
              {c.name}
            </text>
          </g>
        );
      })}

      <g data-testid="prosperity-gauge" data-index={state.clock.prosperityIndex.toFixed(0)} data-act={state.clock.act}>
        <text x={CX} y={FRAME.h - 16} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#57503f">
          prosperity {state.clock.prosperityIndex.toFixed(0)} &middot; {state.clock.act.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}
