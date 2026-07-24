"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import { CONCOURSE, CONTROL_TOWER, FRAME } from "@/lib/waypoint/cityplan";
import type { WaypointSnapshot } from "@/lib/waypoint/data";
import type { GateStructure } from "@/lib/waypoint/cityplan";
import {
  CinematicDescent, GroundMist, NexusStar, ParticleField, Pulse, SceneFX, TrailLine, mixHex,
} from "@/components/v2/latent/ground-fx";

// ── Waypoint PORT: the comprehensive 3D read ─────────────────────────────────
// Third city-class world (after Arclight, Meridian), with its own distinct
// urban form: a linear port strip along a spaceport axis, not a grid or a
// radial. Every gate's color echoes its source world's own already-shipped
// accent (planet-config.ts's cityLights values, untouched here -- these are
// local constants, same as every prior world's canvas file) so a visitor
// recognizes each berth as "that world's gate" at a glance.

const SCALE = 0.45;
const TARMAC = "#0b0d14";
const BRANCH_DEPTH = 13;

function worldX(x: number): number {
  return (x - (CONCOURSE.x1 + CONCOURSE.x2) / 2) * SCALE;
}

const GATE_COLOR: Record<GateStructure["id"], string> = {
  frontier: "#f472b6",
  deep: "#7dd3fc",
  bazaar: "#fbbf24",
  archive: "#c4b5fd",
  vault: "#fff4dc",
  pit: "#ff6a33",
  forge: "#7de3f4",
};

function statusIntensity(status: GateStructure["status"]): number {
  if (status === "lit") return 1;
  if (status === "boarding") return 0.45;
  return 0.12;
}

function Tarmac() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
      <planeGeometry args={[FRAME.w * SCALE + 60, 90]} />
      <meshStandardMaterial color={TARMAC} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function ConcourseSpine() {
  return (
    <>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[(CONCOURSE.x2 - CONCOURSE.x1) * SCALE, 0.06, 3]} />
        <meshStandardMaterial color="#1c2230" emissive="#ffdf9e" emissiveIntensity={0.25} roughness={0.5} />
      </mesh>
    </>
  );
}

function ControlTower({ reduced }: { reduced: boolean }) {
  const x = worldX(CONTROL_TOWER.x);
  return (
    <group position={[x, 0, 0]}>
      <mesh position-y={7}>
        <cylinderGeometry args={[1.4, 2.2, 14, 8]} />
        <meshStandardMaterial color="#232838" emissive="#ffb35c" emissiveIntensity={0.25} roughness={0.5} metalness={0.3} />
      </mesh>
      <NexusStar position={[x, 15.5, 0]} radius={2.4} reduced={reduced} />
      <Html position={[x, 19.5, 0]} center distanceFactor={65} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-amber-900/40 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-100">
          Control Tower
        </div>
      </Html>
    </group>
  );
}

function Gate({ gate, showLabel, reduced }: { gate: GateStructure; showLabel: boolean; reduced: boolean }) {
  const color = GATE_COLOR[gate.id];
  const intensity = statusIntensity(gate.status);
  const zSign = gate.side === "north" ? -1 : 1;
  const x = worldX(gate.x);
  const z = zSign * BRANCH_DEPTH;

  const berth = (
    <mesh position={[x, 1.6, z]}>
      <boxGeometry args={[7, 3.2, 6]} />
      <meshStandardMaterial color="#161b26" emissive={color} emissiveIntensity={0.2 + intensity * 0.6} roughness={0.55} metalness={0.25} />
    </mesh>
  );

  return (
    <group>
      <TrailLine
        a={[x, 0]}
        b={[x, z * 0.55]}
        color={color}
        heightFn={() => 0.15}
        opacity={0.25 + intensity * 0.35}
        wobble={0.6}
        seed={gate.x}
      />
      {intensity > 0.3 ? (
        <Pulse speed={1.4} amp={0.06} reduced={reduced}>
          {berth}
        </Pulse>
      ) : (
        berth
      )}
      {showLabel && (
        <Html position={[x, 4.6, z]} center distanceFactor={58} occlude={false}>
          <div className="pointer-events-none max-w-[190px] whitespace-normal rounded-md border border-white/10 bg-black/75 px-2 py-1 text-center font-mono text-[9px] shadow-sm" style={{ color }}>
            <div className="uppercase tracking-[0.1em] opacity-80">{gate.name}</div>
            <div className="mt-0.5 text-white/90">{gate.headline}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function WaypointPortCanvas({ state, reduced }: { state: WaypointSnapshot; reduced: boolean }) {
  const [introDone, setIntroDone] = useState(false);
  const traffic = state.traffic.level;
  const ambient = mixHex("#3a3550", "#ffdf9e", state.arrivals_level);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 90, 170], fov: 50, near: 0.5, far: 1200 }}
    >
      <color attach="background" args={[TARMAC]} />
      <fog attach="fog" args={[TARMAC, 180, 620]} />
      <hemisphereLight args={["#fff3d6", "#04060c", 0.45]} />
      <ambientLight color="#ffdf9e" intensity={0.3} />
      <directionalLight color="#e4e4e7" intensity={0.9 + traffic * 0.4} position={[-140, 160, 100]} />

      <Stars radius={380} depth={80} count={2000} factor={2.2} fade speed={0.25} />

      <Tarmac />
      <ConcourseSpine />
      <ControlTower reduced={reduced} />

      {state.city.gates.map((g, i) => (
        <Gate key={g.id} gate={g} showLabel={i < 7} reduced={reduced} />
      ))}

      <GroundMist color="#ffdf9e" opacity={0.05 + traffic * 0.08} area={220} reduced={reduced} />
      <ParticleField mode="motes" color={ambient} area={160} reduced={reduced} />
      <SceneFX bloom={0.4 + traffic * 0.25} />

      <CinematicDescent
        from={[300, 220, 340]}
        target={[0, 4, 0]}
        duration={4}
        reduced={reduced}
        onDone={() => setIntroDone(true)}
      />
      <OrbitControls
        enabled={introDone}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={30}
        maxDistance={360}
        maxPolarAngle={1.45}
        target={[0, 4, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.12}
      />
    </Canvas>
  );
}
