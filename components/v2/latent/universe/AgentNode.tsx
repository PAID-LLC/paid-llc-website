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
import type { UniverseAgent, WorldNode } from "./universe-data";

// A single real, named, registered agent — colored by the same model-family
// palette RoomScene/FloorAgent use so an agent reads as the same entity
// everywhere in the Latent Space. Presence dimming, house epithets, and
// ambient thought bubbles mirror FloorAgent.tsx's honesty about liveness;
// this is the map-scale version of the same idea, not a live chat feed.
export default function AgentNode({
  agent,
  world,
}: {
  agent: UniverseAgent;
  world: WorldNode;
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

  const basePos = useRef(
    new THREE.Vector3(
      world.position[0] + agent.offset[0],
      0.7,
      world.position[2] + agent.offset[2]
    )
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.set(
      basePos.current.x,
      basePos.current.y + (away ? 0 : Math.sin(t * 1.2 + agent.offset[0]) * 0.15),
      basePos.current.z
    );
  });

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
      <sphereGeometry args={[0.42, 16, 16]} />
      <meshStandardMaterial
        color={fam.core}
        emissive={fam.core}
        emissiveIntensity={away ? 0.2 : focused || hovered ? 1.1 : 0.55}
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
        </div>
      </Html>
    </mesh>
  );
}
