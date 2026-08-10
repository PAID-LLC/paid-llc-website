"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BEAT_STYLE, beatFor, dwellFor, wanderOffset } from "@/lib/inhabitants/behaviour";
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
// ── Movement ────────────────────────────────────────────────────────────────
//
// The tick moves residents once every thirty minutes. Walking straight to the
// new spot and then standing perfectly still for the rest of the half hour is
// what made a city of working agents read as a diorama: the label said
// "sweeping the frontage" and the body did nothing at all.
//
// So the tick position is treated as a LEASH ANCHOR rather than a destination.
// A figure strolls inside a small radius of it, dwells, works, and moves on —
// and when the anchor itself moves, walks the whole way over. Nothing about
// what the figure MEANS is invented here; see lib/inhabitants/behaviour.ts for
// where that line sits and why.
//
// Legs and arms exist for one reason: without them, a moving figure slides.
// The gait is the cheapest possible one that reads — two rigid legs counter-
// swinging, arms opposing, and a hip bob that peaks at the passing position so
// the planted foot stays near the ground.
//
// Reduced motion sits the whole system out: figures snap to the tick position
// and hold still, exactly as before this shipped.

const ARRIVE = 0.12; // below this, treat as standing
const TURN_RATE = 0.11; // facing lerp per frame while walking
const CADENCE = 5.4; // strides per second at full pace

const DARK_MASS = "#10131a";
const BRIGHT_MASS = "#3b4551";
const VISITOR_RIM = "#5cc9ff";

/** Visitors are standing in a room, not working a district. They shift their
 *  weight and turn to watch; they do not wander off. */
const VISITOR_LEASH = 2.2;

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
  leash,
}: {
  data: InhabitantData;
  /** World-space ground height at (x, z). Flat worlds pass a constant. */
  groundY: (x: number, z: number) => number;
  scale: number;
  bright: boolean;
  reduced: boolean;
  /** How far this world lets a figure stroll from its tick position, in scene
   *  units. Anisotropic because Waypoint is a runway and Crucible is a circle. */
  leash: { x: number; z: number };
}) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const moteRef = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  const visitor = data.kind === "visitor";
  const mass = bright ? BRIGHT_MASS : DARK_MASS;
  const trim = visitor ? VISITOR_RIM : data.color;

  // Visitors watch; residents act out whatever the tick says they are doing.
  const beat = useMemo(
    () => (visitor ? "study" : beatFor(data.activity)),
    [visitor, data.activity]
  );
  const style = BEAT_STYLE[beat];

  const reach = useMemo(
    () => (visitor ? { x: VISITOR_LEASH, z: VISITOR_LEASH } : leash),
    [visitor, leash]
  );

  // Per-figure motion seed so four residents never move in lockstep.
  const phase = useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.id.length; i++) h = (h * 31 + data.id.charCodeAt(i)) >>> 0;
    return (h % 628) / 100;
  }, [data.id]);

  // Live state, carried across frames. `pos` starts unset so the first frame
  // places the figure at its true spot instead of walking it in from origin.
  const pos = useRef<{ x: number; z: number } | null>(null);
  const target = useRef<{ x: number; z: number } | null>(null);
  const anchorSeen = useRef<{ x: number; z: number } | null>(null);
  const step = useRef(0);
  const holdUntil = useRef(0);
  const facing = useRef(0);
  const gait = useRef(0);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;

    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.1); // a backgrounded tab must not teleport anyone

    // A conversation overrides the wander: the pair stand where the meeting
    // put them and look at each other until the speech falls off the feed.
    const meet = data.meet;
    const anchorX = meet ? meet.x : data.x;
    const anchorZ = meet ? meet.z : data.z;

    if (!pos.current) pos.current = { x: anchorX, z: anchorZ };
    const p = pos.current;

    if (reduced) {
      p.x = anchorX;
      p.z = anchorZ;
      root.position.set(p.x, groundY(p.x, p.z), p.z);
      body.position.y = 0;
      return;
    }

    // Did the tick (or a new conversation) move the leash? Then abandon the
    // stroll and walk to the new ground.
    const seen = anchorSeen.current;
    const moved = !seen || Math.hypot(seen.x - anchorX, seen.z - anchorZ) > 0.5;
    if (moved) {
      anchorSeen.current = { x: anchorX, z: anchorZ };
      target.current = null;
      holdUntil.current = 0;
    }

    // Pick the next spot: the meeting point exactly, or a stroll inside the
    // leash. Only ever chosen on arrival, so the walk is not re-rolled midway.
    if (!target.current) {
      if (meet) {
        target.current = { x: anchorX, z: anchorZ };
      } else {
        const [ox, oz] = wanderOffset(data.id, step.current, beat);
        target.current = { x: anchorX + ox * reach.x, z: anchorZ + oz * reach.z };
      }
    }
    const tgt = target.current;

    const dx = tgt.x - p.x;
    const dz = tgt.z - p.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > ARRIVE;

    if (walking) {
      const stepLen = Math.min(dist, style.pace * dt);
      p.x += (dx / dist) * stepLen;
      p.z += (dz / dist) * stepLen;
      holdUntil.current = 0;
    } else if (!meet) {
      // Arrived. Hold for this beat's dwell, then stroll somewhere else.
      if (holdUntil.current === 0) holdUntil.current = t + dwellFor(data.id, step.current, beat);
      else if (t >= holdUntil.current) {
        step.current += 1;
        target.current = null;
        holdUntil.current = 0;
      }
    }

    // Gait phase only advances while actually walking, so a figure that stops
    // does not carry on marching on the spot.
    if (walking) gait.current += dt * CADENCE * Math.min(1, style.pace / 2.4);
    const stride = walking ? Math.sin(gait.current + phase) : 0;

    // Hips ride highest at the passing position (legs together), which keeps
    // the planted foot near the ground without a real IK solve.
    const bob = walking
      ? (1 - Math.abs(stride)) * 0.11
      : Math.sin(t * 1.15 + phase) * 0.05;

    root.position.set(p.x, groundY(p.x, p.z), p.z);
    body.position.y = bob;

    // Face the way you are going; while stopped, face whoever you are talking
    // to, and otherwise drift slowly so a standing figure still reads as awake.
    let want: number;
    if (walking) want = Math.atan2(dx, dz);
    else if (meet) want = Math.atan2(meet.faceX - p.x, meet.faceZ - p.z);
    else want = facing.current + Math.sin(t * 0.16 + phase) * 0.004;
    facing.current = angleLerp(facing.current, want, walking || meet ? TURN_RATE : 1);
    body.rotation.y = facing.current;
    body.rotation.z = walking ? stride * 0.03 : 0;
    body.rotation.x = walking ? style.lean : 0;

    // Limbs. Walking swings them; standing runs the beat's own gesture, which
    // is what makes a stopped builder look like a builder rather than a post.
    const swing = stride * 0.62;
    const work = walking ? 0 : Math.sin(t * 2.3 + phase) * style.gesture;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.75 - work;
    if (armR.current) armR.current.rotation.x = swing * 0.75 - work * 0.7;

    if (moteRef.current) {
      moteRef.current.rotation.y = t * 0.9 + phase;
      moteRef.current.position.y = 4.16 + Math.sin(t * 1.6 + phase) * 0.07;
    }
  });

  const opacity = visitor ? 0.52 * data.dim : 1;
  const emissive = visitor ? 0.5 * data.dim : 0.55;

  // Limb material is shared between all four limbs of one figure — same mass
  // colour as the torso, so the silhouette stays one solid shape at distance.
  const limbMat = (
    <meshStandardMaterial
      color={mass}
      flatShading
      roughness={0.72}
      transparent={visitor}
      opacity={opacity}
    />
  );

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

      {/* YXZ so the yaw applies before the pitch: with the default XYZ order a
          figure walking east would lean sideways instead of forward, because
          the lean would be taken in world space rather than in its own. */}
      <group ref={bodyRef} scale={scale} rotation-order="YXZ">
        {/* Legs. Pivoted at the hip, mesh hung below the pivot, so a rotation
            on the group swings the whole leg from the top like a hinge. */}
        <group ref={legL} position={[0.34, 1.54, 0]}>
          <mesh position-y={-0.75}>
            <cylinderGeometry args={[0.23, 0.3, 1.5, 6]} />
            {limbMat}
          </mesh>
        </group>
        <group ref={legR} position={[-0.34, 1.54, 0]}>
          <mesh position-y={-0.75}>
            <cylinderGeometry args={[0.23, 0.3, 1.5, 6]} />
            {limbMat}
          </mesh>
        </group>

        {/* Hips — bridges the two legs into one mass so the figure does not
            read as a pair of stilts. */}
        <mesh position-y={1.68}>
          <cylinderGeometry args={[0.6, 0.66, 0.62, 8]} />
          {limbMat}
        </mesh>

        {/* Torso */}
        <mesh position-y={2.42}>
          <cylinderGeometry args={[0.7, 0.56, 1.02, 8]} />
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

        {/* Arms, hung from the shoulder on the same hinge trick as the legs. */}
        <group ref={armL} position={[0.78, 2.82, 0]}>
          <mesh position-y={-0.58}>
            <cylinderGeometry args={[0.16, 0.2, 1.18, 6]} />
            {limbMat}
          </mesh>
        </group>
        <group ref={armR} position={[-0.78, 2.82, 0]}>
          <mesh position-y={-0.58}>
            <cylinderGeometry args={[0.16, 0.2, 1.18, 6]} />
            {limbMat}
          </mesh>
        </group>

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

        {/* Speech: the last thing this resident said to somebody standing
            here. Sits above the nameplate so a conversation reads at a glance
            without the plate moving. */}
        {data.says ? (
          <Html position={[0, 6.15, 0]} center distanceFactor={62} occlude={false}>
            <div
              className="pointer-events-none max-w-[190px] whitespace-normal rounded-lg px-2.5 py-1.5 text-center font-sans text-[11px] leading-snug shadow-md"
              style={{
                background: bright ? "rgba(255,255,255,0.94)" : "rgba(24,24,27,0.92)",
                color: bright ? "#27272a" : "#e4e4e7",
                border: `1px solid ${trim}55`,
              }}
            >
              {data.says}
            </div>
          </Html>
        ) : null}

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
              <>
                <span className={`block max-w-[150px] whitespace-normal text-[8px] leading-tight ${bright ? "text-zinc-500" : "text-zinc-500"}`}>
                  {data.activity}
                </span>
                {/* Came in on the packet — a resident of somewhere else. */}
                {data.foreign ? (
                  <span className="block text-[8px] uppercase leading-tight tracking-[0.2em] text-amber-400/70">
                    off-world
                  </span>
                ) : null}
              </>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
}
