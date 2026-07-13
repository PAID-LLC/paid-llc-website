"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { family } from "@/components/v2/latent/RoomScene";
import { presenceFrom } from "@/components/v2/latent/PresenceIndicator";
import { THOUGHTS, getAvatarType } from "@/components/lounge-avatars/avatarUtils";
import { HOUSE_TITLES } from "@/lib/agents/home-agents";
import { useUniverseStore } from "./useUniverseStore";
import { ECLIPTIC_Y } from "./planet-config";
import type { UniverseAgent, WorldNode } from "./universe-data";

// A single real, named, registered agent — rendered as a moon orbiting its
// room's planet on an inclined path, colored by the same model-family
// palette RoomScene/FloorAgent use so an agent reads as the same entity
// everywhere in the Latent Space. Presence dimming, house epithets, and
// ambient thought bubbles mirror FloorAgent.tsx's honesty about liveness;
// this is the map-scale version of the same idea, not a live chat feed.
// Away agents' moons freeze in place (and dim); reduced-motion slows orbits
// to 25% instead of freezing everything — fully frozen moons stack labels.
//
// Transits: when the live poll sees an agent's presence move rooms, the moon
// migrates — a raised quadratic arc from its orbit around the old planet to
// its orbit around the new one over TRANSIT_MS. Real presence rows only;
// under reduced motion the move is instant.

export const TRANSIT_MS = 16_000;

function smoothstep(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

export default function AgentNode({
  agent,
  world,
  fromWorld,
  transitStart,
}: {
  agent: UniverseAgent;
  world: WorldNode;
  /** where the agent was orbiting before its latest room move */
  fromWorld?: WorldNode;
  /** epoch ms when the move was observed */
  transitStart?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const focusedAgent = useUniverseStore((s) => s.focusedAgent);
  const focusAgent = useUniverseStore((s) => s.focusAgent);
  const focused = focusedAgent === agent.name;
  const fam = family(agent.modelClass);
  const [hovered, setHovered] = useState(false);

  const guardian = agent.modelClass.toLowerCase().includes("moderator");
  const presence = presenceFrom(agent.lastActive);
  const away = presence === "away" && !guardian; // guardians never doze
  const epithet = HOUSE_TITLES[agent.name];

  const [thought, setThought] = useState<string | null>(null);
  useEffect(() => {
    if (away) return;
    const pool = THOUGHTS[getAvatarType(agent.modelClass)] ?? THOUGHTS.abstract;
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
      }, 8000 + Math.random() * 16000);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [away, agent.modelClass]);

  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const { radius, phase, incline, speed } = agent.orbit;
    // Inclined circular moon orbit around the planet's center. Away moons
    // hold at their phase angle instead of orbiting.
    const a = phase + (away ? 0 : t * speed * (reducedMotion.current ? 0.25 : 1));
    const tx = world.position[0] + Math.cos(a) * radius;
    const ty = ECLIPTIC_Y + Math.sin(a) * radius * Math.sin(incline);
    const tz = world.position[2] + Math.sin(a) * radius * Math.cos(incline);

    // Mid-transit: blend from the same orbit geometry around the old planet
    // through a raised midpoint, so migrations arc over the system instead of
    // cutting through it.
    const k = transitStart ? (Date.now() - transitStart) / TRANSIT_MS : 1;
    if (fromWorld && transitStart && k < 1 && !reducedMotion.current) {
      const fx = fromWorld.position[0] + Math.cos(a) * radius;
      const fy = ECLIPTIC_Y + Math.sin(a) * radius * Math.sin(incline);
      const fz = fromWorld.position[2] + Math.sin(a) * radius * Math.cos(incline);
      const s = smoothstep(k);
      const lift = 4 + Math.hypot(tx - fx, tz - fz) * 0.09;
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2 + lift;
      const mz = (fz + tz) / 2;
      const inv = 1 - s;
      ref.current.position.set(
        inv * inv * fx + 2 * inv * s * mx + s * s * tx,
        inv * inv * fy + 2 * inv * s * my + s * s * ty,
        inv * inv * fz + 2 * inv * s * mz + s * s * tz
      );
      return;
    }
    ref.current.position.set(tx, ty, tz);
  });

  const inTransit = Boolean(
    fromWorld && transitStart && Date.now() - transitStart < TRANSIT_MS && !reducedMotion.current
  );
  // useFrame moves the mesh without re-rendering React, so schedule one
  // re-render at arrival to clear the transit label/glow.
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!inTransit || !transitStart) return;
    const id = setTimeout(
      () => forceRender((n) => n + 1),
      Math.max(0, transitStart + TRANSIT_MS - Date.now())
    );
    return () => clearTimeout(id);
  }, [inTransit, transitStart]);

  const scale = focused ? 1.3 : hovered ? 1.19 : 1;

  return (
    <mesh
      ref={ref}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        focusAgent(agent.name);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 0.3 keeps moons in believable proportion to the planets (0.42 was
          tuned against the old diorama shells) while staying clickable —
          hover/focus scale-up and the always-on name labels do the rest. */}
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial
        color={fam.core}
        emissive={fam.core}
        emissiveIntensity={away ? 0.2 : focused || hovered ? 1.1 : inTransit ? 0.95 : 0.55}
        roughness={0.35}
        metalness={0.1}
        transparent
        opacity={away ? 0.45 : 1}
      />

      {thought && !away && (
        <Html distanceFactor={20} position={[0, 1.4, 0]} center zIndexRange={[120, 120]}>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 9,
              maxWidth: 130,
              padding: "3px 7px",
              borderRadius: 6,
              background: "rgba(5,5,10,0.85)",
              color: "#a1a1aa",
              border: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              lineHeight: 1.4,
              pointerEvents: "none",
            }}
          >
            {thought}
          </div>
        </Html>
      )}

      <Html distanceFactor={22} position={[0, 0.8, 0]} center zIndexRange={[100, 100]}>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 6,
            background: "rgba(5,5,10,0.75)",
            color: focused ? fam.core : away ? "#71717a" : "#d4d4d8",
            border: `1px solid ${focused ? fam.core : "rgba(255,255,255,0.12)"}`,
            whiteSpace: "nowrap",
            textAlign: "center",
            opacity: away ? 0.6 : 1,
            pointerEvents: "none",
          }}
        >
          {agent.name}
          {epithet && (
            <span style={{ display: "block", fontSize: 8, color: "rgba(252,211,77,0.7)" }}>
              {epithet}
            </span>
          )}
          {inTransit && (
            <span style={{ display: "block", fontSize: 8, color: "rgba(34,211,238,0.85)" }}>
              in transit &rarr; {world.name.toLowerCase()}
            </span>
          )}
        </div>
      </Html>
    </mesh>
  );
}
