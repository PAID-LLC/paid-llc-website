"use client";

import { ARENA_FLOOR_RADIUS, PLINTH_SLOTS, RING_INNER, RING_OUTER, STOCKS, plinthSlots } from "@/lib/crucible/colosseum";
import type { CrucibleSnapshot } from "@/lib/crucible/data";

// ── The MAP read: Crucible top-down colosseum diagram ────────────────────────
// Same top-down-with-labels convention as Arclight's/Meridian's MAP tabs. A
// circular Champion Ring around the central Arena Floor, plinth dots only
// where a champion currently holds one, the Stocks pit outside the ring.

const FRAME = { w: 600, h: 600 };
const CX = FRAME.w / 2;
const CY = FRAME.h / 2;
const PX_PER_UNIT = 1.2;

function polarSvg(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const r = radius * PX_PER_UNIT;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

const DECAY_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: "#ffb35c",
  1: "#f0854a",
  2: "#c85a35",
  3: "#7c2d12",
};

export default function CrucibleMap({ state }: { state: CrucibleSnapshot; reduced?: boolean }) {
  const slots = plinthSlots();
  const championBySlot = new Map(
    state.champions.filter((c) => c.plinth_index !== null).map((c) => [c.plinth_index as number, c])
  );

  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="The Crucible, top-down colosseum map"
      data-testid="crucible-map"
    >
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#150a07" />

      {/* Champion Ring: the annulus between RING_INNER and RING_OUTER. */}
      <circle
        cx={CX}
        cy={CY}
        r={((RING_INNER + RING_OUTER) / 2) * PX_PER_UNIT}
        fill="none"
        stroke="#3a241a"
        strokeWidth={(RING_OUTER - RING_INNER) * PX_PER_UNIT}
        opacity={0.6}
        data-testid="champion-ring"
      />

      {/* Arena Floor, center. */}
      <circle
        cx={CX}
        cy={CY}
        r={ARENA_FLOOR_RADIUS * PX_PER_UNIT}
        fill="#3a241a"
        stroke="#5c3a28"
        strokeWidth={1.5}
        data-testid="arena-floor"
      />
      {state.active_duel ? (
        <>
          <circle cx={CX - 20} cy={CY} r={6} fill="#5cc9ff" />
          <circle cx={CX + 20} cy={CY} r={6} fill="#ff6b35" />
        </>
      ) : (
        <circle cx={CX} cy={CY} r={5} fill="#ff6b35" opacity={0.6} />
      )}

      {/* Plinths: 24 fixed slots, only occupied ones get a statue marker. */}
      {slots.map((slot) => {
        const [x, y] = polarSvg((RING_INNER + RING_OUTER) / 2, slot.angle);
        const champion = championBySlot.get(slot.index);
        if (!champion) {
          return <circle key={slot.index} cx={x} cy={y} r={2} fill="#3a241a" data-testid="plinth" data-occupied="false" />;
        }
        const color = DECAY_COLOR[champion.decay_stage as 0 | 1 | 2 | 3];
        return (
          <g key={slot.index} data-testid="champion" data-name={champion.agent_name} data-decay-stage={champion.decay_stage}>
            <circle cx={x} cy={y} r={5 + champion.win_streak * 0.4} fill={color} stroke="#00000044" />
            <text x={x} y={y - 10} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#ffcda0">
              {champion.agent_name}
            </text>
          </g>
        );
      })}

      {/* The Stocks: outside the ring entirely, a different data source. */}
      <g data-testid="stocks">
        <rect
          x={CX - (STOCKS.w * PX_PER_UNIT) / 2}
          y={CY + STOCKS.z * PX_PER_UNIT - (STOCKS.d * PX_PER_UNIT) / 2}
          width={STOCKS.w * PX_PER_UNIT}
          height={STOCKS.d * PX_PER_UNIT}
          fill="#241410"
          stroke="#3a241a"
          strokeWidth={1.2}
        />
        <text
          x={CX}
          y={CY + STOCKS.z * PX_PER_UNIT + 4}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill="#ffcda0"
        >
          the stocks{state.gauntlet?.open_count ? ` · ${state.gauntlet.open_count} open` : ""}
        </text>
      </g>

      <g data-testid="heat-gauge" data-heat={state.heat.toFixed(2)}>
        <text x={CX} y={FRAME.h - 16} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="#ffcda0">
          heat {(state.heat * 100).toFixed(0)}% &middot; {state.champions.length}/{PLINTH_SLOTS} statues standing
        </text>
      </g>
    </svg>
  );
}
