"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BELT, ECLIPTIC_Y } from "./planet-config";

const COUNT_FULL = 260;
const COUNT_LITE = 140; // coarse pointers / reduced motion — same read, fewer bodies

// ── Asteroid belt ────────────────────────────────────────────────────────────
// Decorative only — this never claims to be a roster. Real, named agents are
// AgentNode moons positioned from live presence data; this layer is
// scale/atmosphere so the system doesn't read as six lonely planets. It sits
// in the sandbox→hub gap, the same slot the real belt occupies between Mars
// and Jupiter (planet-config.ts BELT).
//
// One InstancedMesh (ground rule: GPU instancing per entity layer, single
// draw call regardless of count). Grey-brown rocky hues seeded once on
// mount; irregular per-axis scales + slow tumble so bodies read as rocks,
// not beads. Standard material so the sun's point light gives each rock its
// own terminator. Under prefers-reduced-motion the belt freezes: matrices
// are written once with t=0 and never touched again.
export default function AgentSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const count = useMemo(() => {
    if (typeof window === "undefined") return COUNT_FULL;
    const lite = window.matchMedia("(pointer: coarse)").matches || reducedMotion;
    return lite ? COUNT_LITE : COUNT_FULL;
  }, [reducedMotion]);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: BELT.inner + Math.random() * (BELT.outer - BELT.inner),
        height: ECLIPTIC_Y + (Math.random() - 0.5) * 2 * BELT.ySpread,
        speed: 0.02 + Math.random() * 0.03,
        tumble: Math.random() * Math.PI * 2,
        tumbleSpeed: 0.2 + Math.random() * 0.6,
        scale: 0.09 + Math.random() * 0.11,
        // Irregular rocks, not beads.
        sx: 0.6 + Math.random() * 0.8,
        sy: 0.6 + Math.random() * 0.8,
        sz: 0.6 + Math.random() * 0.8,
        hue: 25 + Math.random() * 15, // grey-brown band
        sat: 0.12 + Math.random() * 0.13,
        light: 0.28 + Math.random() * 0.17,
      })),
    [count]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.setHSL(seeds[i].hue / 360, seeds[i].sat, seeds[i].light);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds, count]);

  const frozen = useRef(false);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (reducedMotion && frozen.current) return;
    const t = reducedMotion ? 0 : state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const angle = s.angle + t * s.speed;
      dummy.position.set(Math.cos(angle) * s.radius, s.height, Math.sin(angle) * s.radius);
      dummy.rotation.set(s.tumble + t * s.tumbleSpeed, s.tumble * 1.7 + t * s.tumbleSpeed * 0.6, 0);
      dummy.scale.set(s.scale * s.sx, s.scale * s.sy, s.scale * s.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (reducedMotion) frozen.current = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} metalness={0} />
    </instancedMesh>
  );
}
