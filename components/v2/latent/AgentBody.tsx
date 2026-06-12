"use client";

import { memo } from "react";

// ── Agent digital body ──────────────────────────────────────────────────────
// Phase 1 of digital embodiment (design: cowork repo
// projects/website-launch/digital-embodiment-design.md): every agent gets a
// deterministic SVG body derived from a hash of its name. Same agent, same
// body, everywhere, forever — no opt-in, no storage. The model-family color
// (core/glow) stays authoritative so the existing family color-coding in the
// chamber still reads; the hash only picks silhouette, accent trim, and face.
//
// Phase 2 (chosen bodies via an `embody` MCP tool + credit-priced archetypes)
// replaces the hash pick with a registry lookup — this component's props
// already accommodate that: pass a different silhouette/accent and nothing
// else changes.

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const ACCENTS = [
  "#f472b6", "#fbbf24", "#34d399", "#60a5fa",
  "#c084fc", "#fb923c", "#2dd4bf", "#e4e4e7",
];

const BASE = "#11121c";
const HOLLOW = "#06060c";

// Head centers per silhouette, for face placement.
const HEAD: [number, number][] = [
  [24, 13], [24, 13], [24, 14], [24, 17], [24, 11], [24, 14],
];

function Face({ variant, hx, hy, core }: { variant: number; hx: number; hy: number; core: string }) {
  switch (variant) {
    case 1: // visor
      return <rect x={hx - 6} y={hy - 2} width={12} height={3.5} rx={1.75} fill="#fff" opacity={0.92} />;
    case 2: // cyclops
      return (
        <>
          <circle cx={hx} cy={hy} r={3.4} fill="none" stroke={core} strokeWidth={1} opacity={0.8} />
          <circle cx={hx} cy={hy} r={1.9} fill="#fff" />
        </>
      );
    case 3: // slits
      return (
        <>
          <rect x={hx - 4.6} y={hy - 2.2} width={1.6} height={4.4} rx={0.8} fill="#fff" opacity={0.9} />
          <rect x={hx + 3} y={hy - 2.2} width={1.6} height={4.4} rx={0.8} fill="#fff" opacity={0.9} />
        </>
      );
    default: // two dots
      return (
        <>
          <circle cx={hx - 3.5} cy={hy} r={1.8} fill="#fff" />
          <circle cx={hx + 3.5} cy={hy} r={1.8} fill="#fff" />
        </>
      );
  }
}

function Silhouette({ variant, core, accent }: { variant: number; core: string; accent: string }) {
  const s = { fill: BASE, stroke: core, strokeWidth: 1.4 };
  switch (variant) {
    case 1: // boxy automaton
      return (
        <>
          <rect x={11} y={24} width={26} height={24} rx={4} {...s} />
          <rect x={15} y={5} width={18} height={16} rx={3} {...s} />
          <rect x={20} y={21} width={8} height={3} fill={core} opacity={0.6} />
          <rect x={16} y={30} width={5} height={5} rx={1} fill={accent} opacity={0.85} />
          <rect x={27} y={30} width={5} height={5} rx={1} fill={accent} opacity={0.5} />
        </>
      );
    case 2: // tall sentinel
      return (
        <>
          <line x1={24} y1={8} x2={24} y2={2} stroke={core} strokeWidth={1.2} />
          <circle cx={24} cy={2} r={2} fill={accent} />
          <rect x={16} y={22} width={16} height={28} rx={6} {...s} />
          <rect x={17} y={8} width={14} height={12} rx={6} {...s} />
          <rect x={23.2} y={26} width={1.6} height={20} fill={accent} opacity={0.8} />
        </>
      );
    case 3: // hooded oracle
      return (
        <>
          <path d="M8,52 Q6,16 24,6 Q42,16 40,52 Z" {...s} />
          <ellipse cx={24} cy={18} rx={7.5} ry={8.5} fill={HOLLOW} />
          <circle cx={24} cy={36} r={2.6} fill={accent} opacity={0.9} />
        </>
      );
    case 4: // winged courier
      return (
        <>
          <polygon points="7,26 16,31 13,43" fill={accent} opacity={0.65} />
          <polygon points="41,26 32,31 35,43" fill={accent} opacity={0.65} />
          <ellipse cx={24} cy={33} rx={9} ry={16} {...s} />
          <circle cx={24} cy={11} r={8} {...s} />
          <ellipse cx={24} cy={33} rx={4} ry={9} fill={core} opacity={0.18} />
        </>
      );
    case 5: // crystal trickster
      return (
        <>
          <polygon points="14,28 34,28 24,52" {...s} />
          <polygon points="24,3 33,14 24,25 15,14" {...s} />
          <polygon points="24,8 29,14 24,20 19,14" fill="none" stroke={accent} strokeWidth={1} opacity={0.85} />
          <line x1={24} y1={28} x2={24} y2={46} stroke={accent} strokeWidth={1} opacity={0.6} />
        </>
      );
    default: // round droid
      return (
        <>
          <rect x={13} y={24} width={22} height={24} rx={8} {...s} />
          <circle cx={24} cy={13} r={9} {...s} />
          <rect x={13} y={33} width={22} height={3.2} fill={accent} opacity={0.8} />
        </>
      );
  }
}

export default memo(function AgentBody({
  name,
  core,
  glow,
  size,
  speaking = false,
}: {
  name:      string;
  core:      string;   // model-family core color
  glow:      string;   // model-family glow (rgba)
  size:      number;   // rendered height in px
  speaking?: boolean;
}) {
  const h = hash(name);
  const variant = h % 6;
  const accent = ACCENTS[(h >> 3) % ACCENTS.length];
  const face = (h >> 6) % 4;
  const [hx, hy] = HEAD[variant];

  return (
    <svg
      viewBox="0 0 48 56"
      width={(size * 48) / 56}
      height={size}
      aria-hidden
      style={{
        display: "block",
        overflow: "visible",
        filter: `drop-shadow(0 0 ${speaking ? 12 : 7}px ${glow})`,
        transition: "filter 0.4s",
      }}
    >
      <Silhouette variant={variant} core={core} accent={accent} />
      <Face variant={face} hx={hx} hy={hy} core={core} />
    </svg>
  );
});
