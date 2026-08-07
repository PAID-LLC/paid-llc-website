"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  AGORA_RADIUS,
  MERIDIAN_SEED,
  WARD_ANGLE_DEG,
  buildGreenRingKit,
  buildWardKit,
  obeliskHeight,
  polar,
  ringColor,
  spireBoost,
  structureScale,
  wardAnchor,
  type WardBuilding,
} from "@/lib/meridian/skyline";
import { WARDS, type MeridianCitizenRow, type MeridianStructureRow, type Ward } from "@/lib/meridian/engine";
import {
  CinematicDescent, CloudBand, GroundSky, ParticleField, Pulse, SceneFX,
} from "@/components/v2/latent/ground-fx";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";
import type { MeridianData } from "@/lib/meridian/engine";

// ── Meridian CITY: the comprehensive 3D read ─────────────────────────────────
// The portfolio's one bright world — a radial glass-spire garden city under
// warm daylight. Geometry comes from the pure skyline lib (six wards fixed
// forever, hand-authored macro + seeded micro); the only things live data
// ever changes are height (structure level, Spire Row's prosperity boost),
// glow (the Agora obelisk), and the outer Green Ring's color, which breathes
// with the prosperity index exactly the way Substrate's weather used to.

const GLASS = "#e8f0ec";
const GLASS_WARM = "#fff4dc";
const WARD_TINT: Record<Ward, string> = {
  spire_row: "#dbe7f5",
  ledger_house: "#e4ded0",
  archive: "#f2e9d6",
  atelier: "#f3c9c9",
  yards: "#d8ddd0",
  commons: "#cdeccf",
};

function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow={false}>
      <circleGeometry args={[95, 96]} />
      <meshStandardMaterial color="#e9e4d2" roughness={0.95} />
    </mesh>
  );
}

function AgoraObelisk({ prosperityIndex, reduced }: { prosperityIndex: number; reduced: boolean }) {
  const h = obeliskHeight(prosperityIndex);
  const glow = 0.3 + (Math.max(0, Math.min(100, prosperityIndex)) / 100) * 0.9;
  return (
    <group>
      <mesh position-y={0.6} receiveShadow>
        <cylinderGeometry args={[AGORA_RADIUS, AGORA_RADIUS * 1.2, 1.2, 24]} />
        <meshStandardMaterial color="#ede7d6" roughness={0.8} />
      </mesh>
      <Pulse speed={0.6} amp={0.02} reduced={reduced}>
        <mesh position-y={1.2 + h / 2}>
          <cylinderGeometry args={[0.4, 1.6, h, 8]} />
          <meshStandardMaterial color={GLASS_WARM} emissive="#f2c879" emissiveIntensity={glow} roughness={0.25} metalness={0.2} />
        </mesh>
      </Pulse>
      <Html position={[0, h + 3.5, 0]} center distanceFactor={50} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-black/10 bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-700 shadow-sm">
          the Agora
        </div>
      </Html>
    </group>
  );
}

function WardBuildingBox({ b, scale, tint, glassColor }: { b: WardBuilding; scale: number; tint: string; glassColor: string }) {
  const h = b.baseH * scale;
  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.rotY}>
      <mesh position-y={h / 2}>
        <boxGeometry args={[b.w, h, b.d]} />
        <meshStandardMaterial color={tint} roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position-y={h + 0.15}>
        <boxGeometry args={[b.w * 0.94, 0.3, b.d * 0.94]} />
        <meshStandardMaterial color={glassColor} emissive={glassColor} emissiveIntensity={0.25} roughness={0.15} metalness={0.4} />
      </mesh>
    </group>
  );
}

function WardLandmark({ ward, radius, angle }: { ward: Ward; radius: number; angle: number }) {
  const [x, z] = polar(radius, angle);
  if (ward === "archive") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={2}>
          <cylinderGeometry args={[3.2, 3.4, 4, 20]} />
          <meshStandardMaterial color="#f2e9d6" roughness={0.7} />
        </mesh>
        <mesh position-y={4.6}>
          <sphereGeometry args={[3.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fff8e8" roughness={0.3} metalness={0.15} />
        </mesh>
      </group>
    );
  }
  if (ward === "yards") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={5}>
          <cylinderGeometry args={[0.6, 0.6, 10, 8]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position-y={10}>
          <boxGeometry args={[4, 0.5, 1]} />
          <meshStandardMaterial color="#d8ddd0" roughness={0.5} />
        </mesh>
      </group>
    );
  }
  if (ward === "commons") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={0.6}>
          <boxGeometry args={[6, 1.2, 6]} />
          <meshStandardMaterial color="#cdeccf" roughness={0.85} />
        </mesh>
        <mesh position-y={1.8}>
          <boxGeometry args={[4.4, 1.2, 4.4]} />
          <meshStandardMaterial color="#b7e0ba" roughness={0.85} />
        </mesh>
      </group>
    );
  }
  return null;
}

function WardBuildings({ ward, level, prosperityIndex }: { ward: Ward; level: 1 | 2 | 3; prosperityIndex: number }) {
  const kit = useMemo(() => buildWardKit(ward), [ward]);
  const scale = structureScale(level) * (ward === "spire_row" ? spireBoost(prosperityIndex) : 1);
  const tint = WARD_TINT[ward];
  const glassColor = ward === "spire_row" || ward === "ledger_house" ? GLASS : GLASS_WARM;
  return (
    <group>
      {kit.map((b, i) => (
        <WardBuildingBox key={i} b={b} scale={scale} tint={tint} glassColor={glassColor} />
      ))}
      <WardLandmark ward={ward} radius={(15 + 52) / 2} angle={WARD_ANGLE_DEG[ward]} />
    </group>
  );
}

function GreenRing({ prosperityIndex, reduced }: { prosperityIndex: number; reduced: boolean }) {
  const color = ringColor(prosperityIndex);
  const trees = useMemo(() => buildGreenRingKit(), []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    trees.forEach((t, i) => {
      m.position.set(t.x, 1.4, t.z);
      m.scale.set(t.scale, t.scale * t.heightScale, t.scale);
      m.rotation.y = t.rotY;
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <Pulse speed={0.3} amp={reduced ? 0 : 0.01} reduced={reduced}>
      <instancedMesh ref={ref} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[0.9, 2.6, 6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </instancedMesh>
    </Pulse>
  );
}

function CitizenMarker({ citizen, reduced }: { citizen: MeridianCitizenRow; reduced: boolean }) {
  const [x, z] = wardAnchor(citizen.ward);
  return (
    <group position={[x, 0, z]}>
      <Pulse speed={1.4} amp={0.12} reduced={reduced}>
        <mesh position-y={2.4}>
          <sphereGeometry args={[0.55, 16, 12]} />
          <meshStandardMaterial color={citizen.color} emissive={citizen.color} emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
      </Pulse>
      <Html position={[0, 4.4, 0]} center distanceFactor={48} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-black/10 bg-white/85 px-2 py-1 font-mono text-[10px] text-zinc-700 shadow-sm">
          <span className="uppercase tracking-[0.1em]" style={{ color: citizen.color }}>{citizen.name}</span>
          {" "}<span className="text-zinc-500">{citizen.epithet}</span>
          <br />
          <span className="text-zinc-500">stake {citizen.stake.toFixed(0)} &middot; {citizen.status}</span>
        </div>
      </Html>
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function MeridianCityCanvas({ state, reduced }: { state: MeridianData; reduced: boolean }) {
  const structureByWard = useMemo(
    () => new Map(state.structures.map((s) => [s.ward_kind, s])),
    [state.structures]
  );
  const [introDone, setIntroDone] = useState(false);
  const index = state.clock.prosperityIndex;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [130, 95, 155], fov: 50, near: 0.5, far: 1200 }}
    >
      <color attach="background" args={["#dce8f0"]} />
      <fog attach="fog" args={["#dce8f0", 160, 620]} />
      <hemisphereLight args={["#fff6e0", "#cfe0d6", 0.75]} />
      <ambientLight color="#fff2d8" intensity={0.35} />
      <directionalLight color="#ffdca0" intensity={1.1} position={[-180, 160, 120]} />

      <GroundSky zenith="#a9cdea" horizon="#fbe6c2" glow="#ffdca0" glowStrength={0.5} radius={420} />
      <CloudBand color="#ffffff" opacity={0.35} radius={280} y={90} height={40} reduced={reduced} />

      <Ground />
      <AgoraObelisk prosperityIndex={index} reduced={reduced} />

      {WARDS.map((ward) => {
        const structure: MeridianStructureRow | undefined = structureByWard.get(ward);
        return (
          <WardBuildings
            key={ward}
            ward={ward}
            level={structure?.level ?? 1}
            prosperityIndex={index}
          />
        );
      })}

      <GreenRing prosperityIndex={index} reduced={reduced} />

      {state.citizens.map((c) => (
        <CitizenMarker key={c.name} citizen={c} reduced={reduced} />
      ))}

      {/* Visiting agents only. Meridian simulates its own citizens and is out
          of scope for the resident layer, so nobody here is a resident. */}
      <Inhabitants world="meridian" reduced={reduced} />

      <ParticleField mode="motes" color="#fff6d8" area={200} reduced={reduced} />
      <SceneFX bloom={0.35} />

      <CinematicDescent
        from={[300, 220, 360]}
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
        minDistance={24}
        maxDistance={340}
        maxPolarAngle={1.45}
        target={[0, 4, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}

// Referenced for the seed-fixed macro geometry contract; re-exported so tests
// importing this module's neighbors can confirm the same seed is in play.
export const MERIDIAN_CANVAS_SEED = MERIDIAN_SEED;
