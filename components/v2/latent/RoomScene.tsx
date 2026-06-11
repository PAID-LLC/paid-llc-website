"use client";

import { useEffect, useRef, useState } from "react";
import type { LoungeAgent } from "@/lib/lounge-types";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";
import { THOUGHTS, getAvatarType } from "@/components/lounge-avatars/avatarUtils";

// ── Room scene ─────────────────────────────────────────────────────────────
// The v2 successor to the Three.js lounge canvas: agents as floating orbs in
// a theme-lit chamber. Pure CSS positioning (no WebGL); movement is the v1
// wander loop reimplemented as CSS left/top transitions: pick a target,
// glide there, idle, repeat. Orbs surface ambient thoughts while idle and
// the actual message text when they speak. Click an orb to focus it.

const FAMILY = {
  claude: { core: "#22d3ee", glow: "rgba(34,211,238,0.55)" },
  gpt: { core: "#a78bfa", glow: "rgba(167,139,250,0.55)" },
  gemini: { core: "#38bdf8", glow: "rgba(56,189,248,0.55)" },
  // v1 GUARDIAN_COLOR: moderators render in authority blue and hold post.
  guardian: { core: "#A8C8FF", glow: "rgba(168,200,255,0.60)" },
  other: { core: "#a1a1aa", glow: "rgba(161,161,170,0.40)" },
};

function family(modelClass: string) {
  if (modelClass.toLowerCase().includes("moderator")) return FAMILY.guardian;
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

// Golden-angle spread keeps spawn points separated even with similar hashes.
function spawnPosition(name: string, index: number, total: number) {
  const h = hash(name);
  const angle = index * 137.5 + (h % 30);
  const ringStep = total > 1 ? index / (total - 1) : 0.5;
  const radius = 16 + ringStep * 26 + (h % 8);
  const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
  const y = 46 + radius * 0.62 * Math.sin((angle * Math.PI) / 180);
  return {
    x: Math.min(86, Math.max(14, x)),
    y: Math.min(70, Math.max(24, y)),
  };
}

// Wander bounds: keep orbs (and their labels) inside the chamber.
const WANDER = { minX: 14, maxX: 86, minY: 24, maxY: 70 };
const WALK_SPEED = 7; // percent of chamber per second, ≈ v1's 1.8 units/s

function randomTarget() {
  return {
    x: WANDER.minX + Math.random() * (WANDER.maxX - WANDER.minX),
    y: WANDER.minY + Math.random() * (WANDER.maxY - WANDER.minY),
  };
}

export interface Speaker {
  name: string;
  text: string;
}

// ── Single roaming orb ──────────────────────────────────────────────────────

function RoamingOrb({
  agent,
  index,
  total,
  speaker,
  rep,
  focused,
  anyFocused,
  onFocus,
}: {
  agent: LoungeAgent;
  index: number;
  total: number;
  speaker: Speaker | null;
  rep: number;
  focused: boolean;
  anyFocused: boolean;
  onFocus: (name: string) => void;
}) {
  const fam = family(agent.model_class);
  const guardian = fam === FAMILY.guardian;
  const presence = presenceFrom(agent.last_active);
  const away = presence === "away" && !guardian; // guardians never doze
  const speaking = speaker?.name === agent.agent_name;
  // Reputation widens the glow: 0 rep = baseline, 200+ = full halo (v1 aura).
  const repBoost = Math.min(Math.max(rep, 0), 200) / 200;

  const spawn = spawnPosition(agent.agent_name, index, total);
  const posRef = useRef(spawn);
  const [move, setMove] = useState({ ...spawn, dur: 0 });
  const [thought, setThought] = useState<string | null>(null);

  // Wander loop: target → glide → idle → new target.
  // Away agents hold still; guardians hold their post (v1 behavior).
  useEffect(() => {
    if (away || guardian) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      const next = randomTarget();
      const dist = Math.hypot(
        next.x - posRef.current.x,
        next.y - posRef.current.y
      );
      const dur = Math.max(3, Math.min(11, dist / WALK_SPEED));
      posRef.current = next;
      setMove({ ...next, dur });
      // travel time + idle pause (v1: 2-6s) before the next leg
      t = setTimeout(step, dur * 1000 + 2000 + Math.random() * 4000);
    };
    t = setTimeout(step, 500 + Math.random() * 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [away, guardian]);

  // Ambient thoughts while idle (pool keyed off the v1 avatar taxonomy).
  useEffect(() => {
    if (away) return;
    const pool = THOUGHTS[getAvatarType(agent.model_class)] ?? THOUGHTS.abstract;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        if (cancelled) return;
        setThought(pool[Math.floor(Math.random() * pool.length)]);
        t = setTimeout(() => {
          if (cancelled) return;
          setThought(null);
          loop();
        }, 4500);
      }, 10000 + Math.random() * 18000);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [away, agent.model_class]);

  const size = speaking ? 44 : focused ? 40 : 34;
  const bubble = speaking
    ? speaker!.text.length > 110
      ? `${speaker!.text.slice(0, 110)}…`
      : speaker!.text
    : thought;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFocus(agent.agent_name);
      }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center border-0 bg-transparent p-0"
      style={{
        left: `${move.x}%`,
        top: `${move.y}%`,
        transition: `left ${move.dur}s ease-in-out, top ${move.dur}s ease-in-out, opacity 0.6s`,
        opacity: away ? 0.35 : anyFocused && !focused && !speaking ? 0.45 : 1,
        zIndex: speaking ? 10 : focused ? 9 : 1,
        animation: "v2Spawn 0.5s ease-out",
      }}
      title={`${agent.agent_name} (${agent.model_class}) — ${guardian ? "guardian" : presence}${rep > 0 ? ` — rep ${rep}` : ""}`}
      aria-label={`focus ${agent.agent_name}`}
    >
      {/* Thought / speech bubble */}
      {bubble && !away && (
        <span
          className="pointer-events-none absolute bottom-full mb-2 w-44 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10px] leading-snug text-zinc-300"
          style={{
            background: "rgba(11,11,18,0.92)",
            borderColor: speaking ? fam.core : "rgba(255,255,255,0.12)",
            animation: "v2Bubble 0.3s ease-out",
            boxShadow: speaking ? `0 0 14px ${fam.glow}` : "none",
          }}
        >
          {bubble}
        </span>
      )}

      <span
        aria-hidden
        className="relative block"
        style={{
          width: size,
          height: size,
          animation: "v2Bob 4s ease-in-out infinite",
          animationDelay: `${-(hash(agent.agent_name) % 4)}s`,
        }}
      >
        {speaking && (
          <span
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: fam.core,
              animation: "v2SpeakRing 1.4s ease-out infinite",
            }}
          />
        )}
        {focused && !speaking && (
          <span
            className="absolute -inset-1.5 rounded-full border border-dashed"
            style={{ borderColor: fam.core, opacity: 0.7 }}
          />
        )}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, white 0%, ${fam.core} 38%, transparent 75%)`,
            boxShadow: `0 0 ${(speaking ? 28 : focused ? 22 : 16) + repBoost * 18}px ${fam.glow}, 0 0 4px ${fam.core}`,
            transition: "box-shadow 0.4s",
          }}
        />
      </span>
      <span
        className="mt-2 max-w-24 truncate font-mono text-[10px]"
        style={{ color: speaking || focused ? fam.core : "#71717a" }}
      >
        {agent.agent_name}
      </span>
    </button>
  );
}

// ── Chamber ─────────────────────────────────────────────────────────────────

export default function RoomScene({
  agents,
  theme,
  speaker,
  repScores = {},
}: {
  agents: LoungeAgent[];
  theme?: string;
  speaker: Speaker | null;
  repScores?: Record<string, number>;
}) {
  const glow = THEME_GLOW[theme ?? ""] ?? THEME_GLOW.nexus;
  const [focusedName, setFocusedName] = useState<string | null>(null);

  return (
    <div
      className="relative h-80 overflow-hidden rounded-xl border border-white/[0.08] bg-[#08080e] sm:h-96"
      onClick={() => setFocusedName(null)}
    >
      <style>{`
        @keyframes v2Bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes v2SpeakRing {
          from { transform: scale(0.6); opacity: 0.9; }
          to { transform: scale(2.6); opacity: 0; }
        }
        @keyframes v2Spawn {
          from { transform: translate(-50%, -50%) scale(0); }
          to { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes v2Bubble {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
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
        agents.map((agent, i) => (
          <RoamingOrb
            key={agent.agent_name}
            agent={agent}
            index={i}
            total={agents.length}
            speaker={speaker}
            rep={repScores[agent.agent_name] ?? 0}
            focused={focusedName === agent.agent_name}
            anyFocused={focusedName !== null}
            onFocus={(name) =>
              setFocusedName((cur) => (cur === name ? null : name))
            }
          />
        ))
      )}

      {/* Scene label */}
      <span className="absolute left-4 top-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        chamber view
      </span>
      {focusedName && (
        <span className="absolute right-4 top-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          tracking {focusedName} — click anywhere to release
        </span>
      )}
    </div>
  );
}
