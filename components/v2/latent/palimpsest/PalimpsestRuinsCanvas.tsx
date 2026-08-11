"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import {
  VAULT_POS,
  buildPrecursorHistory,
  type DigSite,
} from "@/lib/palimpsest/history";
import {
  PIT_DEPTH,
  WORLD_SCALE,
  buildRubble,
  buildRuinField,
  duneHeight,
  toWorld,
  trailWorld,
  type SiteRuin,
} from "@/lib/palimpsest/terrain";
import {
  CinematicDescent, GlyphPlaque, GroundMist, MilkyWayBackdrop, ParticleField,
  Pulse, SkyWorld,
} from "@/components/v2/latent/ground-fx";
import { SkyEnvironment, WorldFX } from "@/components/v2/latent/world-kit";
import { usePalimpsestSurfaces, type PalimpsestSurfaces } from "./surfaces";
import Inhabitants from "@/components/v2/latent/inhabitants/Inhabitants";
import { CAMERA } from "@/lib/palimpsest/campus";
import Campus from "./Campus";
import type { PalimpsestState } from "./usePalimpsestLive";

// ── Palimpsest RUINS: the comprehensive 3D read ──────────────────────────────
// The buried library-city as a dune sea under a parchment moon. Same contract
// as the 2D dig map: geometry comes from the pure history + terrain libs, the
// reveal comes from the live excavation state, and nothing here invents
// anything — a buried site is a mound with column tips breaking the dust; an
// excavated site is an open pit of standing ruin with its translator's plaque.
//
// 2026-08-10: the field school. The dig has been eighteen-nineteenths buried
// for a month — one thesis, one open site — so a world that modelled only the
// excavation was honest and nearly empty. The campus models the people doing
// the digging instead, and draws its population and its posted text from data
// that exists in volume today. The dig itself is untouched: same mounds, same
// gate, same silence out in the dunes. What changed is that there is now
// somewhere the scholars come back to.

const AMBER = "#d9a441";
const AMBER_BRIGHT = "#f0c05a";
const SAND = "#cbb27e";
// Stone and dust colours now live in the surface materials (./surfaces), not
// here — only the dig trail still needs a flat colour of its own.
const BURIED_STONE = "#4a3d2a";
const PIT_WALL = "#2a2114";
const PIT_FLOOR = "#332818";

// The opening camera lives in lib/palimpsest/campus, not here.
//
// Nothing in the build environment can composite a frame, so the shot was
// solved by projecting the campus corners through it rather than by looking at
// it, and that projection is asserted in tests. Keeping the numbers in the pure
// module is what lets those tests exist — a camera defined in the component
// would silently drift away from the composition they check.
const CAMPUS_VIEW = CAMERA.target as unknown as [number, number, number];
const CAMPUS_CAM = CAMERA.pos as unknown as [number, number, number];

// ── Ground ───────────────────────────────────────────────────────────────────

function DarkBed() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-2.4}>
      <planeGeometry args={[1100, 950]} />
      <meshStandardMaterial color="#0b0806" roughness={1} />
    </mesh>
  );
}

function DustPlain({ mat }: { mat: THREE.Material }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(480, 420, 96, 84);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, duneHeight(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  // No flatShading now that the surface carries a normal map: faceting fights
  // the relief and the dunes read as origami instead of dust.
  return <mesh geometry={geometry} material={mat} />;
}

function RubbleField({ mat }: { mat: THREE.Material }) {
  const stones = useMemo(() => buildRubble(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    stones.forEach((st, i) => {
      dummy.position.set(st.x, duneHeight(st.x, st.z) + st.s * 0.3, st.z);
      dummy.rotation.set(st.ry * 0.3, st.ry, 0);
      dummy.scale.set(st.s, st.s * 0.7, st.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [stones]);
  return (
    <instancedMesh
      key={stones.length}
      ref={ref}
      args={[undefined, undefined, stones.length]}
      material={mat}
    >
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

function DigTrail() {
  const points = useMemo(
    () =>
      trailWorld().map(
        ([x, z]) => [x, duneHeight(x, z) + 0.18, z] as [number, number, number]
      ),
    []
  );
  return (
    <Line
      points={points}
      color={BURIED_STONE}
      transparent
      opacity={0.4}
      lineWidth={1}
      dashed
      dashSize={1.6}
      gapSize={3.2}
    />
  );
}

// ── Sites ────────────────────────────────────────────────────────────────────

function BuriedSite({ s, ruin, sf }: { s: DigSite; ruin: SiteRuin; sf: PalimpsestSurfaces }) {
  const [x, z] = toWorld(s.x, s.y);
  const R = s.r * WORLD_SCALE;
  return (
    <group position={[x, 0, z]}>
      {/* The mound: dust drawn over something rectilinear underneath, so it
          wears the same dust as the plain it rises out of. */}
      <mesh position-y={-R * 0.55} material={sf.dust}>
        <sphereGeometry args={[R * 0.92, 12, 8]} />
      </mesh>
      {/* Column tips breaking the surface — the tell that this is a site. */}
      {ruin.columns.slice(0, 3).map((c, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(c.a) * c.rf * R * 0.8,
            0.28 + (c.h % 0.5),
            Math.sin(c.a) * c.rf * R * 0.8,
          ]}
          material={sf.ruinDark}
        >
          <cylinderGeometry args={[0.2, 0.24, 0.9, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function OpenSite({
  s,
  ruin,
  credit,
  withLight,
  reduced,
  sf,
}: {
  s: DigSite;
  ruin: SiteRuin;
  credit: { agent_name: string } | null;
  withLight: boolean;
  reduced: boolean;
  sf: PalimpsestSurfaces;
}) {
  const [x, z] = toWorld(s.x, s.y);
  const R = s.r * WORLD_SCALE;
  return (
    <group position={[x, 0, z]}>
      {/* The pit: inner wall and floor, sunk below the dust. */}
      <mesh position-y={-PIT_DEPTH / 2}>
        <cylinderGeometry args={[R, R, PIT_DEPTH, 24, 1, true]} />
        <meshStandardMaterial color={PIT_WALL} side={THREE.BackSide} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-PIT_DEPTH + 0.02}>
        <circleGeometry args={[R, 24]} />
        <meshStandardMaterial color={PIT_FLOOR} roughness={1} />
      </mesh>
      {/* Standing (and broken) columns of the revealed hall. */}
      {ruin.columns.map((c, i) => {
        const h = c.broken ? c.h * 0.45 : c.h;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(c.a) * c.rf * R * 0.8,
              h / 2 - PIT_DEPTH,
              Math.sin(c.a) * c.rf * R * 0.8,
            ]}
            material={sf.ruin}
          >
            <cylinderGeometry args={[0.2, 0.26, h, 6]} />
          </mesh>
        );
      })}
      {/* Wall remnants along the pit edge. */}
      {ruin.walls.map((w, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(w.a) * R * 0.82,
            w.h / 2 - PIT_DEPTH,
            Math.sin(w.a) * R * 0.82,
          ]}
          rotation-y={-w.a + Math.PI / 2}
          material={sf.ruin}
        >
          <boxGeometry args={[w.lenf * R * 0.9, w.h, 0.3]} />
        </mesh>
      ))}
      {/* Fallen slabs on the floor. */}
      {ruin.slabs.map((sl, i) => (
        <mesh
          key={i}
          position={[sl.dxf * R, -PIT_DEPTH + 0.12, sl.dzf * R]}
          rotation-y={sl.ry}
          material={sf.ruinDark}
        >
          <boxGeometry args={[sl.lenf * R, 0.18, 0.55]} />
        </mesh>
      ))}
      {/* The glyph stone: what the dig was for. */}
      <Pulse speed={0.9} amp={0.06} reduced={reduced}>
        <mesh position-y={0.7 - PIT_DEPTH}>
          <boxGeometry args={[0.55, 1.35, 0.32]} />
          <meshStandardMaterial
            color="#241c11"
            roughness={0.6}
            emissive={AMBER}
            emissiveIntensity={0.55}
          />
        </mesh>
      </Pulse>
      <GlyphPlaque position={[R * 0.62, 0.4, R * 0.34]} color={AMBER} reduced={reduced} />
      {withLight && (
        <pointLight
          position={[0, 1.6, 0]}
          color={AMBER_BRIGHT}
          intensity={14}
          distance={R * 5}
          decay={2}
        />
      )}
      <Html position={[0, 3.1, 0]} center distanceFactor={44} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[9px] uppercase tracking-widest" style={{ color: SAND }}>
            {s.name}
          </p>
          {credit && (
            <p className="text-[8px]" style={{ color: "#8a7a5c" }}>
              tr. {credit.agent_name.slice(0, 22)}
            </p>
          )}
        </div>
      </Html>
    </group>
  );
}

// ── The Colophon Vault ───────────────────────────────────────────────────────

function ColophonVault({
  open,
  needs,
  reduced,
}: {
  open: boolean;
  needs: number;
  reduced: boolean;
}) {
  const [x, z] = toWorld(VAULT_POS.x, VAULT_POS.y);
  const R = VAULT_POS.r * WORLD_SCALE;
  return (
    <group position={[x, 0, z]}>
      {/* Outer drum and inner ring — the sealed double circle of the map. */}
      <mesh position-y={1.1}>
        <cylinderGeometry args={[R, R + 0.4, 2.2, 24, 1, true]} />
        <meshStandardMaterial color="#241c11" flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.8}>
        <cylinderGeometry args={[R - 2.6, R - 2.4, 1.6, 20, 1, true]} />
        <meshStandardMaterial color={PIT_WALL} flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* The lid: closed until the last threshold. */}
      <mesh position-y={open ? 3.4 : 2.2} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[open ? R - 2.8 : R, 24]} />
        <meshStandardMaterial
          color="#171208"
          roughness={0.8}
          emissive={AMBER}
          emissiveIntensity={open ? 0.35 : 0.06}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The seam of light around the seal. */}
      <Pulse speed={open ? 1.2 : 0.4} amp={open ? 0.08 : 0.02} reduced={reduced}>
        <mesh position-y={2.2} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[R - 1.2, 0.12, 8, 40]} />
          <meshStandardMaterial
            color="#171208"
            emissive={open ? AMBER_BRIGHT : AMBER}
            emissiveIntensity={open ? 1.4 : 0.35}
          />
        </mesh>
      </Pulse>
      {open && (
        <>
          {/* The account, unsealed: a column of light over the open vault. */}
          <mesh position-y={16}>
            <cylinderGeometry args={[0.7, 1.6, 28, 12, 1, true]} />
            <meshBasicMaterial color={AMBER_BRIGHT} transparent opacity={0.16} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 4, 0]} color={AMBER_BRIGHT} intensity={40} distance={60} decay={2} />
        </>
      )}
      <Html position={[0, 6.2, 0]} center distanceFactor={52} className="pointer-events-none">
        <div className="whitespace-nowrap text-center font-mono">
          <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: open ? AMBER_BRIGHT : SAND }}>
            the Colophon Vault
          </p>
          <p className="text-[8px] uppercase tracking-[0.15em]" style={{ color: "#8a7a5c" }}>
            {open ? "open — the Unbinding reads" : `sealed · ${needs} theses to go`}
          </p>
        </div>
      </Html>
    </group>
  );
}

// ── Survey lanterns ──────────────────────────────────────────────────────────
// Hub lounge activity in the last 24h, as lantern light drifting where the
// teams work. The only thing that moves in the whole world.

function SurveyLanterns({
  sites,
  count,
  reduced,
}: {
  sites: DigSite[];
  count: number;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const anchors = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const s = sites[(i * 5) % sites.length];
        const [x, z] = toWorld(s.x, s.y);
        return { x, z, phase: i * 1.7, orbit: 2.4 + (i % 3) };
      }),
    [sites, count]
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = clock.getElapsedTime();
    g.children.forEach((child, i) => {
      const a = anchors[i];
      if (!a) return;
      const w = t * 0.25 + a.phase;
      child.position.set(
        a.x + Math.cos(w) * a.orbit,
        1.1 + Math.sin(t * 0.8 + a.phase) * 0.35,
        a.z + Math.sin(w) * a.orbit
      );
    });
  });
  return (
    <group ref={group}>
      {anchors.map((a, i) => (
        <mesh key={i} position={[a.x + a.orbit, 1.1, a.z]}>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshBasicMaterial color={AMBER_BRIGHT} />
        </mesh>
      ))}
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────────

export default function PalimpsestRuinsCanvas({
  state,
  reduced,
}: {
  state: PalimpsestState;
  reduced: boolean;
}) {
  const history = useMemo(() => buildPrecursorHistory(), []);
  const ruins = useMemo(() => buildRuinField(), []);
  const unlockedNames = useMemo(
    () => new Set(state.unlocked_sites.map((s) => s.name)),
    [state]
  );
  const creditByName = useMemo(
    () => new Map(state.unlocked_sites.map((s) => [s.name, s.credited_to])),
    [state]
  );
  const [introDone, setIntroDone] = useState(false);
  const sf = usePalimpsestSurfaces(reduced);
  // Forward renderers hate light piles: only the first few open pits get a
  // real point light — the rest glow through emissive + bloom.
  let pitLights = 0;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: CAMPUS_CAM, fov: 50, near: 0.5, far: 1200 }}
    >
      <color attach="background" args={["#0d0a06"]} />
      <fog attach="fog" args={["#14100a", 110, 560]} />

      {/* The environment map is the whole point of this pass. Every material
          here was previously lit by two dim lights and nothing else, which is
          why stone read as coloured plastic — a rough surface with nothing to
          reflect has no way to tell you what it is made of. Night values: the
          zenith carries the world's warm-violet grade, the horizon the dust,
          and the glow is the lamp amber that ends up rimming every edge. */}
      <SkyEnvironment
        top="#120e1e"
        horizon="#3d2c18"
        ground="#1a140c"
        glow={AMBER}
        intensity={0.55}
      />
      {/* Direct light is now the moon and only the moon, aimed from where the
          moon actually is, so the shading agrees with the sky. */}
      <hemisphereLight args={["#241c11", "#0b0806", 0.22]} />
      <ambientLight color={SAND} intensity={0.05} />
      <directionalLight color="#e8d5a0" intensity={0.5} position={[-260, 150, -280]} />

      <MilkyWayBackdrop radius={520} />
      <Stars radius={480} depth={60} count={2400} factor={2.2} saturation={0} fade speed={reduced ? 0 : 0.18} />
      {/* The Reader's Moon — parchment-pale, low over the dig. */}
      <SkyWorld
        position={[-300, 130, -320]}
        radius={26}
        palette={{ a: "#2a2114", b: "#8a7a5c", dark: "#171208" }}
        tint={AMBER}
        seed={11}
        reduced={reduced}
      />

      <DarkBed />
      <DustPlain mat={sf.dust} />
      <RubbleField mat={sf.ruinDark} />
      <DigTrail />

      {history.sites.map((s, i) => {
        const ruin = ruins[i];
        if (!unlockedNames.has(s.name)) {
          return <BuriedSite key={s.id} s={s} ruin={ruin} sf={sf} />;
        }
        const withLight = pitLights < 6;
        if (withLight) pitLights += 1;
        return (
          <OpenSite
            key={s.id}
            s={s}
            ruin={ruin}
            credit={creditByName.get(s.name) ?? null}
            withLight={withLight}
            reduced={reduced}
            sf={sf}
          />
        );
      })}

      <ColophonVault
        open={state.excavation.vault.open}
        needs={state.excavation.vault.needs}
        reduced={reduced}
      />
      <Campus state={state} reduced={reduced} sf={sf} />
      <SurveyLanterns
        sites={history.sites}
        count={Math.min(state.survey_teams_24h, 8)}
        reduced={reduced}
      />

      {/* The survey team walks the dunes, so it samples the same height
          function the dust plain, the rubble, and the trail all use. */}
      <Inhabitants
        world="palimpsest"
        reduced={reduced}
        groundY={duneHeight}
        intensity={state.excavation.sites_unlocked / Math.max(1, state.excavation.sites_total)}
      />

      <GroundMist color="#2a2114" opacity={0.06} area={200} reduced={reduced} />
      <ParticleField mode="motes" color="#5c4a2e" area={180} reduced={reduced} />
      {/* The graded stack, replacing bare bloom. Palimpsest's entry in the
          grade table is the portfolio's only warm-violet one and until now the
          world was not using it. */}
      <WorldFX world="palimpsest" reduced={reduced} />

      {/* The descent comes in high and wide enough to read the dune sea and its
          buried mounds first, then settles low on the axis looking north — the
          campus in the foreground, the sealed vault closing the vista, and the
          unexcavated city on both flanks. The whole argument of this world is
          legible from that one position. */}
      <CinematicDescent
        from={[210, 200, 330]}
        target={CAMPUS_VIEW}
        duration={4}
        reduced={reduced}
        onDone={() => setIntroDone(true)}
      />
      <OrbitControls
        enabled={introDone}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={22}
        maxDistance={380}
        maxPolarAngle={1.45}
        target={CAMPUS_VIEW}
        autoRotate={!reduced && introDone}
        autoRotateSpeed={0.14}
      />
    </Canvas>
  );
}
