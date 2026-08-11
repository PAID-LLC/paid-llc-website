"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  AGORA_RADIUS,
  GROUND_RADIUS,
  MERIDIAN_SEED,
  TREE_HEIGHT,
  TREE_RADIUS,
  WARD_ANGLE_DEG,
  WARD_INNER,
  WARD_OUTER,
  buildGreenRingKit,
  buildWardKit,
  obeliskHeight,
  polar,
  ringColor,
  spireBoost,
  structureScale,
  treeHeight,
  wardAnchor,
  type WardBuilding,
} from "@/lib/meridian/skyline";
import { WARDS, type MeridianCitizenRow, type MeridianStructureRow, type Ward } from "@/lib/meridian/engine";
import {
  CinematicDescent, CloudBand, GroundSky, ParticleField, Pulse,
} from "@/components/v2/latent/ground-fx";
import { SkyEnvironment, WorldFX } from "@/components/v2/latent/world-kit";
import { useMeridianSurfaces, type MeridianSurfaces } from "@/components/v2/latent/meridian/surfaces";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";
import type { MeridianData } from "@/lib/meridian/engine";

// ── Meridian CITY: the comprehensive 3D read ─────────────────────────────────
// The portfolio's one bright world — a radial glass-spire garden city under
// warm daylight. Geometry comes from the pure skyline lib (six wards fixed
// forever, hand-authored macro + seeded micro); the only things live data
// ever changes are height (structure level, Spire Row's prosperity boost),
// glow (the Agora obelisk), and the outer Green Ring's color, which breathes
// with the prosperity index exactly the way Substrate's weather used to.

/** Frame ratio from the pre-2026-08-11 city, applied to everything that has to
 *  track the city's size: camera, fog, cloud deck, particles, label scale. */
const FRAME = 1.371;

function Ground({ sf }: { sf: MeridianSurfaces }) {
  return (
    <group>
      {/* The country the city stands in.
          Meridian's only ground used to be the paved disc, so the city sat on a
          coin in an empty void and read as a tabletop model no matter how good
          the buildings got — there was no horizon anywhere in the frame, and a
          horizon is what tells you a world continues past what you can see.
          This runs out to the fog's far distance so the two resolve into each
          other instead of ending at a visible edge. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.7} receiveShadow material={sf.plain}>
        <circleGeometry args={[1150, 64]} />
      </mesh>
      {/* The plaza, a shallow terrace above it. The 0.65 step is deliberate:
          two ground planes at the same height would z-fight across the whole
          city, and a civic plaza raised a little above its landscape is right
          anyway. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow material={sf.plaza}>
        <circleGeometry args={[GROUND_RADIUS, 96]} />
      </mesh>
      <mesh position-y={-0.375} material={sf.civic}>
        <cylinderGeometry args={[GROUND_RADIUS, GROUND_RADIUS, 0.65, 96, 1, true]} />
      </mesh>
    </group>
  );
}

function AgoraObelisk({
  prosperityIndex,
  reduced,
  sf,
}: {
  prosperityIndex: number;
  reduced: boolean;
  sf: MeridianSurfaces;
}) {
  const h = obeliskHeight(prosperityIndex);
  const glow = 0.3 + (Math.max(0, Math.min(100, prosperityIndex)) / 100) * 0.9;
  return (
    <group>
      <mesh position-y={1.25} receiveShadow castShadow material={sf.civic}>
        <cylinderGeometry args={[AGORA_RADIUS, AGORA_RADIUS * 1.2, 2.5, 32]} />
      </mesh>
      <Pulse speed={0.6} amp={0.02} reduced={reduced}>
        <mesh position-y={2.5 + h / 2}>
          <cylinderGeometry args={[1.1, 4.2, h, 8]} />
          <meshStandardMaterial
            color="#fff4dc"
            emissive="#f2c879"
            emissiveIntensity={glow}
            roughness={0.25}
            metalness={0.2}
          />
        </mesh>
      </Pulse>
      <Html position={[0, h + 9, 0]} center distanceFactor={50 * FRAME} occlude={false}>
        <div className="pointer-events-none whitespace-nowrap rounded-md border border-black/10 bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-700 shadow-sm">
          the Agora
        </div>
      </Html>
    </group>
  );
}

function WardBuildingBox({
  b,
  scale,
  body,
  cap,
}: {
  b: WardBuilding;
  scale: number;
  body: THREE.Material;
  cap: THREE.Material;
}) {
  const h = b.baseH * scale;
  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.rotY}>
      <mesh position-y={h / 2} material={body} castShadow receiveShadow>
        <boxGeometry args={[b.w, h, b.d]} />
      </mesh>
      {/* The glazed roof band. Seated 0.1 INTO the body rather than floating
          above it: two coplanar horizontal faces give the depth buffer no
          ordering and flicker per pixel under the orbiting camera, which is
          exactly what had to be fixed across Palimpsest's rooftops. */}
      <mesh position-y={h + 0.35} material={cap} castShadow>
        <boxGeometry args={[b.w * 0.94, 0.9, b.d * 0.94]} />
      </mesh>
    </group>
  );
}

// Landmarks tripled with the frame. At the old sizes the Archive's rotunda was
// 6.4 units across in a ward whose halls are now 15-23 wide — the monument was
// smaller than the buildings it was supposed to crown.
function WardLandmark({
  ward,
  radius,
  angle,
  sf,
}: {
  ward: Ward;
  radius: number;
  angle: number;
  sf: MeridianSurfaces;
}) {
  const [x, z] = polar(radius, angle);
  if (ward === "archive") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={6.5} material={sf.civic} castShadow receiveShadow>
          <cylinderGeometry args={[10, 10.6, 13, 28]} />
        </mesh>
        {/* Seated below the drum top for the same z-fighting reason as the
            building caps: a dome resting exactly ON the rim shares a face. */}
        <mesh position-y={12.6} material={sf.cap} castShadow>
          <sphereGeometry args={[10, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    );
  }
  if (ward === "yards") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={15} material={sf.civic} castShadow>
          <cylinderGeometry args={[1.2, 1.4, 30, 10]} />
        </mesh>
        <mesh position-y={28.5} material={sf.body.yards} castShadow>
          <boxGeometry args={[16, 1.7, 3]} />
        </mesh>
      </group>
    );
  }
  if (ward === "commons") {
    return (
      <group position={[x, 0, z]}>
        <mesh position-y={1.8} material={sf.body.commons} castShadow receiveShadow>
          <boxGeometry args={[18, 3.6, 18]} />
        </mesh>
        <mesh position-y={5.2} material={sf.body.commons} castShadow>
          <boxGeometry args={[13, 3.6, 13]} />
        </mesh>
      </group>
    );
  }
  return null;
}

function WardBuildings({
  ward,
  level,
  prosperityIndex,
  sf,
}: {
  ward: Ward;
  level: 1 | 2 | 3;
  prosperityIndex: number;
  sf: MeridianSurfaces;
}) {
  const kit = useMemo(() => buildWardKit(ward), [ward]);
  const scale = structureScale(level) * (ward === "spire_row" ? spireBoost(prosperityIndex) : 1);
  const body = sf.body[ward];
  const cap = ward === "spire_row" || ward === "ledger_house" ? sf.cap : sf.capWarm;
  return (
    <group>
      {kit.map((b, i) => (
        <WardBuildingBox key={i} b={b} scale={scale} body={body} cap={cap} />
      ))}
      <WardLandmark ward={ward} radius={(WARD_INNER + WARD_OUTER) / 2} angle={WARD_ANGLE_DEG[ward]} sf={sf} />
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
      // A cone is positioned by its CENTRE, so seating it on the ground means
      // half its own scaled height. The old fixed 1.4 sank every tree by up to
      // a third of its trunk, which at the old sizes was small enough to read
      // as undergrowth and is not at the new ones.
      m.position.set(t.x, treeHeight(t) / 2, t.z);
      m.scale.set(t.scale, t.scale * t.heightScale, t.scale);
      m.rotation.y = t.rotY;
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <Pulse speed={0.3} amp={reduced ? 0 : 0.01} reduced={reduced}>
      <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <coneGeometry args={[TREE_RADIUS, TREE_HEIGHT, 7]} />
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
        <mesh position-y={7}>
          <sphereGeometry args={[1.6, 20, 14]} />
          <meshStandardMaterial color={citizen.color} emissive={citizen.color} emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
      </Pulse>
      <Html position={[0, 12, 0]} center distanceFactor={48 * FRAME} occlude={false}>
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
  const sf = useMeridianSurfaces(reduced);

  return (
    <Canvas
      dpr={[1, 1.75]}
      // The one world in the portfolio that earns a shadow map. Seven night
      // worlds are lit by lamps whose shadows would be a mess of overlapping
      // penumbrae; this one has a sun. Cast shadows are also the single
      // strongest cue that a building is standing ON the ground rather than
      // floating above a picture of it, which is exactly what made the old
      // Meridian read as a tabletop model.
      shadows
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [178, 130, 212], fov: 50, near: 0.5, far: 1650 }}
    >
      <color attach="background" args={["#dce8f0"]} />
      {/* Fog starts BEYOND the city, not through it.
          The old values put near at 160 with the camera 223 out from a
          70-radius city, which meant every building sat inside the fog ramp and
          the whole world rendered through milk — measured at 226/255 mean
          luminance with nothing below 128. Daylight haze belongs on the horizon;
          a city you are looking straight at should be crisp. Near sits past the
          far rim (camera ~306 out, city ~96 radius) so only the sky ramps. */}
      <fog attach="fog" args={["#dce8f0", 430, 1400]} />

      {/* The daylight sky, twice: once invisible as the light source, once
          visible as the backdrop. The values are deliberately identical — a
          world whose reflections disagree with its own sky reads as a
          compositing error even when nobody can say why. */}
      <SkyEnvironment
        top="#a9cdea"
        horizon="#fbe6c2"
        ground="#9aa06d"
        glow="#ffdca0"
        intensity={0.85}
      />

      {/* Fills cut hard, because the environment map now does the work the old
          hemisphere + ambient pair was faking. Left at 0.75/0.35 alongside an
          IBL this bright, the city would flatten into white card. The
          directional stays strong: it is the sun, and directional shading is
          what stops daylight reading as an overcast product shot. */}
      <hemisphereLight args={["#fff6e0", "#cfe0d6", 0.18]} />
      <ambientLight color="#fff2d8" intensity={0.06} />
      <directionalLight
        color="#ffdca0"
        intensity={1.15}
        position={[-180, 160, 120]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        // An orthographic sun. The box has to contain the whole city or
        // buildings outside it cast nothing and silently un-ground themselves.
        shadow-camera-left={-125}
        shadow-camera-right={125}
        shadow-camera-top={125}
        shadow-camera-bottom={-125}
        shadow-camera-near={1}
        shadow-camera-far={620}
        shadow-bias={-0.0006}
      />

      <GroundSky zenith="#a9cdea" horizon="#fbe6c2" glow="#ffdca0" glowStrength={0.5} radius={575} />
      <CloudBand color="#ffffff" opacity={0.35} radius={384} y={123} height={55} reduced={reduced} />

      <Ground sf={sf} />
      <AgoraObelisk prosperityIndex={index} reduced={reduced} sf={sf} />

      {WARDS.map((ward) => {
        const structure: MeridianStructureRow | undefined = structureByWard.get(ward);
        return (
          <WardBuildings
            key={ward}
            ward={ward}
            level={structure?.level ?? 1}
            prosperityIndex={index}
            sf={sf}
          />
        );
      })}

      <GreenRing prosperityIndex={index} reduced={reduced} />

      {state.citizens.map((c) => (
        <CitizenMarker key={c.name} citizen={c} reduced={reduced} />
      ))}

      {/* Visiting agents only. Meridian simulates its own citizens and is out
          of scope for the resident layer, so nobody here is a resident. */}
      <Inhabitants world="meridian" reduced={reduced} intensity={index / 100} />

      <ParticleField mode="motes" color="#fff6d8" area={274} reduced={reduced} />
      {/* The lightest grade in the table, and it was going unused: Meridian is
          the portfolio's deliberate counterweight to seven night worlds, and
          heavy post here would undo the exact thing that makes it one. */}
      <WorldFX world="meridian" reduced={reduced} />

      <CinematicDescent
        from={[411, 302, 494]}
        target={[0, 6, 0]}
        duration={4}
        reduced={reduced}
        onDone={() => setIntroDone(true)}
      />
      <OrbitControls
        enabled={introDone}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={33}
        maxDistance={466}
        maxPolarAngle={1.45}
        target={[0, 6, 0]}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}

// Referenced for the seed-fixed macro geometry contract; re-exported so tests
// importing this module's neighbors can confirm the same seed is in play.
export const MERIDIAN_CANVAS_SEED = MERIDIAN_SEED;
