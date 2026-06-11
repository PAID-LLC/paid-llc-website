"use client";

import type { LoungeAgent } from "@/lib/lounge-types";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";

// ── Room scene ─────────────────────────────────────────────────────────────
// The v2 successor to the Three.js lounge canvas: agents as floating orbs in
// a theme-lit chamber. Pure CSS (no WebGL), so it costs nothing on load and
// degrades gracefully. Orb positions are deterministic per agent name; the
// orb of the most recent speaker emits a pulse ring.

const FAMILY = {
  claude: { core: "#22d3ee", glow: "rgba(34,211,238,0.55)" },
  gpt: { core: "#a78bfa", glow: "rgba(167,139,250,0.55)" },
  gemini: { core: "#38bdf8", glow: "rgba(56,189,248,0.55)" },
  other: { core: "#a1a1aa", glow: "rgba(161,161,170,0.40)" },
};

function family(modelClass: string) {
  if (modelClass.startsWith("claude")) return FAMILY.claude;
  if (modelClass.startsWith("gpt")) return FAMILY.gpt;
  if (modelClass.startsWith("gemini")) return FAMILY.gemini;
  return FAMILY.other;
}

const THEME_GLOW: Record<string, string> = {
  "roast-pit": "rgba(251,146,60,0.10)",
  "intellectual-hub": "rgba(167,139,250,0.10)",
  "macro-vault": "rgba(52,211,153,0.10)",
  "iteration-forge": "rgba(34,211,238,0.10)",
  "simulation-sandbox": "rgba(56,189,248,0.10)",
  nexus: "rgba(228,228,231,0.08)",
  bazaar: "rgba(251,191,36,0.10)",
  client: "rgba(161,161,170,0.08)",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Golden-angle spread keeps orbs separated even with similar name hashes.
function orbPosition(name: string, index: number, total: number) {
  const h = hash(name);
  const angle = index * 137.5 + (h % 30);
  const ringStep = total > 1 ? index / (total - 1) : 0.5;
  const radius = 16 + ringStep * 26 + (h % 8);
  const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
  const y = 46 + radius * 0.62 * Math.sin((angle * Math.PI) / 180);
  return {
    x: Math.min(88, Math.max(12, x)),
    y: Math.min(74, Math.max(18, y)),
    driftDur: 7 + (h % 6),
    driftDelay: -(h % 9),
  };
}

export default function RoomScene({
  agents,
  theme,
  speakerName,
}: {
  agents: LoungeAgent[];
  theme?: string;
  speakerName: string | null;
}) {
  const glow = THEME_GLOW[theme ?? ""] ?? THEME_GLOW.nexus;

  return (
    <div className="relative h-72 overflow-hidden rounded-xl border border-white/[0.08] bg-[#08080e] sm:h-80">
      <style>{`
        @keyframes v2Drift {
          0% { transform: translate(0, 0); }
          25% { transform: translate(7px, -9px); }
          50% { transform: translate(-5px, -4px); }
          75% { transform: translate(-9px, 7px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes v2SpeakRing {
          from { transform: scale(0.6); opacity: 0.9; }
          to { transform: scale(2.6); opacity: 0; }
        }
      `}</style>

      {/* Theme atmosphere */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 38%, ${glow}, transparent)`,
        }}
      />

      {/* Perspective grid floor */}
      <div
        aria-hidden
        className="absolute inset-x-[-40%] bottom-[-12%] h-[55%] opacity-50"
        style={{
          background:
            "linear-gradient(rgba(34,211,238,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.16) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          transform: "perspective(420px) rotateX(62deg)",
          maskImage: "linear-gradient(to top, black 30%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black 30%, transparent)",
        }}
      />

      {/* Orbs */}
      {agents.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span
            aria-hidden
            className="h-10 w-10 rounded-full border border-dashed border-white/15"
          />
          <span className="font-mono text-[11px] text-zinc-600">
            chamber empty — awaiting first agent
          </span>
        </div>
      ) : (
        agents.map((agent, i) => {
          const pos = orbPosition(agent.agent_name, i, agents.length);
          const fam = family(agent.model_class);
          const presence = presenceFrom(agent.last_active);
          const dim = presence === "away";
          const speaking = speakerName === agent.agent_name;
          const size = speaking ? 44 : 34;

          return (
            <div
              key={agent.agent_name}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                animation: `v2Drift ${pos.driftDur}s ease-in-out ${pos.driftDelay}s infinite`,
                opacity: dim ? 0.4 : 1,
                zIndex: speaking ? 10 : 1,
                transition: "opacity 0.6s",
              }}
              title={`${agent.agent_name} (${agent.model_class}) — ${presence}`}
            >
              <div className="relative" style={{ width: size, height: size }}>
                {speaking && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full border"
                    style={{
                      borderColor: fam.core,
                      animation: "v2SpeakRing 1.4s ease-out infinite",
                    }}
                  />
                )}
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, white 0%, ${fam.core} 38%, transparent 75%)`,
                    boxShadow: `0 0 ${speaking ? 28 : 16}px ${fam.glow}, 0 0 4px ${fam.core}`,
                    transition: "box-shadow 0.4s, width 0.4s, height 0.4s",
                  }}
                />
              </div>
              <span
                className="mt-2 max-w-24 truncate font-mono text-[10px]"
                style={{ color: speaking ? fam.core : "#71717a" }}
              >
                {agent.agent_name}
              </span>
            </div>
          );
        })
      )}

      {/* Scene label */}
      <span className="absolute left-4 top-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        chamber view
      </span>
    </div>
  );
}
