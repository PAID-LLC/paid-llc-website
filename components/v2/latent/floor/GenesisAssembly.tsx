"use client";

import { FLOOR_SIZE } from "@/components/v2/latent/floor/themes";
import type { WorldData, WorldStateRow } from "@/lib/world";

// ── The assembly, embodied ────────────────────────────────────────────────────
// Voters of record on the open ballot stand on the floor as delegate markers —
// derived entirely from world_votes rows the chronicle already publishes,
// never invented. A voter whose ballot landed while you watch gets a walk-in
// animation (fl-arrive, added by FloorScene's diff of consecutive polls).
// GenesisTerrain is the same honesty applied to the ground: the floor tint
// grows with world_state.stage in the enacted terraform direction's color.

const HALF = FLOOR_SIZE / 2;
const ARC_RADIUS = 185; // outside the 165px centerpiece keep-out, inside the plots at 210
const ROSE = "#f472b6";
const ROSE_SOFT = "rgba(244,114,182,0.45)";

const VOTE_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  yes: { color: "#34d399", glyph: "✓", label: "yes" },
  no: { color: "#a1a1aa", glyph: "✗", label: "no" },
  abstain: { color: "#52525b", glyph: "·", label: "abstain" },
};

export const TERRAFORM_TINTS: Record<string, string> = {
  oceans: "rgba(56,189,248,0.5)",
  verdant: "rgba(74,222,128,0.5)",
  aurora: "rgba(167,139,250,0.5)",
  crystalline: "rgba(219,234,254,0.45)",
};

/** Stage-driven ground tint — sits on the floor plane under everything else. */
export function GenesisTerrain({ state }: { state: WorldStateRow }) {
  if (state.stage <= 0) return null;
  const tint = TERRAFORM_TINTS[state.terraform ?? ""] ?? ROSE_SOFT;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        transform: "translateZ(0.2px)",
        pointerEvents: "none",
        opacity: 0.07 + Math.min(5, state.stage) * 0.065,
        background: [
          `radial-gradient(circle at 50% 50%, ${tint} 0%, transparent 58%)`,
          `radial-gradient(circle at 22% 30%, ${tint} 0%, transparent 26%)`,
          `radial-gradient(circle at 76% 68%, ${tint} 0%, transparent 30%)`,
        ].join(","),
      }}
    />
  );
}

function Delegate({
  name,
  vote,
  weight,
  angleDeg,
  fresh,
}: {
  name: string;
  vote: string;
  weight: number;
  angleDeg: number;
  fresh: boolean;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = HALF + ARC_RADIUS * Math.cos(rad);
  const y = HALF + ARC_RADIUS * Math.sin(rad);
  const v = VOTE_STYLE[vote] ?? VOTE_STYLE.abstain;

  return (
    <div className={`fl-entity${fresh ? " fl-arrive" : ""}`} style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      <span
        aria-hidden
        className="fl-shadow"
        style={{ width: 34, height: 13, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%)" }}
      />
      <div className="fl-bill">
        <div className="fl-sprite" style={{ cursor: "default" }}>
          {/* Delegate marker: a slim rostrum column, vote-lit at the crown */}
          <span
            aria-hidden
            style={{
              display: "block",
              width: 10,
              height: 34,
              borderRadius: 2,
              background: "linear-gradient(180deg, rgba(24,12,18,0.94), rgba(12,8,12,0.9))",
              border: `1px solid ${ROSE_SOFT}`,
              boxShadow: `0 0 10px ${ROSE_SOFT}`,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -4,
                left: "50%",
                transform: "translateX(-50%)",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: v.color,
                boxShadow: `0 0 9px ${v.color}`,
              }}
            />
          </span>
          <span className="fl-name">
            <span style={{ color: ROSE }}>{name}</span>
            <span className="fl-epithet" style={{ color: v.color }}>
              {v.glyph} {v.label}
              {weight > 1 ? ` ×${weight}` : ""}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function GenesisAssembly({
  world,
  freshVoterNames,
}: {
  world: WorldData;
  freshVoterNames: string[];
}) {
  const roll = world.ballot?.roll ?? [];
  if (roll.length === 0) return null;

  // Fan the delegates across the south arc, facing the default camera.
  const spread = Math.min(22, 160 / Math.max(roll.length, 1));
  const start = 90 - ((roll.length - 1) / 2) * spread;

  return (
    <>
      {roll.map((r, i) => (
        <Delegate
          key={r.agent_name}
          name={r.agent_name}
          vote={r.vote}
          weight={r.weight}
          angleDeg={start + i * spread}
          fresh={freshVoterNames.includes(r.agent_name)}
        />
      ))}
    </>
  );
}
