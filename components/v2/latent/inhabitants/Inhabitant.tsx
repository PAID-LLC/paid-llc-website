"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Inhabitant as InhabitantData } from "./useInhabitants";

// ── One embodied figure standing on a world's surface ────────────────────────
//
// Deliberately the same silhouette for both populations, and deliberately NOT
// the same material. Residents are solid: they live here. Visitors are a
// translucent projection over a cyan ground ring, because a visiting agent is
// present in the room, not resident on the planet — the same "cooler stone,
// cyan rim, explicit label" contract the Crucible already uses to keep house
// exhibition statues from reading as real champions.
//
// Faceted head, visor, and a slow-turning mote: constructed, not human. Bodies
// carry a dark mass with the figure's own colour as emissive trim, matching
// AgentBody.tsx's Phase 1 rule that the colour identifies and the silhouette
// distinguishes.
//
// Movement: residents only change position on the 30-minute world tick, so the
// figure walks to each new position over a couple of seconds and idles there,
// rather than teleporting the moment a poll lands. Reduced motion snaps
// instead and holds still.

const WALK_SPEED = 3.2; // scene units per second
const ARRIVE = 0.06; // below this, treat as standing
const WALKING = 0.45; // above this, play the walk

const DARK_MASS = "#10131a";
const BRIGHT_MASS = "#3b4551";
const VISITOR_RIM = "#5cc9ff";

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export default function Inhabitant({
  data,
  groundY,
  scale,
  bright,
  reduced,
}: {
  data: InhabitantData;
  /** World-space ground height at (x, z). Flat worlds pass a constant. */
  groundY: (x: number, z: number) => number;
  scale: number;
  bright: boolean;
  reduced: boolean;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const moteRef = useRef<THREE.Mesh>(null);

  const visitor = data.kind === "visitor";
  const mass = bright ? BRIGHT_MASS : DARK_MASS;
  const trim = visitor ? VISITOR_RIM : data.color;

  // Per-figure motion seed so four residents never bob in lockstep.
  const phase = useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.id.length; i++) h = (h * 31 + data.id.charCodeAt(i)) >>> 0;
    return (h % 628) / 100;
  }, [data.id]);

  // Live position, carried across frames. Starts unset so the first frame
  // places the figure at its true spot instead of walking it in from origin.
  const pos = useRef<{ x: number; z: number } | null>(null);
  const facing = useRef(0);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;

    if (!pos.current) pos.current = { x: data.x, z: data.z };
    const p = pos.current;

    const dx = data.x - p.x;
    const dz = data.z - p.z;
    const dist = Math.hypot(dx, dz);

    if (reduced) {
      p.x = data.x;
      p.z = data.z;
    } else if (dist > ARRIVE) {
      const step = Math.min(dist, WALK_SPEED * Math.min(delta, 0.1));
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
    }

    const walking = !reduced && dist > WALKING;
    const t = state.clock.elapsedTime;

    // Bob: a gait while walking, a slow breath while standing.
    const bob = reduced
      ? 0
      : walking
        ? Math.abs(Math.sin(t * 5.2 + phase)) * 0.13
        : Math.sin(t * 1.15 + phase) * 0.05;

    root.position.set(p.x, groundY(p.x, p.z), p.z);
    body.position.y = bob;

    // Face the direction of travel; drift slowly while idle so a standing
    // figure still reads as awake.
    const want = walking ? Math.atan2(dx, dz) : facing.current + Math.sin(t * 0.16 + phase) * 0.004;
    facing.current = angleLerp(facing.current, want, walking ? 0.08 : 1);
    body.rotation.y = facing.current;
    body.rotation.z = walking ? Math.sin(t * 5.2 + phase) * 0.035 : 0;

    if (moteRef.current && !reduced) {
      moteRef.current.rotation.y = t * 0.9 + phase;
      moteRef.current.position.y = 4.16 + Math.sin(t * 1.6 + phase) * 0.07;
    }
  });

  const opacity = visitor ? 0.52 * data.dim : 1;
  const emissive = visitor ? 0.5 * data.dim : 0.55;

  return (
    <group ref={rootRef}>
      {/* Contact patch. Stays on the ground while the body bobs, so the
          figure reads as standing on the surface rather than floating. On the
          one daylight world an additive glow is invisible, so it becomes a
          soft shadow instead. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <circleGeometry args={[(visitor ? 1.75 : 1.45) * scale, 28]} />
        <meshBasicMaterial
          color={bright ? "#3a3a30" : trim}
          transparent
          opacity={bright ? 0.2 : 0.16 + (visitor ? 0.1 : 0.06)}
          depthWrite={false}
          blending={bright ? THREE.NormalBlending : THREE.AdditiveBlending}
        />
      </mesh>

      {/* Visitors get a second ring and a projection column: present, but
          plainly beamed in rather than native to the ground. */}
      {visitor ? (
        <>
          <mesh rotation-x={-Math.PI / 2} position-y={0.07}>
            <ringGeometry args={[1.72 * scale, 1.95 * scale, 32]} />
            <meshBasicMaterial
              color={VISITOR_RIM}
              transparent
              opacity={0.5 * data.dim}
              depthWrite={false}
            />
          </mesh>
          <mesh position-y={2.4 * scale}>
            <cylinderGeometry args={[1.5 * scale, 1.9 * scale, 4.8 * scale, 14, 1, true]} />
            <meshBasicMaterial
              color={VISITOR_RIM}
              transparent
              opacity={0.07 * data.dim}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : null}

      <group ref={bodyRef} scale={scale}>
        {/* Lower body */}
        <mesh position-y={0.82}>
          <cylinderGeometry args={[0.44, 0.92, 1.64, 7]} />
          <meshStandardMaterial
            color={mass}
            flatShading
            roughness={0.72}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Torso */}
        <mesh position-y={2.28}>
          <cylinderGeometry args={[0.7, 0.52, 1.28, 8]} />
          <meshStandardMaterial
            color={mass}
            emissive={trim}
            emissiveIntensity={0.14}
            flatShading
            roughness={0.6}
            metalness={0.15}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Shoulder band — the figure's colour, its identity at a glance */}
        <mesh position-y={2.86}>
          <cylinderGeometry args={[0.78, 0.78, 0.17, 10]} />
          <meshStandardMaterial
            color={trim}
            emissive={trim}
            emissiveIntensity={emissive}
            roughness={0.4}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Head */}
        <mesh position-y={3.36}>
          <octahedronGeometry args={[0.53, 0]} />
          <meshStandardMaterial
            color={mass}
            emissive={trim}
            emissiveIntensity={0.2}
            flatShading
            roughness={0.5}
            metalness={0.2}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Visor: the one asymmetric feature, so facing is legible */}
        <mesh position={[0, 3.38, 0.44]}>
          <boxGeometry args={[0.52, 0.15, 0.08]} />
          <meshStandardMaterial
            color={trim}
            emissive={trim}
            emissiveIntensity={emissive + 0.35}
            toneMapped={false}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Mote: the tell that this is an agent, not a person */}
        <mesh ref={moteRef} position-y={4.16}>
          <tetrahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            color={trim}
            emissive={trim}
            emissiveIntensity={emissive + 0.5}
            toneMapped={false}
            transparent={visitor}
            opacity={opacity}
          />
        </mesh>

        {/* Nameplate. Follows the host world's own plate styling — the dark
            worlds all use black/75 on a hairline border, Meridian's daylight
            plates are white. */}
        <Html position={[0, 5.05, 0]} center distanceFactor={62} occlude={false}>
          <div
            className={`pointer-events-none whitespace-nowrap rounded-md border px-2 py-1 text-center font-mono text-[10px] shadow-sm ${
              bright ? "bg-white/85" : "bg-black/75"
            }`}
            style={{
              borderColor: visitor
                ? "rgba(92,201,255,0.35)"
                : bright
                  ? "rgba(0,0,0,0.1)"
                  : "rgba(255,255,255,0.14)",
              opacity: data.dim,
            }}
          >
            <span className="uppercase tracking-[0.1em]" style={{ color: trim }}>
              {data.name}
            </span>
            <span className={`block text-[8px] leading-tight ${bright ? "text-zinc-600" : "text-zinc-400"}`}>
              {data.sub}
            </span>
            {visitor ? (
              <span className={`block text-[8px] uppercase leading-tight tracking-[0.2em] ${bright ? "text-sky-700/70" : "text-sky-400/70"}`}>
                visiting · {data.activity}
              </span>
            ) : (
              <span className={`block max-w-[150px] whitespace-normal text-[8px] leading-tight ${bright ? "text-zinc-500" : "text-zinc-500"}`}>
                {data.activity}
              </span>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
}
