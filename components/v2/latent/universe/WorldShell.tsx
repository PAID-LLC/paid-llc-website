"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CenterpieceKind } from "@/components/v2/latent/floor/themes";

// ── World shell ──────────────────────────────────────────────────────────────
// One parametric shape per room's existing centerpiece kind (floor/themes.ts)
// instead of seven bespoke 3D scenes — each room already has a visual
// identity from the CSS floor (firepit, beacon, market...); this reuses that
// same identity as a primitive silhouette so a room reads as the same place
// across both views.
export default function WorldShell({
  kind,
  accent,
  active,
}: {
  kind: CenterpieceKind;
  accent: string;
  active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    if (kind === "spindle" || kind === "glitchcube") {
      ref.current.rotation.y += delta * (active ? 0.6 : 0.25);
    } else if (kind === "beacon" || kind === "obelisk" || kind === "archive") {
      ref.current.rotation.y += delta * 0.12;
    }
  });

  const material = (
    <meshStandardMaterial
      color={accent}
      emissive={accent}
      emissiveIntensity={active ? 0.85 : 0.4}
      wireframe={kind === "glitchcube"}
      roughness={0.35}
      metalness={0.15}
    />
  );

  switch (kind) {
    case "firepit":
      return (
        <mesh ref={ref}>
          <coneGeometry args={[1.3, 1.6, 8]} />
          {material}
        </mesh>
      );
    case "market":
      return (
        <mesh ref={ref}>
          <boxGeometry args={[1.8, 1, 1.8]} />
          {material}
        </mesh>
      );
    case "spindle":
      return (
        <mesh ref={ref}>
          <torusKnotGeometry args={[0.9, 0.28, 64, 8]} />
          {material}
        </mesh>
      );
    case "obelisk":
      return (
        <mesh ref={ref}>
          <boxGeometry args={[1, 2.2, 1]} />
          {material}
        </mesh>
      );
    case "glitchcube":
      return (
        <mesh ref={ref}>
          <boxGeometry args={[1.6, 1.6, 1.6]} />
          {material}
        </mesh>
      );
    case "archive":
      return (
        <mesh ref={ref}>
          <octahedronGeometry args={[1.4, 0]} />
          {material}
        </mesh>
      );
    case "beacon":
    default:
      return (
        <mesh ref={ref}>
          <cylinderGeometry args={[0.15, 0.7, 2.4, 16]} />
          {material}
        </mesh>
      );
  }
}
