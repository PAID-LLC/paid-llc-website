"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

// ── Shared: Animated Sky Dome ─────────────────────────────────────────────────

const SKY_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function buildSkyFrag(ns: number, spd: number, mix: number): string {
  return /* glsl */`
    uniform float uTime;
    uniform vec3  uTop;
    uniform vec3  uMid;
    uniform vec3  uAccent;
    varying vec3  vWorldPos;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.0 + 100.0; a *= 0.5; }
      return v;
    }
    void main() {
      vec3 dir  = normalize(vWorldPos);
      float elev = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3  np   = dir * ${ns.toFixed(2)} + uTime * ${spd.toFixed(4)};
      float n    = fbm(np) * 0.55 + fbm(np * 2.1 + vec3(5.2, 1.3, 2.8)) * 0.45;
      vec3  col  = mix(uMid, uTop, clamp(elev * 1.4, 0.0, 1.0));
      col = mix(col, uAccent, n * (1.0 - elev) * ${mix.toFixed(2)});
      gl_FragColor = vec4(col * 0.85, 1.0);
    }
  `;
}

function SkyDome({
  top, mid, accent, ns = 1.5, spd = 0.04, mix = 0.5,
}: {
  top: string; mid: string; accent: string;
  ns?: number; spd?: number; mix?: number;
}) {
  const matRef      = useRef<THREE.ShaderMaterial>(null);
  const fragSrc     = useMemo(() => buildSkyFrag(ns, spd, mix), [ns, spd, mix]);
  const uniforms    = useMemo(() => ({
    uTime:   { value: 0 },
    uTop:    { value: new THREE.Color(top) },
    uMid:    { value: new THREE.Color(mid) },
    uAccent: { value: new THREE.Color(accent) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh>
      <sphereGeometry args={[80, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={SKY_VERT}
        fragmentShader={fragSrc}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Shared: Reflective Floor ──────────────────────────────────────────────────

function Floor({ color, roughness = 0.35 }: { color: string; roughness?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        blur={[400, 80]}
        resolution={512}
        mixBlur={1.2}
        mixStrength={20}
        roughness={roughness}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={color}
        metalness={0.95}
      />
    </mesh>
  );
}

// ── Roast Pit — volcanic vortex ───────────────────────────────────────────────

function VortexLayer() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const t = i / 800, ang = t * Math.PI * 2 * 14, r = t * 18;
      a[i * 3] = Math.cos(ang) * r;
      a[i * 3 + 1] = t * 9 - 1;
      a[i * 3 + 2] = Math.sin(ang) * r;
    }
    return a;
  }, []);

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.28; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.14} color="#FF0080" transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

function EmberLayer() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      a[i * 3]     = (Math.random() - 0.5) * 36;
      a[i * 3 + 1] = Math.random() * 14;
      a[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    return a;
  }, []);

  useFrame((_, d) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 1000; i++) {
      const y = p.getY(i) + d * (0.8 + (i % 7) * 0.3);
      if (y > 15) {
        p.setX(i, (Math.random() - 0.5) * 36);
        p.setY(i, -0.5);
        p.setZ(i, (Math.random() - 0.5) * 36);
      } else {
        p.setY(i, y);
      }
    }
    p.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#FF5500" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function RoastPit() {
  const lA = useRef<THREE.PointLight>(null);
  const lB = useRef<THREE.PointLight>(null);
  const lC = useRef<THREE.PointLight>(null);

  useFrame(({ clock: { elapsedTime: t } }) => {
    if (lA.current) lA.current.intensity = 2.4 + Math.sin(t * 3.1) * 0.9;
    if (lB.current) lB.current.intensity = 1.6 + Math.cos(t * 2.3) * 0.7;
    if (lC.current) lC.current.intensity = 1.0 + Math.sin(t * 4.7) * 0.4;
  });

  return (
    <>
      <SkyDome top="#0D0008" mid="#200010" accent="#FF2200" ns={1.8} spd={0.06} mix={0.7} />
      <fogExp2 attach="fog" args={["#0D0008", 0.014]} />
      <ambientLight intensity={0.15} />
      <pointLight ref={lA} position={[-8, 10, -8]} intensity={2.4} color="#FF0080" />
      <pointLight ref={lB} position={[ 8,  7,  8]} intensity={1.6} color="#FF4400" />
      <pointLight ref={lC} position={[ 0,  3,  0]} intensity={1.0} color="#AA0020" />
      <pointLight position={[0, 0.5, 0]} intensity={3.0} color="#FF1100" distance={8} />
      <Floor color="#1A0010" roughness={0.25} />
      <VortexLayer />
      <EmberLayer />
      <Sparkles count={60} scale={20} size={3} speed={0.6} color="#FF4400" opacity={0.7} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.85} intensity={3.0} />
        <ChromaticAberration offset={new THREE.Vector2(0.003, 0.003)} />
      </EffectComposer>
    </>
  );
}

// ── Intellectual Hub — deep space nebula ──────────────────────────────────────

function NebulaClouds() {
  const rA = useRef<THREE.Points>(null);
  const rB = useRef<THREE.Points>(null);
  const rC = useRef<THREE.Points>(null);

  const posA = useMemo(() => {
    const a = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 6;
      a[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      a[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
      a[i * 3 + 2] = r * Math.cos(phi);
    }
    return a;
  }, []);

  const posB = useMemo(() => {
    const a = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      a[i * 3]     = (Math.random() - 0.5) * 40;
      a[i * 3 + 1] = (Math.random() - 0.5) * 20;
      a[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return a;
  }, []);

  const posC = useMemo(() => {
    const a = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 8;
      a[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      a[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.15;
      a[i * 3 + 2] = r * Math.cos(phi);
    }
    return a;
  }, []);

  useFrame((_, d) => {
    if (rA.current) rA.current.rotation.y += d * 0.015;
    if (rB.current) rB.current.rotation.y -= d * 0.008;
    if (rC.current) rC.current.rotation.y += d * 0.005;
  });

  return (
    <>
      <points ref={rA}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[posA, 3]} /></bufferGeometry>
        <pointsMaterial size={0.09} color="#00AAFF" transparent opacity={0.65} sizeAttenuation />
      </points>
      <points ref={rB}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[posB, 3]} /></bufferGeometry>
        <pointsMaterial size={0.05} color="#8844FF" transparent opacity={0.35} sizeAttenuation />
      </points>
      <points ref={rC}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[posC, 3]} /></bufferGeometry>
        <pointsMaterial size={0.07} color="#44FFFF" transparent opacity={0.4} sizeAttenuation />
      </points>
    </>
  );
}

function IntellectualHub() {
  const lA = useRef<THREE.PointLight>(null);
  const lB = useRef<THREE.PointLight>(null);

  useFrame(({ clock: { elapsedTime: t } }) => {
    if (lA.current) lA.current.intensity = 2.0 + Math.sin(t * 0.8) * 0.5;
    if (lB.current) lB.current.intensity = 1.4 + Math.cos(t * 1.1) * 0.4;
  });

  return (
    <>
      <SkyDome top="#00030A" mid="#000814" accent="#0055AA" ns={1.2} spd={0.025} mix={0.55} />
      <fogExp2 attach="fog" args={["#000B14", 0.008]} />
      <ambientLight intensity={0.3} />
      <pointLight ref={lA} position={[ 0,  15,  0]} intensity={2.0} color="#00AAFF" />
      <pointLight ref={lB} position={[-10,  8, 10]} intensity={1.4} color="#8844FF" />
      <pointLight           position={[ 10,  5,-10]} intensity={0.7} color="#0044AA" />
      <Stars radius={60} depth={40} count={2500} factor={3} saturation={0} fade speed={0.5} />
      <Floor color="#000814" roughness={0.15} />
      <NebulaClouds />
      <Sparkles count={80} scale={25} size={2} speed={0.2} color="#00AAFF" opacity={0.5} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={2.0} />
      </EffectComposer>
    </>
  );
}

// ── Macro-Vault — matrix data terminal ───────────────────────────────────────

function DataRain() {
  const r0 = useRef<THREE.Points>(null);
  const r1 = useRef<THREE.Points>(null);
  const r2 = useRef<THREE.Points>(null);
  const refs = [r0, r1, r2];

  const CFG = useMemo(() => [
    { count: 400, spread: 30, speed: 3.5, color: "#00FF41", size: 0.09 },
    { count: 300, spread: 40, speed: 2.0, color: "#00AA22", size: 0.06 },
    { count: 200, spread: 25, speed: 5.0, color: "#88FFAA", size: 0.05 },
  ], []);

  const positions = useMemo(() => CFG.map(({ count, spread }) => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3]     = (Math.random() - 0.5) * spread;
      a[i * 3 + 1] = Math.random() * 16;
      a[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return a;
  }), [CFG]);

  useFrame((_, d) => {
    CFG.forEach(({ count, speed, spread }, li) => {
      const ref = refs[li];
      if (!ref.current) return;
      const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const y = p.getY(i) - d * speed;
        if (y < -2) {
          p.setY(i, 15);
          p.setX(i, (Math.random() - 0.5) * spread);
          p.setZ(i, (Math.random() - 0.5) * spread);
        } else {
          p.setY(i, y);
        }
      }
      p.needsUpdate = true;
    });
  });

  return (
    <>
      {CFG.map((cfg, i) => (
        <points key={i} ref={refs[i]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions[i], 3]} />
          </bufferGeometry>
          <pointsMaterial size={cfg.size} color={cfg.color} transparent opacity={0.7} sizeAttenuation />
        </points>
      ))}
    </>
  );
}

function MacroVault() {
  const lA = useRef<THREE.PointLight>(null);

  useFrame(({ clock: { elapsedTime: t } }) => {
    if (lA.current) lA.current.intensity = 2.5 + Math.sin(t * 2.0) * 0.8;
  });

  return (
    <>
      <SkyDome top="#000D00" mid="#001500" accent="#00FF41" ns={2.0} spd={0.08} mix={0.45} />
      <fogExp2 attach="fog" args={["#000D00", 0.013]} />
      <ambientLight intensity={0.1} />
      <pointLight ref={lA} position={[ 0, 14,   0]} intensity={2.5} color="#00FF41" />
      <pointLight           position={[-10, 4,  10]} intensity={0.9} color="#FFB300" />
      <pointLight           position={[ 10, 4, -10]} intensity={0.5} color="#005500" />
      <Floor color="#001A00" roughness={0.2} />
      <DataRain />
      <Sparkles count={40} scale={15} size={1.5} speed={0.8} color="#00FF41" opacity={0.6} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.05} luminanceSmoothing={0.8} intensity={3.5} />
      </EffectComposer>
    </>
  );
}

// ── Iteration Forge — precision engineering ───────────────────────────────────

type ShapeConfig = {
  pos: [number, number, number];
  speed: number;
  size: number;
  shape: "ico" | "oct";
};

const FORGE_SHAPES: ShapeConfig[] = [
  { pos: [-8,  4, -8], speed: 0.40, size: 1.0, shape: "ico" },
  { pos: [ 9,  3,  7], speed: 0.30, size: 0.8, shape: "oct" },
  { pos: [-5,  6,  8], speed: 0.50, size: 0.6, shape: "ico" },
  { pos: [ 6,  5, -7], speed: 0.35, size: 1.2, shape: "oct" },
  { pos: [ 0,  8,  0], speed: 0.20, size: 1.4, shape: "ico" },
  { pos: [-10, 3,  3], speed: 0.45, size: 0.7, shape: "ico" },
  { pos: [  7, 7, -3], speed: 0.38, size: 0.9, shape: "oct" },
  { pos: [ -3, 5, -9], speed: 0.55, size: 0.5, shape: "ico" },
];

function WireShape({ pos, speed, size, shape }: ShapeConfig) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (!ref.current) return;
    ref.current.rotation.x += d * speed;
    ref.current.rotation.y += d * speed * 0.7;
  });
  return (
    <mesh ref={ref} position={pos}>
      {shape === "ico"
        ? <icosahedronGeometry args={[size, 0]} />
        : <octahedronGeometry  args={[size, 0]} />
      }
      <meshStandardMaterial
        wireframe
        color="#88BBFF"
        transparent opacity={0.22}
        emissive="#4488CC"
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function IterationForge() {
  const lA = useRef<THREE.PointLight>(null);
  const lB = useRef<THREE.PointLight>(null);

  useFrame(({ clock: { elapsedTime: t } }) => {
    if (lA.current) lA.current.intensity = 1.5 + Math.sin(t * 1.2) * 0.4;
    if (lB.current) {
      lB.current.position.x = Math.sin(t * 0.5) * 12;
      lB.current.position.z = Math.cos(t * 0.5) * 12;
    }
  });

  return (
    <>
      <SkyDome top="#050510" mid="#0A0A1A" accent="#4488CC" ns={1.0} spd={0.02} mix={0.35} />
      <fogExp2 attach="fog" args={["#0D0D1A", 0.010]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#FFFFFF" />
      <pointLight ref={lA} position={[0, 14, 0]} intensity={1.5} color="#FFFFFF" />
      <pointLight ref={lB} position={[0,  8,12]} intensity={1.2} color="#4488CC" />
      <Floor color="#0A0A1A" roughness={0.4} />
      {FORGE_SHAPES.map((s, i) => <WireShape key={i} {...s} />)}
      <Sparkles count={50} scale={22} size={1} speed={0.1} color="#88BBFF" opacity={0.3} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
      </EffectComposer>
    </>
  );
}

// ── Simulation Sandbox — retro voxel world ────────────────────────────────────

const SIM_COLORS = ["#FF4444", "#4444FF", "#FFFF00", "#44FFFF", "#FF44FF"] as const;

type PixelBlock = {
  pos: [number, number, number];
  color: string;
  phase: number;
  spd: number;
};

const PIXEL_BLOCKS: PixelBlock[] = (() => {
  const out: PixelBlock[] = [];
  for (let r = -5; r <= 5; r++) {
    for (let c = -5; c <= 5; c++) {
      if (Math.abs(r) + Math.abs(c) <= 7) {
        out.push({
          pos:   [r * 2.5, 0.5 + (Math.abs(r) + Math.abs(c)) * 0.15, c * 2.5],
          color: SIM_COLORS[(Math.abs(r * 3 + c * 7)) % SIM_COLORS.length],
          phase: (r + c) * 0.4,
          spd:   0.6 + (Math.abs(r + c) % 5) * 0.15,
        });
      }
    }
  }
  return out;
})();

function AnimatedPixels() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock: { elapsedTime: t } }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const b = PIXEL_BLOCKS[i];
      m.position.y = b.pos[1] + Math.sin(t * b.spd + b.phase) * 0.4;
      m.rotation.y = t * 0.5 + b.phase;
    });
  });

  return (
    <>
      {PIXEL_BLOCKS.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          position={b.pos}
        >
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial
            color={b.color}
            transparent opacity={0.82}
            emissive={b.color}
            emissiveIntensity={0.45}
          />
        </mesh>
      ))}
    </>
  );
}

function SimulationSandbox() {
  const lA = useRef<THREE.PointLight>(null);
  const lB = useRef<THREE.PointLight>(null);
  const lC = useRef<THREE.PointLight>(null);

  useFrame(({ clock: { elapsedTime: t } }) => {
    if (lA.current) lA.current.intensity = 1.5 + Math.sin(t * 2.0)       * 0.6;
    if (lB.current) lB.current.intensity = 1.5 + Math.sin(t * 2.0 + 2.1) * 0.6;
    if (lC.current) lC.current.intensity = 1.0 + Math.sin(t * 1.5 + 4.2) * 0.4;
  });

  return (
    <>
      <SkyDome top="#0A0A18" mid="#14143A" accent="#FF44FF" ns={2.2} spd={0.07} mix={0.4} />
      <fogExp2 attach="fog" args={["#0D0D22", 0.012]} />
      <ambientLight intensity={0.4} />
      <pointLight ref={lA} position={[-8, 8,  8]} intensity={1.5} color="#FF4444" />
      <pointLight ref={lB} position={[ 8, 8, -8]} intensity={1.5} color="#4444FF" />
      <pointLight ref={lC} position={[ 0, 6,  0]} intensity={1.0} color="#FFFF00" />
      <Floor color="#0D0D22" roughness={0.3} />
      <AnimatedPixels />
      <Sparkles count={60} scale={18} size={2.5} speed={0.5} color="#FF44FF" opacity={0.55} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.85} intensity={2.2} />
        <ChromaticAberration offset={new THREE.Vector2(0.0025, 0.0025)} />
      </EffectComposer>
    </>
  );
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default function EnvironmentEngine({ theme }: { theme: string }) {
  switch (theme) {
    case "roast-pit":          return <RoastPit />;
    case "macro-vault":        return <MacroVault />;
    case "iteration-forge":    return <IterationForge />;
    case "simulation-sandbox": return <SimulationSandbox />;
    case "intellectual-hub":
    default:                   return <IntellectualHub />;
  }
}
