"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlanetConfig } from "./planet-config";
import {
  makePlanetTextures, makeGenesisTextures, makeRingTexture,
  type GenesisSurface,
} from "./planet-textures";

const HALFPI = Math.PI / 2;

// ── A planet ─────────────────────────────────────────────────────────────────
// Sphere with a procedural surface, lit only by the sun's point light so the
// day/night terminator falls where it should; a fresnel rim shell carries the
// room's accent color; ringed worlds get a tilted double-sided annulus that
// shares the axial tilt (rings sit in the equatorial plane, like the real
// ones). Spin is axial only — planets never revolve, because CameraRig
// targets the static node.position in the store.

const RIM_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  void main() {
    float i = pow(max(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
    gl_FragColor = vec4(uColor, 1.0) * i * uOpacity;
  }
`;

export function makeRimMaterial(color: string, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: RIM_VERT,
    fragmentShader: RIM_FRAG,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

export function AtmosphereRim({
  radius,
  color,
  opacity,
}: {
  radius: number;
  color: string;
  opacity: number;
}) {
  // Color is fixed per theme; opacity updates via the uniform below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => makeRimMaterial(color, opacity), []);
  useEffect(() => {
    material.uniforms.uOpacity.value = opacity;
  }, [material, opacity]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} scale={radius * 1.16}>
      <sphereGeometry args={[1, 32, 24]} />
    </mesh>
  );
}

export default function Planet({
  themeKey,
  config,
  active,
  genesis,
}: {
  themeKey: string;
  config: PlanetConfig;
  active: boolean;
  /** live governance surface for the agent-built world — see makeGenesisTextures */
  genesis?: GenesisSurface;
}) {
  const spinRef = useRef<THREE.Mesh>(null);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const textures = useMemo(
    () => (genesis ? makeGenesisTextures(themeKey, config, genesis) : makePlanetTextures(themeKey, config)),
    [themeKey, config, genesis]
  );
  const ringTexture = useMemo(
    () => (config.ring ? makeRingTexture(themeKey, config.atmosphere.color) : null),
    [themeKey, config]
  );
  useEffect(
    () => () => {
      textures.map.dispose();
      textures.emissiveMap?.dispose();
      ringTexture?.dispose();
    },
    [textures, ringTexture]
  );

  useFrame((_state, delta) => {
    if (spinRef.current && !reducedMotion) spinRef.current.rotation.y += delta * config.spinSpeed;
  });

  return (
    <group rotation={[0, 0, config.axialTilt]}>
      <mesh ref={spinRef}>
        <sphereGeometry args={[config.visualRadius, 48, 32]} />
        <meshStandardMaterial
          map={textures.map}
          roughness={0.92}
          metalness={0}
          emissive={config.cityLights ?? "#000000"}
          emissiveMap={textures.emissiveMap ?? undefined}
          emissiveIntensity={textures.emissiveMap ? 0.85 : 0}
        />
      </mesh>
      <AtmosphereRim
        radius={config.visualRadius}
        color={config.atmosphere.color}
        opacity={active ? Math.min(1, config.atmosphere.opacity * 2.2) : config.atmosphere.opacity}
      />
      {config.ring && ringTexture && (
        <mesh rotation={[-HALFPI, 0, 0]}>
          <ringGeometry args={[config.ring.inner, config.ring.outer, 96]} />
          <meshBasicMaterial
            map={ringTexture}
            transparent
            opacity={config.ring.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
