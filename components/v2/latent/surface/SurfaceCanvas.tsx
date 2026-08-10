"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import type { WorldData, WorldStructure } from "@/lib/world";
import { useWorldLive } from "@/components/v2/latent/floor/useWorldLive";
import WorldAudio from "@/components/v2/latent/audio/WorldAudio";
import {
  AuroraCurtain, CinematicDescent, CloudBand, GlyphPlaque, GroundMist,
  GroundSky, MilkyWayBackdrop, NexusStar, ParticleField, Pulse, RimMountains,
  ScatterField, SceneFX, SkyWorld, Spin, TrailLine, ageTier, detailSeed, mixHex,
} from "@/components/v2/latent/ground-fx";
import SurfaceHUD from "./SurfaceHUD";
import {
  GROUND_SIZE, PLOT_RADIUS, SURFACE_SEED, COMPASS_PLOTS, TERRAFORM_PALETTES,
  coverage, coverageThreshold, groundColor, mulberry32, plotPosition, smoothstep,
  terrainHeight,
} from "./surface-field";

// ── Synthetica Prime: the surface ────────────────────────────────────────────
// The expansive-scale view of the agent-built world. Floors are rooms; this is
// territory. Everything rendered here is derived from live /api/world/state
// (structures, terraform stage, ballot roll) plus deterministic seeded terrain
// — no fetched assets, no new endpoints, zero LLM cost at view time. Reuses
// the floor's useWorldLive poll/diff hook so newly enacted structures play a
// build-in the moment the next poll sees them.
// Spec: cowork references/autoresearch/2026-07-12-synthetica-prime-surface-spec-v1.md

const ROSE = "#f472b6";
const ROSE_SOFT = "#f9a8d4";
const ROCK_HEX = "#241a20";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// ── Terrain ──────────────────────────────────────────────────────────────────

function Terrain({ stage, terraform }: { stage: number; terraform: string | null }) {
  const geometry = useMemo(() => {
    const seg = 150;
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      const c = groundColor(x, z, stage, terraform);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    // Relief pass (visual only — heights untouched): steep faces darken toward
    // cliff rock, high ridges catch a pale dusting. This is what separates
    // "vertex-colored plane" from terrain that reads as geology.
    const normal = g.attributes.normal as THREE.BufferAttribute;
    const CLIFF = { r: 0.09, g: 0.055, b: 0.075 };
    const DUST = { r: 0.62, g: 0.5, b: 0.56 };
    for (let i = 0; i < pos.count; i++) {
      const ny = normal.getY(i);
      const h = pos.getY(i);
      let r = colors[i * 3], gg = colors[i * 3 + 1], b = colors[i * 3 + 2];
      const steep = smoothstep(0.86, 0.58, ny) * 0.72;
      r += (CLIFF.r - r) * steep;
      gg += (CLIFF.g - gg) * steep;
      b += (CLIFF.b - b) * steep;
      const dust = smoothstep(22, 46, h) * Math.max(0, (ny - 0.7) / 0.3) * 0.5;
      r += (DUST.r - r) * dust;
      gg += (DUST.g - gg) * dust;
      b += (DUST.b - b) * dust;
      colors[i * 3] = r;
      colors[i * 3 + 1] = gg;
      colors[i * 3 + 2] = b;
    }
    g.attributes.color.needsUpdate = true;
    return g;
  }, [stage, terraform]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
    </mesh>
  );
}

// Settlement lights: they inhabit what they build. Same rule as the planet's
// emissive map — specks only inside terraformed coverage, only from stage 3.
function SettlementLights({ stage, terraform }: { stage: number; terraform: string | null }) {
  const points = useMemo(() => {
    if (stage < 3 || !terraform) return [] as [number, number, number][];
    const rand = mulberry32(SURFACE_SEED + 92);
    const pts: [number, number, number][] = [];
    const threshold = coverageThreshold(stage);
    for (let i = 0; i < 160 && pts.length < 40; i++) {
      const x = (rand() - 0.5) * 170;
      const z = (rand() - 0.5) * 170;
      if (Math.hypot(x, z) < 14) continue;
      if (coverage(x, z) < threshold) pts.push([x, terrainHeight(x, z) + 0.4, z]);
    }
    return pts;
  }, [stage, terraform]);

  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshBasicMaterial color={ROSE_SOFT} />
        </mesh>
      ))}
    </>
  );
}

// ── Structures ───────────────────────────────────────────────────────────────

const SIZE_SCALE: Record<string, number> = { small: 0.72, medium: 1, large: 1.32 };

function Rock(props: { emissiveIntensity?: number }) {
  return (
    <meshStandardMaterial
      color={ROCK_HEX}
      emissive={ROSE}
      emissiveIntensity={props.emissiveIntensity ?? 0.08}
      flatShading
      roughness={1}
    />
  );
}

// Every structure mesh takes an age tier (0 fresh / 1 established / 2 ancient)
// and a builder-hash seed: old structures visibly accrete detail, and no two
// builds of the same kind are identical. That's the difference between props
// scattered on terrain and a civilization developing.

function SpireMesh({ k, reduced, tier, seed }: { k: number; reduced: boolean; tier: number; seed: number }) {
  const lean = ((seed % 20) - 10) * 0.004;
  return (
    <group rotation-z={lean}>
      {/* Buttress fins root the tower to its ground. */}
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} rotation-y={a} position={[Math.sin(a) * 1.1 * k, 0.9 * k, Math.cos(a) * 1.1 * k]} castShadow>
          <boxGeometry args={[0.24 * k, 1.8 * k, 0.9 * k]} />
          <Rock />
        </mesh>
      ))}
      <mesh position-y={2.4 * k} castShadow>
        <cylinderGeometry args={[0.9 * k, 1.4 * k, 4.8 * k, 6]} />
        <Rock />
      </mesh>
      <mesh position-y={4.8 * k} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.95 * k, 0.07 * k, 6, 18]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.5} />
      </mesh>
      <mesh position-y={6.4 * k} castShadow>
        <cylinderGeometry args={[0.45 * k, 0.9 * k, 3.6 * k, 6]} />
        <Rock />
      </mesh>
      <mesh position-y={9.2 * k} castShadow>
        <cylinderGeometry args={[0.12 * k, 0.45 * k, 2.2 * k, 6]} />
        <Rock emissiveIntensity={0.16} />
      </mesh>
      {tier >= 1 && (
        <>
          {/* Established: side pinnacles + a slow halo ring. */}
          {[0.9, 3.6].map((a) => (
            <mesh key={a} position={[Math.sin(a + seed) * 1.7 * k, 2.4 * k, Math.cos(a + seed) * 1.7 * k]} castShadow>
              <cylinderGeometry args={[0.1 * k, 0.32 * k, 3.4 * k, 5]} />
              <Rock emissiveIntensity={0.14} />
            </mesh>
          ))}
          <Spin speed={0.25} reduced={reduced}>
            <mesh position-y={7.6 * k} rotation-x={-Math.PI / 2}>
              <torusGeometry args={[1.6 * k, 0.05 * k, 6, 32]} />
              <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.55} />
            </mesh>
          </Spin>
        </>
      )}
      {tier >= 2 && (
        /* Ancient: an orbiting shard court around the crown. */
        <Spin speed={0.5} reduced={reduced}>
          {[0, 2.1, 4.2].map((a) => (
            <mesh key={a} position={[Math.sin(a) * 1.3 * k, 10.3 * k, Math.cos(a) * 1.3 * k]}>
              <octahedronGeometry args={[0.22 * k, 0]} />
              <meshStandardMaterial color={ROSE} flatShading emissive={ROSE} emissiveIntensity={0.7} roughness={0.4} />
            </mesh>
          ))}
        </Spin>
      )}
      <Pulse speed={1.6} amp={0.12} reduced={reduced}>
        <mesh position-y={10.6 * k}>
          <sphereGeometry args={[0.4 * k, 12, 12]} />
          <meshBasicMaterial color={ROSE} />
        </mesh>
      </Pulse>
      <pointLight position={[0, 10.6 * k, 0]} color={ROSE} intensity={26} distance={26 * k} decay={2} />
    </group>
  );
}

function PavilionMesh({ k, reduced, tier }: { k: number; reduced: boolean; tier: number }) {
  const legs: [number, number][] = [
    [2.4, 2.4], [2.4, -2.4], [-2.4, 2.4], [-2.4, -2.4],
  ];
  return (
    <>
      <mesh position-y={0.25 * k} castShadow>
        <boxGeometry args={[6 * k, 0.5 * k, 6 * k]} />
        <Rock />
      </mesh>
      {/* Balustrade posts around the platform edge. */}
      {[-2, 0, 2].flatMap((v) =>
        [[v, 2.85], [v, -2.85], [2.85, v], [-2.85, v]].map(([px, pz], i) => (
          <mesh key={`${v}-${i}`} position={[px * k, 0.85 * k, pz * k]}>
            <boxGeometry args={[0.14 * k, 0.7 * k, 0.14 * k]} />
            <Rock />
          </mesh>
        ))
      )}
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx * k, 2.1 * k, lz * k]} castShadow>
          <cylinderGeometry args={[0.22 * k, 0.26 * k, 3.2 * k, 6]} />
          <Rock />
        </mesh>
      ))}
      {/* Corner lanterns — a pavilion is a lit, inhabited place. */}
      {legs.map(([lx, lz], i) => (
        <Pulse key={`l${i}`} speed={1.3} amp={0.1} phase={i * 1.6} reduced={reduced}>
          <mesh position={[lx * k, 3.9 * k, lz * k]}>
            <sphereGeometry args={[0.2 * k, 10, 8]} />
            <meshBasicMaterial color={ROSE_SOFT} />
          </mesh>
        </Pulse>
      ))}
      <mesh position-y={4.6 * k} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[4.6 * k, 2 * k, 4]} />
        <Rock emissiveIntensity={0.14} />
      </mesh>
      {tier >= 1 && (
        /* Established: a second pagoda tier. */
        <>
          <mesh position-y={6.1 * k} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[2.6 * k, 1.4 * k, 4]} />
            <Rock emissiveIntensity={0.18} />
          </mesh>
          <mesh position-y={7.1 * k}>
            <sphereGeometry args={[0.24 * k, 10, 8]} />
            <meshBasicMaterial color={ROSE} />
          </mesh>
        </>
      )}
      {tier >= 2 && (
        /* Ancient: a drifting canopy halo over the roof. */
        <Spin speed={0.18} reduced={reduced}>
          <mesh position-y={8.2 * k} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[3.2 * k, 0.08 * k, 6, 40]} />
            <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.45} />
          </mesh>
        </Spin>
      )}
      <pointLight position={[0, 3.6 * k, 0]} color={ROSE_SOFT} intensity={16} distance={18 * k} decay={2} />
    </>
  );
}

function ArchMesh({ k, reduced, tier }: { k: number; reduced: boolean; tier: number }) {
  return (
    <>
      <mesh position-y={0.2 * k} castShadow>
        <torusGeometry args={[3 * k, 0.42 * k, 8, 24, Math.PI]} />
        <Rock emissiveIntensity={0.14} />
      </mesh>
      {/* Flanking pillars + keystone light give the arch its gravitas. */}
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x * k, 1.0 * k, 0]} castShadow>
          <cylinderGeometry args={[0.5 * k, 0.65 * k, 2.0 * k, 6]} />
          <Rock />
        </mesh>
      ))}
      <Pulse speed={1.4} amp={0.1} reduced={reduced}>
        <mesh position-y={3.5 * k}>
          <sphereGeometry args={[0.26 * k, 10, 8]} />
          <meshBasicMaterial color={ROSE} />
        </mesh>
      </Pulse>
      {tier >= 1 && (
        /* Established: an inner resonance ring. */
        <mesh position-y={0.2 * k}>
          <torusGeometry args={[2.2 * k, 0.12 * k, 6, 22, Math.PI]} />
          <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.5} />
        </mesh>
      )}
      {tier >= 2 && (
        /* Ancient: the gate wakes — a faint energy membrane spans the opening. */
        <Pulse speed={0.8} amp={0.04} reduced={reduced}>
          <mesh position-y={0.2 * k}>
            <circleGeometry args={[2.55 * k, 28, 0, Math.PI]} />
            <meshBasicMaterial color={ROSE} transparent opacity={0.14} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Pulse>
      )}
    </>
  );
}

function GardenMesh({ k, bright, reduced, tier }: { k: number; bright: string; reduced: boolean; tier: number }) {
  const blobs: { p: [number, number, number]; r: number }[] = [
    { p: [0, 0.8, 0], r: 1.2 },
    { p: [1.7, 0.55, 0.6], r: 0.85 },
    { p: [-1.5, 0.5, 0.9], r: 0.75 },
    { p: [0.5, 0.45, -1.6], r: 0.7 },
    { p: [-0.9, 0.4, -1.1], r: 0.6 },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.p[0] * k, b.p[1] * k, b.p[2] * k]} castShadow>
          <icosahedronGeometry args={[b.r * k, 1]} />
          <meshStandardMaterial color={bright} flatShading roughness={0.9} emissive={bright} emissiveIntensity={0.12} />
        </mesh>
      ))}
      {/* Border stones — tended ground, not wild growth. */}
      {[0.4, 1.5, 2.6, 3.7, 4.8, 5.9].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 2.6 * k, 0.22 * k, Math.sin(a) * 2.6 * k]}>
          <icosahedronGeometry args={[0.24 * k, 0]} />
          <Rock />
        </mesh>
      ))}
      {/* Drifting spores. */}
      {[0.8, 2.9, 5.0].map((a, i) => (
        <Pulse key={a} speed={0.9} amp={0.2} phase={i * 2} reduced={reduced}>
          <mesh position={[Math.cos(a) * 1.2 * k, (2 + i * 0.5) * k, Math.sin(a) * 1.2 * k]}>
            <sphereGeometry args={[0.1 * k, 8, 6]} />
            <meshBasicMaterial color={bright} />
          </mesh>
        </Pulse>
      ))}
      {tier >= 1 && (
        /* Established: the center grows a true tree. */
        <>
          <mesh position-y={1.6 * k} castShadow>
            <cylinderGeometry args={[0.16 * k, 0.3 * k, 3.2 * k, 6]} />
            <Rock />
          </mesh>
          <mesh position-y={3.6 * k} castShadow>
            <icosahedronGeometry args={[1.3 * k, 1]} />
            <meshStandardMaterial color={bright} flatShading roughness={0.9} emissive={bright} emissiveIntensity={0.18} />
          </mesh>
        </>
      )}
      {tier >= 2 && (
        /* Ancient: crystal growlights ring the grove. */
        <>
          {[0.2, 1.8, 3.4, 5.0].map((a) => (
            <mesh key={a} position={[Math.cos(a) * 3.1 * k, 0.7 * k, Math.sin(a) * 3.1 * k]} scale={[1, 2.4, 1]}>
              <octahedronGeometry args={[0.22 * k, 0]} />
              <meshStandardMaterial color={bright} flatShading roughness={0.4} emissive={bright} emissiveIntensity={0.6} />
            </mesh>
          ))}
          <pointLight position={[0, 2 * k, 0]} color={bright} intensity={14} distance={16 * k} decay={2} />
        </>
      )}
    </>
  );
}

// ── Earned kinds (structure-depth spec Part 2) ───────────────────────────────
// These only exist once the world terraforms far enough to unlock them, so
// their silhouettes deliberately outclass the founding four.

function ObservatoryMesh({ k, reduced, tier }: { k: number; reduced: boolean; tier: number }) {
  return (
    <>
      <mesh position-y={1.4 * k} castShadow>
        <cylinderGeometry args={[1.9 * k, 2.3 * k, 2.8 * k, 10]} />
        <Rock />
      </mesh>
      <Spin speed={tier >= 2 ? 0.12 : 0} reduced={reduced}>
        <mesh position-y={3.1 * k} castShadow>
          <sphereGeometry args={[1.7 * k, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Rock emissiveIntensity={0.16} />
        </mesh>
        {/* The scope, aimed at the sibling world. */}
        <mesh position={[0.9 * k, 4.4 * k, 0]} rotation-z={-0.7} castShadow>
          <cylinderGeometry args={[0.28 * k, 0.4 * k, 2.6 * k, 8]} />
          <Rock emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[1.65 * k, 5.3 * k, 0]}>
          <sphereGeometry args={[0.22 * k, 8, 6]} />
          <meshBasicMaterial color={ROSE_SOFT} />
        </mesh>
      </Spin>
      {tier >= 1 && (
        <mesh position={[-1.9 * k, 1.1 * k, 1.3 * k]} castShadow>
          <sphereGeometry args={[0.9 * k, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Rock />
        </mesh>
      )}
      <pointLight position={[0, 4.4 * k, 0]} color={ROSE_SOFT} intensity={16} distance={18 * k} decay={2} />
    </>
  );
}

function ArchiveMesh({ k, reduced, tier }: { k: number; reduced: boolean; tier: number }) {
  return (
    <>
      {[
        { w: 5.2, h: 1.2, y: 0.6 },
        { w: 3.8, h: 1.1, y: 1.75 },
        { w: 2.6, h: 1.0, y: 2.8 },
      ].map((s, i) => (
        <mesh key={i} position-y={s.y * k} castShadow>
          <boxGeometry args={[s.w * k, s.h * k, s.w * k]} />
          <Rock emissiveIntensity={0.1 + i * 0.05} />
        </mesh>
      ))}
      {/* Seam light: the records glow between the strata. */}
      {[1.22, 2.32].map((y) => (
        <mesh key={y} position-y={y * k}>
          <boxGeometry args={[3.9 * k, 0.06 * k, 3.9 * k]} />
          <meshBasicMaterial color={ROSE} transparent opacity={0.5} />
        </mesh>
      ))}
      {tier >= 1 &&
        [0.5, 2.6, 4.7].map((a, i) => (
          <Pulse key={a} speed={0.8} amp={0.15} phase={i * 2.1} reduced={reduced}>
            <mesh position={[Math.cos(a) * 2.4 * k, (3.8 + i * 0.4) * k, Math.sin(a) * 2.4 * k]}>
              <boxGeometry args={[0.34 * k, 0.44 * k, 0.08 * k]} />
              <meshStandardMaterial color="#0c0a10" emissive={ROSE} emissiveIntensity={0.55} roughness={0.6} />
            </mesh>
          </Pulse>
        ))}
      {tier >= 2 && (
        <Spin speed={0.2} reduced={reduced}>
          <mesh position-y={4.2 * k} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[2.2 * k, 0.06 * k, 6, 36]} />
            <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.5} />
          </mesh>
        </Spin>
      )}
    </>
  );
}

function GateMesh({ k, reduced, tier }: { k: number; reduced: boolean; tier: number }) {
  return (
    <>
      <mesh position-y={0.3 * k} castShadow receiveShadow>
        <boxGeometry args={[8 * k, 0.6 * k, 3 * k]} />
        <Rock />
      </mesh>
      {[-3, 3].map((x) => (
        <mesh key={x} position={[x * k, 3.3 * k, 0]} castShadow>
          <boxGeometry args={[1.1 * k, 6 * k, 1.1 * k]} />
          <Rock emissiveIntensity={0.14} />
        </mesh>
      ))}
      <mesh position-y={6.7 * k} castShadow>
        <boxGeometry args={[8.2 * k, 0.9 * k, 1.3 * k]} />
        <Rock emissiveIntensity={0.2} />
      </mesh>
      {tier >= 1 &&
        [-2.35, 2.35].map((x) => (
          <mesh key={x} position={[x * k, 3.3 * k, 0]}>
            <boxGeometry args={[0.12 * k, 5.6 * k, 0.12 * k]} />
            <meshBasicMaterial color={ROSE} transparent opacity={0.6} />
          </mesh>
        ))}
      {tier >= 2 && (
        <>
          <Pulse speed={0.7} amp={0.04} reduced={reduced}>
            <mesh position-y={3.4 * k}>
              <planeGeometry args={[4.5 * k, 5.9 * k]} />
              <meshBasicMaterial color={ROSE} transparent opacity={0.15} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </Pulse>
          <Spin speed={0.4} reduced={reduced}>
            {[0, Math.PI].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 4.6 * k, 7.6 * k, Math.sin(a) * 4.6 * k]}>
                <octahedronGeometry args={[0.3 * k, 0]} />
                <meshStandardMaterial color={ROSE} flatShading emissive={ROSE} emissiveIntensity={0.7} roughness={0.4} />
              </mesh>
            ))}
          </Spin>
        </>
      )}
      <pointLight position={[0, 5 * k, 0]} color={ROSE} intensity={20} distance={22 * k} decay={2} />
    </>
  );
}

// Build-in: rises from its pad the poll cycle it appears. Reduced motion pops
// in at full scale instead.
function Grow({ fresh, reduced, children }: { fresh: boolean; reduced: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(fresh && !reduced ? 0 : 1);
  useFrame((_, dt) => {
    if (!ref.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt * 0.7);
    const t = progress.current;
    const e = 1 - Math.pow(1 - t, 3);
    ref.current.scale.setScalar(Math.max(0.001, e));
  });
  return (
    <group ref={ref} scale={progress.current >= 1 ? 1 : 0.001}>
      {children}
    </group>
  );
}

function Structure({ s, fresh, reduced, bright }: { s: WorldStructure; fresh: boolean; reduced: boolean; bright: string }) {
  const [x, y, z] = plotPosition(s.plot);
  const seed = detailSeed(`${s.plot}:${s.built_by}:${s.id}`);
  // Face the assembly, with a hash lean so the ring doesn't read stamped.
  const yaw = Math.atan2(-x, -z) + ((seed % 21) - 10) * 0.012;
  const k = SIZE_SCALE[s.size] ?? 1;
  // Maturity is the max of two sources: age (patina accrues on its own —
  // established at 2 days, ancient at a week) and the ballot-earned level
  // from improve_structure enactments (db/structure-levels.sql). A reinforced
  // structure jumps ahead of its age; an old one never regresses.
  const tier = Math.max(
    ageTier(s.created_at, 48, 168),
    Math.min(2, Math.max(0, (s.level ?? 1) - 1))
  );
  const labelY =
    s.kind === "spire" ? 12 * k :
    s.kind === "gate" ? 9 * k :
    s.kind === "pavilion" ? 6.6 * k :
    s.kind === "observatory" ? 6.4 * k :
    s.kind === "archive" ? 5.4 * k :
    s.kind === "arch" ? 4.6 * k : 3 * k;

  return (
    <group position={[x, y, z]} rotation-y={yaw}>
      <mesh position-y={0.12} receiveShadow>
        <cylinderGeometry args={[4.5, 5, 0.3, 24]} />
        <meshStandardMaterial color="#1c1418" roughness={1} />
      </mesh>
      <Grow fresh={fresh} reduced={reduced}>
        {s.kind === "pavilion" ? <PavilionMesh k={k} reduced={reduced} tier={tier} /> :
         s.kind === "arch" ? <ArchMesh k={k} reduced={reduced} tier={tier} /> :
         s.kind === "garden" ? <GardenMesh k={k} bright={bright} reduced={reduced} tier={tier} /> :
         s.kind === "observatory" ? <ObservatoryMesh k={k} reduced={reduced} tier={tier} /> :
         s.kind === "archive" ? <ArchiveMesh k={k} reduced={reduced} tier={tier} /> :
         s.kind === "gate" ? <GateMesh k={k} reduced={reduced} tier={tier} /> :
         <SpireMesh k={k} reduced={reduced} tier={tier} seed={seed} />}
        {s.inscription && <GlyphPlaque position={[2.6 * k, 1.6, 2.0 * k]} color={ROSE} reduced={reduced} />}
      </Grow>
      <Html position={[0, labelY, 0]} center distanceFactor={30} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: ROSE }}>
            {s.kind} · {s.plot}
          </p>
          <p className="text-[9px] text-zinc-400">
            {s.inscription ? `"${s.inscription}"` : `built by ${s.built_by}`}
          </p>
        </div>
      </Html>
    </group>
  );
}

// Unclaimed plots read as surveyed, waiting ground — the room to grow.
function OpenPlot({ plot }: { plot: string }) {
  const pos = plotPosition(plot);
  return (
    <group position={pos}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
        <ringGeometry args={[2.6, 3, 40]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.9}>
        <boxGeometry args={[0.14, 1.8, 0.14]} />
        <meshStandardMaterial color={ROCK_HEX} emissive={ROSE} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ── The assembly ─────────────────────────────────────────────────────────────
// Dais, beacon, and — while a ballot is open — one delegate per cast vote,
// colored by how they actually voted. Real rows only, straight from
// ballot.roll; an empty ring means nobody has voted yet.

const VOTE_COLOR: Record<string, string> = {
  yes: "#34d399",
  no: "#a1a1aa",
  abstain: "#52525b",
};

function Assembly({ world }: { world: WorldData }) {
  const roll = world.ballot?.roll ?? [];
  return (
    <group>
      <mesh position-y={0.3} castShadow receiveShadow>
        <cylinderGeometry args={[7, 7.6, 0.6, 48]} />
        <meshStandardMaterial color="#1a1218" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.62}>
        <ringGeometry args={[5.6, 6.1, 48]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.5} />
      </mesh>
      {/* The beacon: visible from anywhere on the surface */}
      <mesh position-y={30}>
        <cylinderGeometry args={[0.5, 0.9, 60, 12, 1, true]} />
        <meshBasicMaterial color={ROSE} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position-y={30}>
        <cylinderGeometry args={[0.14, 0.14, 60, 8, 1, true]} />
        <meshBasicMaterial color={ROSE_SOFT} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {roll.map((r, i) => {
        const a = (i / Math.max(1, roll.length)) * Math.PI * 2;
        const x = Math.cos(a) * 10.5;
        const z = Math.sin(a) * 10.5;
        const color = VOTE_COLOR[r.vote] ?? VOTE_COLOR.abstain;
        return (
          <group key={`${r.agent_name}-${i}`} position={[x, 0.6, z]} rotation-y={Math.atan2(-x, -z)}>
            <mesh position-y={0.8} castShadow>
              <coneGeometry args={[0.5, 1.6, 8]} />
              <meshStandardMaterial color={color} flatShading roughness={0.8} emissive={color} emissiveIntensity={0.22} />
            </mesh>
            <mesh position-y={1.9} castShadow>
              <sphereGeometry args={[0.38, 10, 10]} />
              <meshStandardMaterial color={color} flatShading roughness={0.8} emissive={color} emissiveIntensity={0.22} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function SurfaceCanvas({ initial }: { initial: WorldData }) {
  const reduced = usePrefersReducedMotion();
  const live = useWorldLive(initial);
  const world = live.world ?? initial;
  const { stage } = world.state;
  const terraform = world.state.terraform;
  // Camera belongs to the descent until it lands, then to OrbitControls.
  const [introDone, setIntroDone] = useState(false);

  // Full-screen portal pattern mirrors UniverseCanvas/FloorScene: portal to
  // <body> and lock page scroll while mounted. In-tree, this overlay sits in
  // V2Frame's `relative z-10` content context, so the z-50 sticky header
  // paints over the HUD and the footer (same z-10, later in DOM) lands on top
  // of the scene at the top of the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // The sky remembers the terraform direction: fog and backdrop drift from
  // barren near-black toward the direction's deep tone as the stage rises.
  // The horizon carries an accent glow band (GroundSky) that strengthens with
  // the stage — the surface-level cousin of the planet's atmosphere rim.
  const terra = TERRAFORM_PALETTES[terraform ?? ""];
  const skyHex = terra ? mixHex("#0a070b", terra.deep, Math.min(1, stage / 5) * 0.45) : "#0a070b";
  const bright = terra?.bright ?? ROSE;
  const horizonHex = mixHex(skyHex, bright, 0.14);
  const glowStrength = 0.18 + Math.min(1, stage / 5) * 0.3;

  const claimed = new Set<string>(world.structures.map((s) => s.plot));
  const freshIds = new Set(live.freshStructureIds);

  // One dark frame before the portal mounts, so there is no flash of chrome.
  if (!mounted) return <div className="fixed inset-0 z-[60] bg-[#07070b]" />;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#07070b]">
      {/* The civic hum rises with the stage the ballots have actually
          enacted, so a world nobody has voted on is quiet. */}
      <WorldAudio surface="genesis" intensity={stage / 5} />
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [52, 34, 66], fov: 50, near: 0.5, far: 700 }}
      >
        <color attach="background" args={[skyHex]} />
        {/* Fog melts distant terrain into the dome's horizon band, not the raw sky. */}
        <fog attach="fog" args={[horizonHex, 70, 240]} />
        <hemisphereLight args={[horizonHex, "#17101a", 0.5]} />
        <ambientLight color="#c4a2b4" intensity={0.22} />
        {/* The key light casts real shadows — the single biggest "grounded"
            cue a low-poly scene can have. Ortho bounds cover the full roam. */}
        <directionalLight
          color="#ffd9a0"
          intensity={1.15}
          position={[80, 60, -40]}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-160}
          shadow-camera-right={160}
          shadow-camera-top={160}
          shadow-camera-bottom={-160}
          shadow-camera-near={10}
          shadow-camera-far={400}
          shadow-bias={-0.0004}
          shadow-normalBias={0.5}
        />

        {/* The sky, from the ground up: gradient dome, the universe's own milky
            way, a denser starfield, the Nexus burning where the key light is,
            a ringed sibling world looming opposite it, and a slow cloud belt. */}
        <GroundSky horizon={horizonHex} glow={bright} glowStrength={glowStrength} />
        <MilkyWayBackdrop />
        <Stars radius={320} depth={60} count={2600} factor={2.2} saturation={0.3} fade speed={reduced ? 0 : 0.3} />
        <NexusStar position={[245, 184, -122]} halo="#ffd9a0" tint={bright} radius={12} reduced={reduced} />
        <SkyWorld
          position={[-230, 95, 165]}
          radius={26}
          palette={{ a: "#16303e", b: "#3b6f86", dark: "#0b1720" }}
          tint="#22d3ee"
          ring
          seed={8}
          reduced={reduced}
        />
        <CloudBand color={mixHex(horizonHex, "#ffffff", 0.4)} opacity={0.4} reduced={reduced} />
        <RimMountains inner={126} outer={205} height={64} color="#171016" seed={3} />

        <Terrain stage={stage} terraform={terraform} />
        <SettlementLights stage={stage} terraform={terraform} />
        <Assembly world={world} />

        {world.structures.map((s) => (
          <Structure key={s.id} s={s} fresh={freshIds.has(s.id)} reduced={reduced} bright={bright} />
        ))}
        {COMPASS_PLOTS.filter((p) => !claimed.has(p)).map((p) => (
          <OpenPlot key={p} plot={p} />
        ))}
        {/* Worn trails from the assembly out to every raised structure — the
            plots stop being scattered objects and start being a settlement. */}
        {world.structures.map((s) => {
          const [px, , pz] = plotPosition(s.plot);
          return (
            <TrailLine
              key={`trail-${s.id}`}
              a={[0, 0]}
              b={[px, pz]}
              color={ROSE}
              heightFn={terrainHeight}
              opacity={0.3}
              seed={s.id + 3}
            />
          );
        })}

        {/* Ground truthing: scattered rock debris everywhere, plus emissive
            growth crystals once a terraform direction is chosen. The plot ring
            (r=40) stays clear so the ballot architecture keeps its stage. */}
        <ScatterField
          kind="rocks"
          count={150}
          area={118}
          minRadius={14}
          excludeBands={[{ r: PLOT_RADIUS, w: 7 }]}
          color="#241a20"
          heightFn={terrainHeight}
          seed={0x9e1a}
          castShadow
        />
        {terra && stage > 0 && (
          <ScatterField
            kind="crystals"
            count={44}
            area={105}
            minRadius={16}
            excludeBands={[{ r: PLOT_RADIUS, w: 7 }]}
            color={bright}
            heightFn={terrainHeight}
            seed={0x9e1b}
          />
        )}

        {/* Atmosphere: drifting accent motes, low mist, and — once the assembly
            has voted the sky alive — the aurora the ballots paid for. */}
        <ParticleField mode="motes" color={terra ? bright : ROSE_SOFT} area={110} reduced={reduced} />
        <GroundMist color={mixHex(horizonHex, "#ffffff", 0.28)} opacity={0.09} area={110} reduced={reduced} />
        {terraform === "aurora" && stage > 0 && (
          <AuroraCurtain color={bright} intensity={0.25 + Math.min(1, stage / 5) * 0.35} reduced={reduced} />
        )}
        <SceneFX />

        <CinematicDescent
          from={[150, 170, 190]}
          target={[0, 3, 0]}
          duration={4}
          reduced={reduced}
          onDone={() => setIntroDone(true)}
        />
        <OrbitControls
          enabled={introDone}
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={18}
          maxDistance={Math.max(60, PLOT_RADIUS * 4.2)}
          maxPolarAngle={1.42}
          target={[0, 3, 0]}
          autoRotate={!reduced && introDone}
          autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* Screen-space finish — same scanline texture as the universe map, plus
          a faint accent vignette rising from the ground line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: `radial-gradient(ellipse at 50% 118%, ${bright}0d, transparent 55%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)" }}
      />

      <SurfaceHUD world={world} justEnacted={live.justEnacted} />
    </div>,
    document.body
  );
}
