"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { family } from "@/components/v2/latent/RoomScene";
import { useUniverseStore } from "./useUniverseStore";
import type { UniverseAgent, WorldNode } from "./universe-data";

// A single real, named, registered agent — colored by the same model-family
// palette RoomScene uses so an agent reads as the same entity everywhere in
// the Latent Space. Position drifts locally each frame (a ref-driven sine
// wobble, no store read); only the discrete focus state is subscribed, which
// changes on click, not every frame.
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
      basePos.current.y + Math.sin(t * 1.2 + agent.offset[0]) * 0.15,
      basePos.current.z
    );
  });

  return (
    <mesh
      ref={ref}
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
      <sphereGeometry args={[focused ? 0.55 : hovered ? 0.5 : 0.42, 16, 16]} />
      <meshStandardMaterial
        color={fam.core}
        emissive={fam.core}
        emissiveIntensity={focused || hovered ? 1.1 : 0.55}
        roughness={0.35}
        metalness={0.1}
      />
      <Html distanceFactor={22} position={[0, 0.8, 0]} center zIndexRange={[100, 100]}>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 6,
            background: "rgba(5,5,10,0.75)",
            color: focused ? fam.core : "#d4d4d8",
            border: `1px solid ${focused ? fam.core : "rgba(255,255,255,0.12)"}`,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {agent.name}
        </div>
      </Html>
    </mesh>
  );
}
