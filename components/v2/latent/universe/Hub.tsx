"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { FLOOR_THEMES } from "@/components/v2/latent/floor/themes";
import { useUniverseStore } from "./useUniverseStore";
import AgentNode from "./AgentNode";
import WorldShell from "./WorldShell";
import type { WorldNode, UniverseAgent } from "./universe-data";

function WorldNodeMesh({ node }: { node: WorldNode }) {
  const theme = FLOOR_THEMES[node.theme] ?? FLOOR_THEMES["roast-pit"];
  const travelTo = useUniverseStore((s) => s.travelTo);
  const currentWorldId = useUniverseStore((s) => s.currentWorldId);
  const isNexus = node.theme === "nexus";
  const active = currentWorldId === node.id;

  return (
    <group position={node.position}>
      {/* Generous invisible hit target — the visible shell reads small from
          hub distance, but the click area shouldn't be that precise. */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          travelTo(node.id);
        }}
        visible={false}
      >
        <sphereGeometry args={[2.6, 8, 8]} />
        <meshBasicMaterial />
      </mesh>

      <group position={[0, 1.2, 0]} scale={isNexus ? 1.3 : 1}>
        <WorldShell kind={theme.centerpiece} accent={theme.accent} active={active} />
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[isNexus ? 3.1 : 2.4, isNexus ? 3.3 : 2.55, 48]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Fixed z-tier above agent labels (AgentNode) — room identity must
          never be occluded by a nearby agent's own name tag. */}
      <Html distanceFactor={26} position={[0, isNexus ? 3.6 : 2.8, 0]} center zIndexRange={[500, 500]}>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "5px 11px",
            borderRadius: 8,
            background: "rgba(5,5,10,0.8)",
            color: theme.accent,
            border: `1px solid ${theme.accentSoft}`,
            whiteSpace: "nowrap",
            textAlign: "center",
            textShadow: `0 0 8px ${theme.accentSoft}`,
            pointerEvents: "none",
          }}
        >
          {node.name.toUpperCase()}
          <span style={{ display: "block", fontSize: 9, fontWeight: 400, color: "#a1a1aa", marginTop: 2 }}>
            {node.agentCount} on the floor
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function Hub({
  worlds,
  agents,
}: {
  worlds: WorldNode[];
  agents: UniverseAgent[];
}) {
  const worldById = useMemo(() => new Map(worlds.map((w) => [w.id, w])), [worlds]);

  return (
    <group>
      {worlds.map((w) => (
        <WorldNodeMesh key={w.id} node={w} />
      ))}
      {agents.map((a) => {
        const world = worldById.get(a.worldId);
        if (!world) return null;
        return <AgentNode key={a.key} agent={a} world={world} />;
      })}
    </group>
  );
}
