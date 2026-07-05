"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT_FULL = 260;
const COUNT_LITE = 140; // coarse pointers / reduced motion — same read, fewer bodies
const FIELD_RADIUS = 46;

// ── Ambient swarm ────────────────────────────────────────────────────────────
// Decorative only — this never claims to be a roster. Real, named agents are
// AgentNode instances positioned from live presence data; this layer is
// scale/atmosphere so the universe doesn't read as seven empty rooms.
//
// One InstancedMesh (ground rule: GPU instancing per entity layer, single
// draw call regardless of count). Positions drift from local time in
// useFrame; nothing here reads the Zustand store, so there is no per-frame
// subscription at all for this layer. Colors never change after seeding, so
// they upload once on mount — only the matrix buffer touches the GPU per
// frame.
export default function AgentSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const count = useMemo(() => {
    if (typeof window === "undefined") return COUNT_FULL;
    const lite =
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return lite ? COUNT_LITE : COUNT_FULL;
  }, []);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 6 + Math.random() * FIELD_RADIUS,
        height: 0.5 + Math.random() * 6,
        speed: 0.04 + Math.random() * 0.08,
        bob: Math.random() * Math.PI * 2,
        scale: 0.12 + Math.random() * 0.08,
        hue: 190 + Math.random() * 40, // cyan band — the system/agent accent
      })),
    [count]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.setHSL(seeds[i].hue / 360, 0.7, 0.55);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds, count]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const angle = s.angle + t * s.speed;
      const x = Math.cos(angle) * s.radius;
      const z = Math.sin(angle) * s.radius;
      const y = s.height + Math.sin(t * 0.6 + s.bob) * 0.4;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.55} />
    </instancedMesh>
  );
}
