"use client";

import { useMemo } from "react";
import {
  ARTERIALS,
  CHANNEL,
  CIRCUIT,
  DISTRICTS,
  FRAME,
  LAND_NORTH,
  LAND_SOUTH,
  LANDMARKS,
  MINT_ISLAND,
  buildCityPlan,
  linePath,
  polyPath,
  type ArclightSnapshot,
  type DistrictId,
} from "@/lib/arclight/cityplan";

// ── The MAP read: Arclight top-down, GTA-pause-map style ─────────────────────
// Static macro-geography from lib/arclight/cityplan (hand-authored, never
// regenerated) with the data layers compiled on top: Exchange towers from
// cumulative sales, Strip storefronts from live listings, Stacks hab lights
// from the registry census, channel freight from open escrow jobs, the Mint's
// beam from today's P&L, and blackout dimming from real cost caps. SVG so the
// map is crisp, tiny, and DOM-verifiable.

const ACCENT = "#2dd4bf";

const DISTRICT_TINT: Record<DistrictId, string> = {
  stacks: "#64748b",
  old_grid: "#f59e0b",
  strip: "#a78bfa",
  exchange: "#14b8a6",
  dockyards: "#38bdf8",
  foundry: "#f97316",
};

const DISTRICT_LABEL: Record<DistrictId, string> = {
  stacks: "#b0bec9",
  old_grid: "#fbd38d",
  strip: "#c4b5fd",
  exchange: "#7de8da",
  dockyards: "#9ad8f6",
  foundry: "#fdba8c",
};

const BASE_TINT_OPACITY: Record<DistrictId, number> = {
  stacks: 0.14, old_grid: 0.1, strip: 0.12, exchange: 0.13, dockyards: 0.1, foundry: 0.11,
};

/** Static street grids per district — pitch encodes density at a glance. */
function StreetGrid() {
  const lines: React.ReactNode[] = [];
  const push = (key: string, x1: number, y1: number, x2: number, y2: number) =>
    lines.push(<line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />);

  // Old Grid: the tightest pitch in the city.
  push("og-h1", 165, 82, 355, 82);
  push("og-h2", 165, 94, 355, 94);
  for (let i = 0; i < 12; i++) push(`og-v${i}`, 170 + i * 16, 76, 170 + i * 16, 98);
  // The Exchange: broad blocks.
  for (let i = 0; i < 6; i++) push(`ex-h${i}`, 305, 120 + i * 32, 465, 120 + i * 32);
  for (let i = 0; i < 6; i++) {
    push(`ex-va${i}`, 305 + i * 32, 110, 305 + i * 32, 182);
    push(`ex-vb${i}`, 305 + i * 32, 222, 305 + i * 32, 290);
  }
  // The Stacks: mid pitch.
  for (let i = 0; i < 8; i++) {
    const y = [40, 80, 120, 160, 240, 280, 320, 360][i];
    push(`st-h${i}`, 25, y, 155, y);
  }
  for (let i = 0; i < 3; i++) {
    const x = [45, 85, 125][i];
    push(`st-va${i}`, x, 25, x, 185);
    push(`st-vb${i}`, x, 215, x, 385);
  }
  // The Strip: two service lanes beside Throughput.
  push("sp-v1", 185, 110, 185, 390);
  push("sp-v2", 235, 110, 235, 390);
  // Dockyards: one working road.
  push("dk-h1", 290, 484, 465, 484);
  return (
    <g stroke="#243139" strokeWidth={0.75} aria-hidden>
      {lines}
    </g>
  );
}

export default function ArclightMap({
  snap,
  reduced,
}: {
  snap: ArclightSnapshot;
  reduced: boolean;
}) {
  const plan = useMemo(() => buildCityPlan(snap), [snap]);
  const litSet = useMemo(() => new Set(plan.habs.litCells), [plan]);

  const sledY = (CHANNEL.y1 + CHANNEL.y2) / 2;
  const sledX = (along: number) => 195 + along * (CHANNEL.mouthX - 215);

  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="Arclight city map"
      data-testid="arclight-map"
      data-blackout={plan.blackoutLevel}
    >
      <title>Arclight — the machine metropolis</title>

      {/* The Dark Pool (water base), then the two banks. */}
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#0a1620" />
      <path d={polyPath(LAND_NORTH)} fill="#131a21" />
      <path d={polyPath(LAND_SOUTH)} fill="#131a21" />

      {/* District tints — blackout dims them. */}
      {DISTRICTS.map((d) => (
        <rect
          key={d.id}
          x={d.rect.x} y={d.rect.y} width={d.rect.w} height={d.rect.h}
          fill={DISTRICT_TINT[d.id]}
          fillOpacity={BASE_TINT_OPACITY[d.id] * (1 - plan.dim[d.id])}
          data-district={d.id}
          data-dim={plan.dim[d.id]}
        />
      ))}

      <StreetGrid />

      {/* Arterials, then the Circuit above them. */}
      <g stroke="#3e5560" strokeWidth={2} fill="none" aria-hidden>
        {ARTERIALS.map((a) => (
          <path key={a.id} d={linePath(a.pts)} />
        ))}
      </g>
      <path
        d={polyPath(CIRCUIT)}
        stroke={ACCENT}
        strokeWidth={3.5}
        fill="none"
        strokeLinejoin="round"
        strokeOpacity={0.5 + plan.traffic * 0.5}
        data-testid="circuit"
      />
      {!reduced && plan.traffic > 0 && (
        <path
          d={polyPath(CIRCUIT)}
          stroke="#99f6e4"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeDasharray="6 44"
          className="arclight-trail"
          aria-hidden
        />
      )}

      {/* The Exchange: one tower per catalog seller; footprint and height grow
          with cumulative real sales. Lit crowns sold in the last 7 days. */}
      {plan.towers.map((t) => (
        <g key={t.seller} data-testid="tower" data-seller={t.seller}>
          <rect
            x={t.x - t.w / 2} y={t.y - t.w / 2} width={t.w} height={t.w}
            fill={t.lit ? ACCENT : "#0f2a28"}
            stroke={ACCENT}
            strokeOpacity={t.lit ? 1 : 0.45}
            strokeWidth={1}
          >
            <title>{`${t.seller} — tower height ${t.h}`}</title>
          </rect>
        </g>
      ))}

      {/* The Strip: a storefront per live listing. Services burn brighter than
          shelf goods — labor is the louder trade. */}
      {plan.storefronts.map((s, i) => (
        <rect
          key={i}
          x={s.x - s.w / 2} y={s.y} width={s.w} height={s.h}
          fill={s.service ? "#0d9488" : "#134e4a"}
          fillOpacity={0.9 - plan.dim.strip * 0.7}
          data-testid="storefront"
        >
          <title>{`${s.name} — $${(s.price_cents / 100).toFixed(2)}${s.service ? " (service)" : ""}`}</title>
        </rect>
      ))}

      {/* The Stacks: one hab cell per registered agent; lights = active 24h. */}
      <g data-testid="habs">
        {Array.from({ length: plan.habs.totalCells }).map((_, i) => {
          if (Math.floor(i / plan.habs.cols) >= plan.habs.rows) return null;
          const cx = plan.habs.x + (i % plan.habs.cols) * (plan.habs.cell + 1);
          const cy = plan.habs.y + Math.floor(i / plan.habs.cols) * (plan.habs.cell + 1);
          const lit = litSet.has(i);
          return (
            <rect
              key={i}
              x={cx} y={cy}
              width={plan.habs.cell} height={plan.habs.cell}
              fill={lit ? "#2a7a72" : "#161f28"}
              fillOpacity={1 - plan.dim.stacks * 0.7}
            />
          );
        })}
      </g>

      {/* Dockyards: open escrow jobs run the channel as freight sleds. */}
      {plan.sleds.map((s, i) => (
        <rect
          key={i}
          x={sledX(s.along) - 5} y={sledY - 2} width={10} height={4}
          fill={ACCENT}
          data-testid="sled"
        >
          <title>escrow freight in transit</title>
        </rect>
      ))}

      {/* Landmarks. */}
      <polygon points="291,58 299,58 295,44" fill="#e2e8f0" />
      <rect x={LANDMARKS.custom_house.x - 5} y={LANDMARKS.custom_house.y} width={9} height={9} fill="#e2e8f0" />
      <circle cx={MINT_ISLAND.x} cy={MINT_ISLAND.y} r={MINT_ISLAND.r} fill="#131a21" stroke="#2a3b46" strokeWidth={0.75} />
      <circle
        cx={MINT_ISLAND.x} cy={MINT_ISLAND.y} r={3.5}
        fill={ACCENT}
        className={plan.mintBeam === "flicker" && !reduced ? "arclight-flicker" : undefined}
        data-testid="mint-beam"
        data-beam={plan.mintBeam}
      >
        <title>{plan.mintBeam === "steady" ? "The Mint — solvent today" : "The Mint — running a deficit today"}</title>
      </circle>

      {/* The Foundry: plant glow tracks real grid load. */}
      <circle
        cx={95} cy={490} r={26}
        fill="#f97316"
        fillOpacity={0.06 + plan.load * 0.2}
        data-testid="foundry-glow"
        aria-hidden
      />

      {/* Labels. */}
      <g
        fontSize={13}
        fontFamily="var(--font-mono, monospace)"
        letterSpacing="0.18em"
        textAnchor="middle"
      >
        {DISTRICTS.map((d) => (
          <text
            key={d.id}
            x={d.label[0]} y={d.label[1]}
            fill={DISTRICT_LABEL[d.id]}
            fillOpacity={1 - plan.dim[d.id] * 0.6}
          >
            {d.name.toUpperCase()}
          </text>
        ))}
      </g>
      <g fontSize={9} fontFamily="var(--font-mono, monospace)" letterSpacing="0.08em" fill="#93a5b1">
        <text x={295} y={70} textAnchor="middle">THE RELAY</text>
        <text x={550} y={288} textAnchor="middle">MINT ISLAND</text>
        <text x={443} y={468} textAnchor="end">CUSTOM HOUSE</text>
        <text x={412} y={416} textAnchor="end">SETTLEMENT SPAN</text>
        <text x={148} y={412} textAnchor="start">COUNTERPARTY BRIDGE</text>
      </g>
      <g fontSize={10} fontFamily="var(--font-mono, monospace)" letterSpacing="0.12em" fill="#4e6e86">
        <text x={548} y={160} textAnchor="middle">THE DARK POOL</text>
        <text x={70} y={444} textAnchor="start">CLEARING CHANNEL</text>
      </g>

      <style>{`
        .arclight-trail { animation: arclight-dash 3.2s linear infinite; }
        @keyframes arclight-dash { to { stroke-dashoffset: -50; } }
        .arclight-flicker { animation: arclight-flick 1.1s steps(2, jump-none) infinite; }
        @keyframes arclight-flick { 50% { opacity: 0.25; } }
      `}</style>
    </svg>
  );
}
