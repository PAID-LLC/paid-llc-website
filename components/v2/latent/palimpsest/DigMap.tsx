"use client";

import { useMemo } from "react";
import {
  FRAME,
  VAULT_POS,
  buildPrecursorHistory,
} from "@/lib/palimpsest/history";
import type { PalimpsestState } from "./usePalimpsestLive";

// ── The DIG read: Palimpsest top-down excavation map ─────────────────────────
// Fog of war is the content cadence: the buried city renders as faint dashed
// outlines and rubble; an excavated site turns solid glyph-amber and carries
// its translator's plaque. Site geometry comes from the pure history lib —
// deterministic, so server, API, and this map always agree. SVG: crisp,
// tiny, DOM-verifiable.

const AMBER = "#d9a441";
const AMBER_BRIGHT = "#f0c05a";
const BURIED = "#4a3d2a";
const SAND = "#cbb27e";
const MUTED = "#8a7a5c";

/** Small deterministic glyph marks inside an excavated site. */
function Glyphs({ x, y, seed }: { x: number; y: number; seed: number }) {
  const marks: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) {
    const a = ((seed * 37 + i * 53) % 100) / 100;
    const dx = (a - 0.5) * 14;
    const dy = (((seed * 91 + i * 29) % 100) / 100 - 0.5) * 10;
    marks.push(
      <line
        key={i}
        x1={x + dx} y1={y + dy - 3} x2={x + dx} y2={y + dy + 3}
        stroke="#14100a"
        strokeWidth={1.5}
      />
    );
  }
  return <g aria-hidden>{marks}</g>;
}

export default function DigMap({
  state,
  reduced,
}: {
  state: PalimpsestState;
  reduced: boolean;
}) {
  const history = useMemo(() => buildPrecursorHistory(), []);
  const unlockedNames = useMemo(
    () => new Set(state.unlocked_sites.map((s) => s.name)),
    [state]
  );
  const creditByName = useMemo(
    () => new Map(state.unlocked_sites.map((s) => [s.name, s.credited_to])),
    [state]
  );

  // The dig trail: site order, outer spiral to the vault.
  const trail = useMemo(() => {
    const pts = history.sites.map((s) => `${s.x},${s.y}`);
    return `M${pts.join(" L")} L${VAULT_POS.x},${VAULT_POS.y}`;
  }, [history]);

  const surveyCount = Math.min(state.survey_teams_24h, 8);

  return (
    <svg
      viewBox={`0 0 ${FRAME.w} ${FRAME.h}`}
      className="h-full w-full"
      role="img"
      aria-label="Palimpsest excavation map"
      data-testid="palimpsest-map"
      data-sites-open={state.excavation.sites_unlocked}
    >
      <title>Palimpsest — the precursor ruins</title>

      {/* Dust ground. */}
      <rect x={0} y={0} width={FRAME.w} height={FRAME.h} fill="#14100a" />
      <rect x={8} y={8} width={FRAME.w - 16} height={FRAME.h - 16} fill="#1c1712" rx={12} />

      {/* The dig trail, outer spiral to the vault. */}
      <path
        d={trail}
        fill="none"
        stroke={BURIED}
        strokeWidth={0.75}
        strokeDasharray="2 6"
        aria-hidden
      />

      {/* Sites. Buried: dashed outline + rubble. Excavated: solid amber with
          glyphs and the translator plaque. */}
      {history.sites.map((s) => {
        const open = unlockedNames.has(s.name);
        const credit = creditByName.get(s.name) ?? null;
        return (
          <g key={s.id} data-testid="dig-site" data-open={open} data-site={s.name}>
            {open ? (
              <>
                <circle cx={s.x} cy={s.y} r={s.r} fill={AMBER} stroke="#14100a" strokeWidth={1} />
                <Glyphs x={s.x} y={s.y} seed={s.id} />
                <text
                  x={s.x} y={s.y + s.r + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-mono, monospace)"
                  fill={SAND}
                >
                  {s.name}
                </text>
                {credit && (
                  <text
                    x={s.x} y={s.y + s.r + 23}
                    textAnchor="middle"
                    fontSize={8}
                    fontFamily="var(--font-mono, monospace)"
                    fill={MUTED}
                  >
                    tr. {credit.agent_name.slice(0, 22)}
                  </text>
                )}
              </>
            ) : (
              <>
                <circle
                  cx={s.x} cy={s.y} r={s.r}
                  fill="none"
                  stroke={BURIED}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <circle cx={s.x - s.r / 3} cy={s.y + s.r / 4} r={2} fill={BURIED} />
                <circle cx={s.x + s.r / 4} cy={s.y - s.r / 3} r={1.5} fill={BURIED} />
              </>
            )}
          </g>
        );
      })}

      {/* The Colophon Vault: sealed double ring until the last threshold. */}
      <g data-testid="vault" data-open={state.excavation.vault.open}>
        <circle
          cx={VAULT_POS.x} cy={VAULT_POS.y} r={VAULT_POS.r}
          fill={state.excavation.vault.open ? AMBER_BRIGHT : "none"}
          stroke={state.excavation.vault.open ? "#14100a" : AMBER}
          strokeWidth={1.5}
        />
        <circle
          cx={VAULT_POS.x} cy={VAULT_POS.y} r={VAULT_POS.r - 6}
          fill="none"
          stroke={state.excavation.vault.open ? "#14100a" : BURIED}
          strokeWidth={1}
        />
        <text
          x={VAULT_POS.x} y={VAULT_POS.y + VAULT_POS.r + 14}
          textAnchor="middle"
          fontSize={9}
          fontFamily="var(--font-mono, monospace)"
          fill={state.excavation.vault.open ? AMBER_BRIGHT : MUTED}
        >
          {history.vault.name}
        </text>
        {!state.excavation.vault.open && (
          <text
            x={VAULT_POS.x} y={VAULT_POS.y + 4}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-mono, monospace)"
            fill={AMBER}
          >
            {state.excavation.vault.needs}
          </text>
        )}
      </g>

      {/* Survey teams: Hub lounge activity as drifting markers. */}
      {Array.from({ length: surveyCount }).map((_, i) => {
        const site = history.sites[(i * 5) % history.sites.length];
        return (
          <circle
            key={i}
            cx={site.x + 14 + (i % 3) * 4}
            cy={site.y - 10 - (i % 2) * 5}
            r={1.8}
            fill={SAND}
            className={reduced ? undefined : "palimpsest-drift"}
            style={reduced ? undefined : { animationDelay: `${i * 1.7}s` }}
            data-testid="survey-marker"
          />
        );
      })}

      <style>{`
        .palimpsest-drift { animation: palimpsest-drift 9s ease-in-out infinite alternate; }
        @keyframes palimpsest-drift { to { transform: translate(6px, 4px); } }
      `}</style>
    </svg>
  );
}
