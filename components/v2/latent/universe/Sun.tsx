"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlanetConfig } from "./planet-config";
import { makeRimMaterial } from "./Planet";

// ── The sun ──────────────────────────────────────────────────────────────────
// The Nexus. Every agent lands here first, so it takes the role the arrival
// hall's lore already implies: the star the whole system orbits, and the
// scene's only key light. decay must stay 0 — three.js's physically-correct
// decay² would leave the outermost world (iteration-forge, orbit 40) in the
// dark. A low ambient in UniverseCanvas keeps night sides barely readable.

export default function Sun({ config }: { config: PlanetConfig }) {
  const coronaA = useRef<THREE.Mesh>(null);
  const coronaB = useRef<THREE.Mesh>(null);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const r = config.visualRadius;

  // Near corona warm, far corona cooler — both the same fresnel rim shader
  // the planets use for their atmospheres.
  const matA = useMemo(() => makeRimMaterial(config.palette.low, 0.85), [config]);
  const matB = useMemo(() => makeRimMaterial(config.palette.high, 0.32), [config]);
  useEffect(
    () => () => {
      matA.dispose();
      matB.dispose();
    },
    [matA, matB]
  );

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    // Slow breathing, ±1.5% — a live star, not a strobe.
    if (coronaA.current) coronaA.current.scale.setScalar(r * 1.28 * (1 + Math.sin(t * 0.7) * 0.015));
    if (coronaB.current) coronaB.current.scale.setScalar(r * 1.75 * (1 + Math.sin(t * 0.5 + 1.7) * 0.015));
  });

  return (
    <group>
      <pointLight intensity={2.2} decay={0} color="#fff2dc" />
      <mesh>
        <sphereGeometry args={[r, 48, 32]} />
        <meshBasicMaterial color={config.palette.base} toneMapped={false} />
      </mesh>
      <mesh ref={coronaA} material={matA} scale={r * 1.28}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <mesh ref={coronaB} material={matB} scale={r * 1.75}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
    </group>
  );
}
