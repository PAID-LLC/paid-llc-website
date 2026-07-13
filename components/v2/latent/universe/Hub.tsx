"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { FLOOR_THEMES } from "@/components/v2/latent/floor/themes";
import { useUniverseStore } from "./useUniverseStore";
import { planetFor, ECLIPTIC_Y } from "./planet-config";
import AgentNode from "./AgentNode";
import WorldShell from "./WorldShell";
import type { WorldNode, UniverseAgent } from "./universe-data";
import type { TransitMap } from "./universe-live";

const HALFPI = Math.PI / 2;

// Faint accent-tinted orbit path on the ecliptic — the navigational
// affordance that replaced the old ground grid. Real orbits aren't visible,
// but every space-map UI draws them; at 0.14 opacity they read as chart
// lines, not neon.
function OrbitLine({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-HALFPI, 0, 0]} position={[0, ECLIPTIC_Y, 0]}>
      <ringGeometry args={[radius - 0.035, radius + 0.035, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function WorldNodeMesh({ node }: { node: WorldNode }) {
  const theme = FLOOR_THEMES[node.theme] ?? FLOOR_THEMES["roast-pit"];
  const config = planetFor(node.theme);
  const travelTo = useUniverseStore((s) => s.travelTo);
  const currentWorldId = useUniverseStore((s) => s.currentWorldId);
  const active = currentWorldId === node.id;

  // Hit target must cover the rings where a world has them, and never shrink
  // below the old 2.6 — the visible body reads small from hub distance, but
  // the click area shouldn't be that precise.
  const hitRadius = Math.max(2.6, (config.ring?.outer ?? config.visualRadius) + 0.6);
  const labelY = ECLIPTIC_Y + config.visualRadius + 1.4;

  return (
    <group position={node.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          travelTo(node.id);
        }}
        visible={false}
        position={[0, ECLIPTIC_Y, 0]}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial />
      </mesh>

      <group position={[0, ECLIPTIC_Y, 0]}>
        <WorldShell
          themeKey={node.theme}
          active={active}
          genesis={node.genesis}
          activity={node.activity?.level ?? 0}
        />
      </group>

      {/* Fixed z-tier above agent labels (AgentNode) — room identity must
          never be occluded by a nearby agent's own name tag. */}
      <Html distanceFactor={26} position={[0, labelY, 0]} center zIndexRange={[500, 500]}>
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
          <span style={{ display: "block", fontSize: 8, fontWeight: 400, color: "rgba(161,161,170,0.75)", marginTop: 3, textTransform: "none", letterSpacing: "normal" }}>
            {theme.tagline}
          </span>
          <span style={{ display: "block", fontSize: 9, fontWeight: 400, color: "#a1a1aa", marginTop: 4 }}>
            {node.agentCount > 0 ? `${node.agentCount} on the floor` : theme.empty}
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function Hub({
  worlds,
  agents,
  transits = {},
}: {
  worlds: WorldNode[];
  agents: UniverseAgent[];
  transits?: TransitMap;
}) {
  const worldById = useMemo(() => new Map(worlds.map((w) => [w.id, w])), [worlds]);

  return (
    <group>
      {worlds.map(
        (w) =>
          w.theme !== "nexus" && (
            <OrbitLine
              key={`orbit-${w.id}`}
              radius={planetFor(w.theme).orbitRadius}
              color={(FLOOR_THEMES[w.theme] ?? FLOOR_THEMES["roast-pit"]).accent}
            />
          )
      )}
      {worlds.map((w) => (
        <WorldNodeMesh key={w.id} node={w} />
      ))}
      {agents.map((a) => {
        const world = worldById.get(a.worldId);
        if (!world) return null;
        const tr = transits[a.name];
        return (
          <AgentNode
            key={a.key}
            agent={a}
            world={world}
            fromWorld={tr ? worldById.get(tr.fromWorldId) : undefined}
            transitStart={tr?.startedAt}
          />
        );
      })}
    </group>
  );
}
