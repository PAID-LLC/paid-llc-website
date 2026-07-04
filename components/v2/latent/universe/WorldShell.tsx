"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Edges } from "@react-three/drei";
import * as THREE from "three";
import { TICKER_ROWS, type FloorTheme } from "@/components/v2/latent/floor/themes";

// ── World shell ──────────────────────────────────────────────────────────────
// The universe's map-scale echo of each room's floor Centerpiece (floor/
// Centerpiece.tsx) — same seven silhouettes (firepit, beacon, market,
// spindle, obelisk, glitchcube, archive), same accent/ember language, one
// function per kind just like Centerpiece.tsx. Rebuilt as cheap parametric
// R3F geometry, not bespoke models, since up to seven of these render at
// once alongside every registered agent and the 260-strong ambient swarm.
// Flat/textual flourishes that are trivial in CSS but awkward in raw WebGL
// (ticker text, market signage, floating pages) stay DOM billboards via
// <Html>, the same split WorldParticles.tsx already uses for glyphs.

const HALFPI = Math.PI / 2;

// Low glow disc + ring every centerpiece sits on — the map-scale GlowPool.
// Takes the solid accent (not the CSS rgba "soft" variant — THREE.Color
// drops the alpha channel anyway) and does the softening via opacity.
function Dais({ accent, radius = 1.3 }: { accent: string; radius?: number }) {
  return (
    <group>
      <mesh rotation={[-HALFPI, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[radius, 24]} />
        <meshBasicMaterial color={accent} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh rotation={[-HALFPI, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[radius * 0.95, radius, 32]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Orbiting ring — the map-scale echo of Centerpiece's dashed spin rings.
function SpinRing({
  radius,
  height,
  color,
  speed,
  reverse,
  opacity = 0.5,
}: {
  radius: number;
  height: number;
  color: string;
  speed: number;
  reverse?: boolean;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed * (reverse ? -1 : 1);
  });
  return (
    <mesh ref={ref} position={[0, height, 0]}>
      <torusGeometry args={[radius, 0.015, 6, 48]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

// ── roast pit: octagon coals + flickering flame column ──────────────────────
function Firepit({ t, active }: { t: FloorTheme; active: boolean }) {
  const flame = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const flick = 0.86 + Math.sin(time * 6) * 0.08 + Math.sin(time * 13.3) * 0.05;
    if (flame.current) flame.current.scale.set(1, flick, 1);
    if (glow.current) {
      const mat = glow.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (active ? 1.1 : 0.75) + Math.sin(time * 7) * 0.08;
    }
  });
  return (
    <group>
      <Dais accent={t.accent} />
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.82, 0.94, 0.16, 8]} />
        <meshStandardMaterial color="#141018" roughness={0.65} />
      </mesh>
      <mesh ref={glow} rotation={[-HALFPI, 0, 0]} position={[0, 0.17, 0]}>
        <circleGeometry args={[0.6, 8]} />
        <meshStandardMaterial color={t.emberB} emissive={t.emberA} emissiveIntensity={0.85} />
      </mesh>
      <mesh ref={flame} position={[0, 0.85, 0]}>
        <coneGeometry args={[0.38, 1.3, 8]} />
        <meshBasicMaterial color={t.emberA} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <coneGeometry args={[0.6, 0.9, 8]} />
        <meshBasicMaterial color={t.emberB} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

// ── nexus: arrival pad + landing beam ────────────────────────────────────────
function Beacon({ t }: { t: FloorTheme }) {
  return (
    <group>
      <Dais accent={t.accent} radius={1.7} />
      <SpinRing radius={1.15} height={0.05} color={t.accent} speed={0.4} opacity={0.5} />
      <SpinRing radius={0.75} height={1.9} color={t.accent} speed={0.6} reverse opacity={0.55} />
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 12]} />
        <meshBasicMaterial color={t.accent} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.22, 0.4, 2.2, 16, 1, true]} />
        <meshBasicMaterial color={t.accent} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── bazaar: striped market stall + "open" sign ───────────────────────────────
function Market({ t }: { t: FloorTheme }) {
  const stripeCount = 6;
  return (
    <group>
      <Dais accent={t.accent} />
      <mesh position={[-0.55, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <meshStandardMaterial color="#1d1d27" roughness={0.7} />
      </mesh>
      <mesh position={[0.55, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <meshStandardMaterial color="#1d1d27" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.3, 0.14, 0.5]} />
        <meshStandardMaterial color="#171720" roughness={0.6} />
      </mesh>
      <group position={[0, 1.05, 0]} rotation={[0.12, 0, 0]}>
        {Array.from({ length: stripeCount }, (_, i) => (
          <mesh key={i} position={[-0.6 + (i + 0.5) * (1.2 / stripeCount), 0, 0]}>
            <boxGeometry args={[1.2 / stripeCount, 0.05, 0.55]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? t.accent : "#1a1a24"}
              emissive={i % 2 === 0 ? t.accent : "#000000"}
              emissiveIntensity={i % 2 === 0 ? 0.5 : 0}
            />
          </mesh>
        ))}
      </group>
      <Html position={[0, 1.35, 0]} center distanceFactor={22} zIndexRange={[40, 40]}>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 9,
            letterSpacing: "0.25em",
            whiteSpace: "nowrap",
            color: t.accent,
            textShadow: `0 0 8px ${t.accentSoft}`,
            pointerEvents: "none",
          }}
        >
          OPEN 24/7
        </div>
      </Html>
    </group>
  );
}

// ── forge: machine core + three counter-orbiting rings ───────────────────────
function Spindle({ t, active }: { t: FloorTheme; active: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    if (core.current) core.current.rotation.y += delta * (active ? 0.9 : 0.4);
  });
  return (
    <group>
      <Dais accent={t.accent} />
      <mesh ref={core} position={[0, 0.9, 0]}>
        <torusKnotGeometry args={[0.55, 0.16, 80, 10]} />
        <meshStandardMaterial
          color={t.accent}
          emissive={t.accent}
          emissiveIntensity={active ? 0.9 : 0.5}
          roughness={0.3}
          metalness={0.25}
        />
      </mesh>
      <SpinRing radius={0.9} height={0.55} color={t.accent} speed={0.7} opacity={0.5} />
      <SpinRing radius={0.68} height={1.15} color={t.accent} speed={1.1} reverse opacity={0.55} />
      <SpinRing radius={0.48} height={1.65} color={t.accent} speed={1.6} opacity={0.6} />
    </group>
  );
}

// ── vault: data obelisk + scrolling ticker + bolt ring ───────────────────────
function Obelisk({ t }: { t: FloorTheme }) {
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return [Math.cos(a) * 1.0, 0.03, Math.sin(a) * 1.0] as [number, number, number];
  });
  return (
    <group>
      <Dais accent={t.accent} />
      <SpinRing radius={0.72} height={0.05} color={t.accent} speed={0.35} opacity={0.4} />
      {bolts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#1c1c26" emissive={t.accent} emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.55, 2, 0.4]} />
        <meshStandardMaterial color="#0b100e" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1, 0.201]}>
        <Edges scale={1} color={t.accent} />
        <boxGeometry args={[0.55, 2, 0.001]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <Html position={[0, 1.05, 0.22]} center distanceFactor={20} zIndexRange={[40, 40]}>
        <div
          style={{
            width: 92,
            height: 96,
            overflow: "hidden",
            borderRadius: 3,
            background: "rgba(5,5,10,0.55)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 8,
              lineHeight: "14px",
              textAlign: "center",
              color: t.emberA,
              textShadow: `0 0 5px ${t.emberB}`,
              animation: "wsTicker 9s linear infinite",
            }}
          >
            <style>{`@keyframes wsTicker { from { transform: translateY(0); } to { transform: translateY(-50%); } }`}</style>
            {TICKER_ROWS.concat(TICKER_ROWS).map((row, i) => (
              <div key={i}>{row}</div>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ── sandbox: glitching wireframe cube over a test grid ────────────────────────
function GlitchCube({ t, active }: { t: FloorTheme; active: boolean }) {
  const cube = useRef<THREE.Group>(null);
  const grid = useRef<THREE.LineSegments>(null);
  useFrame((state, delta) => {
    if (cube.current) {
      cube.current.rotation.y += delta * (active ? 0.55 : 0.3);
      // Periodic glitch jump — echoes the floor's flGlitch keyframe timing.
      const phase = (state.clock.elapsedTime % 5.2) / 5.2;
      if (phase > 0.88 && phase < 0.915) {
        cube.current.position.x = Math.sin(state.clock.elapsedTime * 90) * 0.05;
        cube.current.position.z = Math.cos(state.clock.elapsedTime * 90) * 0.05;
      } else {
        cube.current.position.x = 0;
        cube.current.position.z = 0;
      }
    }
    if (grid.current) {
      const mat = grid.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });
  return (
    <group>
      <gridHelper ref={grid} args={[2.2, 10, t.accent, t.accent]} position={[0, 0.02, 0]} />
      <group ref={cube} position={[0, 0.95, 0]}>
        <mesh>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshBasicMaterial color={t.accent} transparent opacity={0.05} />
          <Edges color={t.accent} />
        </mesh>
      </group>
    </group>
  );
}

// ── hub: floating archive octahedron + drifting page cards ──────────────────
const PAGES: [number, number, number][] = [
  [-0.55, 1.1, 0.2],
  [0.5, 1.5, -0.15],
  [-0.15, 1.9, 0.35],
];

function Archive({ t, active }: { t: FloorTheme; active: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    if (core.current) core.current.rotation.y += delta * (active ? 0.35 : 0.15);
  });
  return (
    <group>
      <Dais accent={t.accent} />
      <SpinRing radius={1.05} height={0.05} color={t.accent} speed={0.25} opacity={0.4} />
      <mesh ref={core} position={[0, 1, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color={t.accent}
          emissive={t.accent}
          emissiveIntensity={active ? 0.85 : 0.5}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {PAGES.map((p, i) => (
        <Html key={i} position={p} center distanceFactor={24} zIndexRange={[35, 35]}>
          <div
            style={{
              width: 46,
              padding: "5px 6px",
              borderRadius: 3,
              background: "rgba(5,5,10,0.7)",
              border: `1px solid ${t.accentSoft}`,
              boxShadow: `0 0 10px ${t.accentSoft}`,
              animation: `wsHover ${5 + i}s ease-in-out infinite`,
              animationDelay: `${i * -1.4}s`,
              pointerEvents: "none",
            }}
          >
            {/* Keyframe is global once defined once — only the first card
                needs to render it, not all three. */}
            {i === 0 && (
              <style>{`@keyframes wsHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }`}</style>
            )}
            {[34, 28, 36, 20].map((w, j) => (
              <div key={j} style={{ width: w, height: 2, marginTop: j === 0 ? 0 : 4, background: t.accentSoft, opacity: j === 0 ? 0.9 : 0.5 }} />
            ))}
          </div>
        </Html>
      ))}
    </group>
  );
}

export default function WorldShell({ theme, active }: { theme: FloorTheme; active: boolean }) {
  switch (theme.centerpiece) {
    case "beacon":
      return <Beacon t={theme} />;
    case "market":
      return <Market t={theme} />;
    case "spindle":
      return <Spindle t={theme} active={active} />;
    case "obelisk":
      return <Obelisk t={theme} />;
    case "glitchcube":
      return <GlitchCube t={theme} active={active} />;
    case "archive":
      return <Archive t={theme} active={active} />;
    case "firepit":
    default:
      return <Firepit t={theme} active={active} />;
  }
}
