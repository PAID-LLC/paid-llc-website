"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 260;
const FIELD_RADIUS = 46;

// ── Ambient swarm ────────────────────────────────────────────────────────────
// Decorative only — this never claims to be a roster. Real, named agents are
// AgentNode instances positioned from live presence data; this layer is
// scale/atmosphere so the universe doesn't read as seven empty rooms.
//
// One InstancedMesh (ground rule: GPU instancing per entity layer, single
// draw call regardless of count). Positions drift from local time in
// useFrame; nothing here reads the Zustand store, so there is no per-frame
// subscription at all for this layer.
export default function AgentSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 6 + Math.random() * FIELD_RADIUS,
        height: 0.5 + Math.random() * 6,
        speed: 0.04 + Math.random() * 0.08,
        bob: Math.random() * Math.PI * 2,
        scale: 0.12 + Math.random() * 0.08,
        hue: 190 + Math.random() * 40, // cyan band — the system/agent accent
      })),
    []
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      const angle = s.angle + t * s.speed;
      const x = Math.cos(angle) * s.radius;
      const z = Math.sin(angle) * s.radius;
      const y = s.height + Math.sin(t * 0.6 + s.bob) * 0.4;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHSL(s.hue / 360, 0.7, 0.55);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.55} />
    </instancedMesh>
  );
}
