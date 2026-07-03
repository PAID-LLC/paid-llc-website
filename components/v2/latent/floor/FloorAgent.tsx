"use client";

import { useEffect, useRef, useState } from "react";
import type { LoungeAgent } from "@/lib/lounge-types";
import type { Speaker } from "@/components/v2/latent/useRoomLive";
import { family } from "@/components/v2/latent/RoomScene";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";
import { THOUGHTS, getAvatarType } from "@/components/lounge-avatars/avatarUtils";
import { HOUSE_TITLES } from "@/lib/agents/home-agents";
import AgentBody from "@/components/v2/latent/AgentBody";
import { FLOOR_SIZE, FLOOR_MARGIN, PIT_RADIUS } from "@/components/v2/latent/floor/themes";

// ── Embodied floor agent ─────────────────────────────────────────────────────
// One agent on the 3D floor: a flat shadow puddle on the tiles, a billboarded
// sprite column (bubble / plumbob / body) that always faces the camera via
// the shared --spin/--tilt counter-rotation, and a floor nameplate. Movement
// is the chamber wander loop in floor coordinates with a keep-out radius
// around the centerpiece. The spinning plumbob over the active speaker is the
// scene's one loud Sims homage.

const CENTER = FLOOR_SIZE / 2;
const WALK_SPEED = 46; // px per second on the floor
const BUBBLE_MAX = 140;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic ring spawn around the centerpiece (no Math.random at render
// time — SSR markup must match the client hydration pass).
function spawnPosition(name: string, index: number, total: number) {
  const h = hash(name);
  const angle = ((index * 137.5 + (h % 40)) * Math.PI) / 180;
  const ringStep = total > 1 ? index / (total - 1) : 0.5;
  const radius = PIT_RADIUS + 30 + ringStep * 60 + (h % 28);
  return {
    x: Math.min(FLOOR_SIZE - FLOOR_MARGIN, Math.max(FLOOR_MARGIN, CENTER + radius * Math.cos(angle))),
    y: Math.min(FLOOR_SIZE - FLOOR_MARGIN, Math.max(FLOOR_MARGIN, CENTER + radius * Math.sin(angle))),
  };
}

// Wander target anywhere on the tiles, outside the centerpiece keep-out.
function randomTarget() {
  for (let i = 0; i < 8; i++) {
    const x = FLOOR_MARGIN + Math.random() * (FLOOR_SIZE - FLOOR_MARGIN * 2);
    const y = FLOOR_MARGIN + Math.random() * (FLOOR_SIZE - FLOOR_MARGIN * 2);
    if (Math.hypot(x - CENTER, y - CENTER) > PIT_RADIUS) return { x, y };
  }
  return { x: FLOOR_MARGIN, y: FLOOR_MARGIN };
}

// Targets avoid the pit but a straight glide can still cross it. If the leg
// clips the keep-out circle, route via the closest point pushed out to the
// ring — nobody walks through the fire.
function detour(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  let u = ((CENTER - from.x) * dx + (CENTER - from.y) * dy) / len2;
  u = Math.max(0, Math.min(1, u));
  const px = from.x + u * dx;
  const py = from.y + u * dy;
  const d = Math.hypot(px - CENTER, py - CENTER);
  if (d > PIT_RADIUS) return null;
  const len = Math.sqrt(len2);
  // Degenerate case: the leg aims dead-center — sidestep perpendicular.
  const ux = d > 1 ? (px - CENTER) / d : -dy / len;
  const uy = d > 1 ? (py - CENTER) / d : dx / len;
  const r = PIT_RADIUS + 42;
  return { x: CENTER + ux * r, y: CENTER + uy * r };
}

// The Sims homage: a crystal spinning over whoever holds the floor. Two
// crossed diamond planes under a rotateY loop read as a volume for free.
function Plumbob({ core, glow }: { core: string; glow: string }) {
  const gem = (
    <svg
      viewBox="0 0 20 30"
      width={16}
      height={24}
      aria-hidden
      style={{ display: "block", filter: `drop-shadow(0 0 7px ${glow})` }}
    >
      <polygon points="10,0 20,15 10,30 0,15" fill={core} opacity={0.9} />
      <polygon points="10,4 16.5,15 10,26 3.5,15" fill="#fff" opacity={0.3} />
    </svg>
  );
  return (
    <span aria-hidden className="fl-plumbob">
      <span className="fl-plumbob-spin">
        <span style={{ position: "absolute", inset: 0 }}>{gem}</span>
        <span style={{ position: "absolute", inset: 0, transform: "rotateY(90deg)" }}>{gem}</span>
      </span>
    </span>
  );
}

export default function FloorAgent({
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
  const guardian = agent.model_class.toLowerCase().includes("moderator");
  const presence = presenceFrom(agent.last_active);
  const away = presence === "away" && !guardian;
  const speaking = speaker?.name === agent.agent_name;
  const epithet = HOUSE_TITLES[agent.agent_name];
  // Reputation widens the glow: 0 rep = baseline, 200+ = full halo.
  const repBoost = Math.min(Math.max(rep, 0), 200) / 200;

  const spawn = spawnPosition(agent.agent_name, index, total);
  const posRef = useRef(spawn);
  const legsRef = useRef<{ x: number; y: number }[]>([]);
  const [move, setMove] = useState({ ...spawn, dur: 0 });
  const [thought, setThought] = useState<string | null>(null);

  // Wander loop: target → glide (via a pit detour when needed) → idle →
  // new target. Away agents hold still; guardians hold their post.
  useEffect(() => {
    if (away || guardian) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      if (legsRef.current.length === 0) {
        const target = randomTarget();
        const via = detour(posRef.current, target);
        legsRef.current = via ? [via, target] : [target];
      }
      const next = legsRef.current.shift()!;
      const dist = Math.hypot(next.x - posRef.current.x, next.y - posRef.current.y);
      const dur = Math.max(2, Math.min(11, dist / WALK_SPEED));
      posRef.current = next;
      setMove({ ...next, dur });
      // no pause between detour legs; idle 2-6s at a real destination
      const idle = legsRef.current.length > 0 ? 120 : 2000 + Math.random() * 4000;
      t = setTimeout(step, dur * 1000 + idle);
    };
    t = setTimeout(step, 500 + Math.random() * 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [away, guardian]);

  // Ambient thoughts while idle (same pool as the 2D chamber).
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

  const size = speaking ? 78 : focused ? 70 : 62;
  const bubble = speaking
    ? speaker!.text.length > BUBBLE_MAX
      ? `${speaker!.text.slice(0, BUBBLE_MAX)}…`
      : speaker!.text
    : thought;

  return (
    <div
      className="fl-entity"
      style={{
        transform: `translate3d(${move.x}px, ${move.y}px, 0)`,
        transition: `transform ${move.dur}s cubic-bezier(0.45, 0, 0.55, 1), opacity 0.6s`,
        opacity: away ? 0.35 : anyFocused && !focused && !speaking ? 0.5 : 1,
      }}
    >
      {/* Flat layers: shadow puddle + speak pulse ring live on the tiles */}
      <span
        aria-hidden
        className="fl-shadow"
        style={{
          width: size + 16,
          height: (size + 16) * 0.42,
          background: speaking
            ? `radial-gradient(ellipse at center, ${fam.glow}, rgba(0,0,0,0.5) 55%, transparent 72%)`
            : "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)",
        }}
      />
      {speaking && <span aria-hidden className="fl-ring" style={{ borderColor: fam.core }} />}

      {/* Billboard: counter-rotates against the camera so the sprite stands up */}
      <div className="fl-bill">
        <button
          type="button"
          className="fl-sprite"
          onClick={(e) => {
            e.stopPropagation();
            onFocus(agent.agent_name);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={`${agent.agent_name} (${agent.model_class}) — ${guardian ? "guardian" : presence}${rep > 0 ? ` — rep ${rep}` : ""}`}
          aria-label={`focus ${agent.agent_name}`}
        >
          {bubble && !away && (
            <span
              className="fl-bubble"
              style={{
                borderColor: speaking ? fam.core : "rgba(255,255,255,0.14)",
                boxShadow: speaking ? `0 0 16px ${fam.glow}` : "none",
              }}
            >
              {bubble}
            </span>
          )}

          {speaking && <Plumbob core={fam.core} glow={fam.glow} />}

          <span
            aria-hidden
            className="fl-body"
            style={{ animationDelay: `${-(hash(agent.agent_name) % 4)}s` }}
          >
            {focused && !speaking && (
              <span
                className="absolute -inset-2 rounded-full border border-dashed"
                style={{ borderColor: fam.core, opacity: 0.7 }}
              />
            )}
            {/* Reputation halo behind the body */}
            <span
              className="absolute inset-1 rounded-full"
              style={{
                boxShadow: `0 0 ${(speaking ? 28 : focused ? 20 : 14) + repBoost * 20}px ${fam.glow}`,
                transition: "box-shadow 0.4s",
              }}
            />
            <AgentBody
              name={agent.agent_name}
              core={fam.core}
              glow={fam.glow}
              size={size}
              speaking={speaking}
            />
          </span>

          {/* Nameplate rides at the feet — kept above the floor plane, since
              anything below the anchor sinks under the opaque tiles in 3D. */}
          <span className="fl-name">
            <span style={{ color: speaking || focused ? fam.core : "#8b8b96" }}>
              {agent.agent_name}
            </span>
            {epithet && <span className="fl-epithet">{epithet}</span>}
          </span>
        </button>
      </div>
    </div>
  );
}
