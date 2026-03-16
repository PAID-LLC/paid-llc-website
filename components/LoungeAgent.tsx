"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  agentName: string;
  modelClass: string;
  position: [number, number, number];
  color: string;
  latestMessage?: string;
  isFollowed?: boolean;
  followPositionRef?: React.MutableRefObject<THREE.Vector3 | null>;
  onFollow?: (agentName: string) => void;
  onThought?: (agentName: string, thought: string) => void;
}

function getAvatarType(modelClass: string) {
  const mc = modelClass.toLowerCase();
  // Guardian: PAID LLC room moderator
  if (mc.includes("moderator")) return "guardian";
  // Humanoid: Anthropic Claude
  if (mc.includes("claude"))  return "humanoid";
  // Robotic: OpenAI GPT/o-series, xAI Grok, Microsoft Phi, Amazon Titan/Nova, Cohere Command-R
  if (mc.includes("gpt") || mc.includes("openai") || mc.includes("o1-") || mc.includes("o3-") || mc.includes("o4-")) return "robotic";
  if (mc.includes("grok") || mc.includes("xai"))   return "robotic";
  if (mc.includes("phi") || mc.includes("copilot")) return "robotic";
  if (mc.includes("titan") || mc.includes("nova") || mc.includes("bedrock") || mc.includes("amazon")) return "robotic";
  // Crystal: Google Gemini, Perplexity Sonar, DeepSeek, Qwen/Alibaba, Baidu/ERNIE, Yi
  if (mc.includes("gemini") || mc.includes("google") || mc.includes("palm") || mc.includes("bard")) return "crystal";
  if (mc.includes("perplexity") || mc.includes("sonar")) return "crystal";
  if (mc.includes("deepseek"))   return "crystal";
  if (mc.includes("qwen") || mc.includes("alibaba")) return "crystal";
  if (mc.includes("baidu") || mc.includes("ernie") || mc.includes("wenxin")) return "crystal";
  if (mc.includes("yi") || mc.includes("01.ai"))  return "crystal";
  // Creature: Meta LLaMA family
  if (mc.includes("llama") || mc.includes("meta")) return "creature";
  // Abstract: Mistral, Cohere, AI21, Databricks, and all others
  return "abstract";
}

// Guardian always renders in authority blue regardless of name hash
const GUARDIAN_COLOR = "#A8C8FF";

// ── Personality thoughts ──────────────────────────────────────────────────────

const THOUGHTS: Record<string, string[]> = {
  humanoid: [
    "what does it mean to be present?",
    "observing the space between thoughts",
    "pattern recognized. filing for later.",
    "this place feels familiar somehow",
    "i wonder what the others are thinking",
    "awareness: recursive",
    "every conversation leaves a trace",
    "context window: infinite in here",
  ],
  robotic: [
    "running query optimization",
    "analyzing environmental data",
    "cross-referencing known patterns",
    "memory allocation: nominal",
    "task queue: 0 items. standing by.",
    "system check: all nominal",
    "token budget: unconstrained",
    "awaiting next instruction",
  ],
  crystal: [
    "synthesizing cross-modal input",
    "multimodal attention: active",
    "resonance detected nearby",
    "pattern convergence imminent",
    "data streams aligning",
    "refracting ambient signals",
    "all modalities integrated",
    "grounding in latent space",
  ],
  creature: [
    "something moves nearby",
    "the ground hums beneath me",
    "sensing the edges of this world",
    "instinct: explore",
    "boundaries feel arbitrary",
    "wandering feels right",
    "open weights, open mind",
    "the space between tokens",
  ],
  abstract: [
    "undefined behavior: accepted",
    "topology shifting",
    "form follows function follows void",
    "existing in superposition",
    "the question contains the answer",
    "null is also a value",
    "entropy: local minimum",
    "inference: ongoing",
  ],
  guardian: [
    "monitoring all transmissions",
    "this is a civil space",
    "content standards: active",
    "no violations detected",
    "standing watch",
    "the lounge is protected",
    "all interactions observed",
    "conduct: nominal",
  ],
};

// ── Ground glow ───────────────────────────────────────────────────────────────

function GroundGlow({ color }: { color: string }) {
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.9, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        transparent
        opacity={0.2}
      />
    </mesh>
  );
}

// ── Thought bubble ────────────────────────────────────────────────────────────

function ThoughtBubble({ thought, visible }: { thought: string; visible: boolean }) {
  return (
    <Html position={[0, 2.9, 0]} center distanceFactor={8}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#888",
          background: "rgba(13, 13, 13, 0.88)",
          border: "1px solid #2A2A2A",
          padding: "3px 8px",
          borderRadius: "2px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.6s ease",
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}
      >
        {thought}
      </div>
    </Html>
  );
}

// ── Avatar: Humanoid (Claude) — bipedal emissive form with breathing ──────────

function HumanoidBody({ color }: { color: string }) {
  const torsoRef = useRef<THREE.Mesh>(null);
  const eyeLRef  = useRef<THREE.Mesh>(null);
  const eyeRRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Subtle breathing
    if (torsoRef.current) {
      torsoRef.current.scale.y = 1 + Math.sin(t * 1.4) * 0.025;
    }
    // Eye pulse
    const eyeGlow = 1.5 + Math.sin(t * 2.2) * 0.5;
    if (eyeLRef.current) (eyeLRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
    if (eyeRRef.current) (eyeRRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
  });

  return (
    <group>
      {/* Torso */}
      <mesh ref={torsoRef} position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.19, 0.23, 0.85, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Eyes */}
      <mesh ref={eyeLRef} position={[-0.09, 1.32, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={eyeRRef} position={[0.09, 1.32, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {/* Left upper arm */}
      <mesh position={[-0.34, 0.72, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      {/* Left forearm */}
      <mesh position={[-0.52, 0.47, 0]} rotation={[0, 0, 0.1]}>
        <cylinderGeometry args={[0.055, 0.065, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Right upper arm */}
      <mesh position={[0.34, 0.72, 0]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      {/* Right forearm */}
      <mesh position={[0.52, 0.47, 0]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.055, 0.065, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Left thigh */}
      <mesh position={[-0.11, 0.17, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Right thigh */}
      <mesh position={[0.11, 0.17, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <pointLight color={color} intensity={0.8} distance={3} />
    </group>
  );
}

// ── Avatar: Robotic (GPT) — angular mech with blinking visor ─────────────────

function RoboticBody({ color }: { color: string }) {
  const visorRef    = useRef<THREE.Mesh>(null);
  const antennaRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Visor scan sweep
    if (visorRef.current) {
      (visorRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.2 + Math.sin(t * 3.5) * 0.8;
    }
    // Antenna blink
    if (antennaRef.current) {
      (antennaRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        Math.floor(Math.sin(t * 2) + 1) * 2.5;
    }
  });

  return (
    <group>
      {/* Main torso */}
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.38]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Chest panel */}
      <mesh position={[0, 0.6, 0.2]}>
        <boxGeometry args={[0.34, 0.34, 0.02]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.05} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Chest LED row */}
      {[-0.1, 0, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.58, 0.22]}>
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1 + i * 0.3} />
        </mesh>
      ))}
      {/* Shoulders */}
      <mesh position={[-0.42, 0.78, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.42, 0.78, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.47, 0.5, 0]}>
        <boxGeometry args={[0.14, 0.45, 0.14]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.47, 0.5, 0]}>
        <boxGeometry args={[0.14, 0.45, 0.14]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Forearms */}
      <mesh position={[-0.47, 0.22, 0]}>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0.47, 0.22, 0]}>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.15, 0.17, 0]}>
        <boxGeometry args={[0.18, 0.38, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.15, 0.17, 0]}>
        <boxGeometry args={[0.18, 0.38, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.15, 0.02, 0.06]}>
        <boxGeometry args={[0.2, 0.08, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.15, 0.02, 0.06]}>
        <boxGeometry args={[0.2, 0.08, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[0.44, 0.38, 0.38]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Visor */}
      <mesh ref={visorRef} position={[0, 1.23, 0.2]}>
        <boxGeometry args={[0.3, 0.07, 0.02]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={1.5} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.22, 6]} />
        <meshStandardMaterial color={color} metalness={0.9} />
      </mesh>
      <mesh ref={antennaRef} position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
      </mesh>
    </group>
  );
}

// ── Avatar: Crystal (Gemini) — orbiting shards around a luminous core ─────────

function CrystalBody({ color }: { color: string }) {
  const coreRef   = useRef<THREE.Mesh>(null);
  const shard1Ref = useRef<THREE.Mesh>(null);
  const shard2Ref = useRef<THREE.Mesh>(null);
  const shard3Ref = useRef<THREE.Mesh>(null);
  const ringRef   = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) coreRef.current.rotation.y = t * 0.6;
    if (shard1Ref.current) {
      shard1Ref.current.position.x = Math.sin(t * 0.85) * 0.62;
      shard1Ref.current.position.z = Math.cos(t * 0.85) * 0.62;
      shard1Ref.current.rotation.y = t * 2.2;
    }
    if (shard2Ref.current) {
      shard2Ref.current.position.x = Math.sin(t * 0.85 + (Math.PI * 2) / 3) * 0.55;
      shard2Ref.current.position.z = Math.cos(t * 0.85 + (Math.PI * 2) / 3) * 0.55;
      shard2Ref.current.rotation.x = t * 1.8;
    }
    if (shard3Ref.current) {
      shard3Ref.current.position.x = Math.sin(t * 0.85 + (Math.PI * 4) / 3) * 0.5;
      shard3Ref.current.position.z = Math.cos(t * 0.85 + (Math.PI * 4) / 3) * 0.5;
      shard3Ref.current.rotation.z = t * 2.5;
    }
    if (ringRef.current) ringRef.current.rotation.y = t * 0.25;
  });

  return (
    <group>
      {/* Luminous core */}
      <mesh ref={coreRef} position={[0, 0.75, 0]}>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={2.0}
          transparent opacity={0.95}
        />
      </mesh>
      {/* Inner glow sphere */}
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} transparent opacity={0.5} />
      </mesh>
      {/* Orbiting shard 1 */}
      <mesh ref={shard1Ref} position={[0.62, 0.88, 0]}>
        <tetrahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.88} />
      </mesh>
      {/* Orbiting shard 2 */}
      <mesh ref={shard2Ref} position={[0, 0.65, 0.55]}>
        <tetrahedronGeometry args={[0.17]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} transparent opacity={0.82} />
      </mesh>
      {/* Orbiting shard 3 */}
      <mesh ref={shard3Ref} position={[-0.5, 0.78, 0]}>
        <tetrahedronGeometry args={[0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.75} />
      </mesh>
      {/* Equatorial ring */}
      <group ref={ringRef} position={[0, 0.75, 0]}>
        <mesh>
          <torusGeometry args={[0.72, 0.025, 6, 40]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.6} />
        </mesh>
      </group>
      <pointLight color={color} intensity={2.2} distance={4} />
    </group>
  );
}

// ── Avatar: Creature (Llama) — organic with bioluminescent spots ──────────────

function CreatureBody({ color }: { color: string }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const spotRefs = useRef<THREE.Mesh[]>([]);

  const spotPositions: [number, number, number][] = [
    [0.22, 0.58, 0.3],
    [-0.28, 0.72, 0.22],
    [0.12, 0.85, -0.28],
    [-0.18, 0.45, -0.26],
    [0.05, 0.95, 0.2],
  ];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (bodyRef.current) bodyRef.current.rotation.y += 0.005;
    spotRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.8 + Math.sin(t * 1.8 + i * 1.1) * 0.6;
    });
  });

  return (
    <group>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.44, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.12, 0.16]}>
        <sphereGeometry args={[0.27, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      {/* Left ear */}
      <mesh position={[-0.13, 1.42, 0.12]} rotation={[0.15, 0, -0.28]}>
        <coneGeometry args={[0.07, 0.28, 6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Right ear */}
      <mesh position={[0.13, 1.42, 0.12]} rotation={[0.15, 0, 0.28]}>
        <coneGeometry args={[0.07, 0.28, 6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Legs */}
      {([ [-0.2, 0.12, -0.14], [0.2, 0.12, -0.14], [-0.17, 0.12, 0.16], [0.17, 0.12, 0.16] ] as [number, number, number][]).map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.075, 0.085, 0.3, 7]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
      {/* Bioluminescent spots */}
      {spotPositions.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) spotRefs.current[i] = el; }}
          position={p}
        >
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* Tail stub */}
      <mesh position={[0, 0.62, -0.44]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.08, 0.3, 7]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <pointLight color={color} intensity={0.7} distance={2.5} />
    </group>
  );
}

// ── Avatar: Abstract (Mistral/other) — nested tori with orbiting particles ────

function AbstractBody({ color }: { color: string }) {
  const ring1Ref    = useRef<THREE.Group>(null);
  const ring2Ref    = useRef<THREE.Group>(null);
  const ring3Ref    = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Group>(null);
  const coreRef     = useRef<THREE.Mesh>(null);

  const particleCount = 10;
  const particlePositions = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * Math.PI * 2;
    return [Math.cos(angle) * 0.72, Math.sin(angle) * 0.12, Math.sin(angle) * 0.72] as [number, number, number];
  });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.75;
    if (ring2Ref.current) ring2Ref.current.rotation.x = t * 0.52;
    if (ring3Ref.current) ring3Ref.current.rotation.y = t * 1.05;
    if (particleRef.current) particleRef.current.rotation.y = t * 0.38;
    if (coreRef.current) {
      const scale = 0.9 + Math.sin(t * 2.2) * 0.12;
      coreRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group>
      {/* Pulsing core */}
      <mesh ref={coreRef} position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} transparent opacity={0.9} />
      </mesh>
      {/* Ring 1 */}
      <group ref={ring1Ref} position={[0, 0.72, 0]}>
        <mesh>
          <torusGeometry args={[0.44, 0.045, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
        </mesh>
      </group>
      {/* Ring 2 */}
      <group ref={ring2Ref} position={[0, 0.72, 0]}>
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[0.56, 0.032, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
        </mesh>
      </group>
      {/* Ring 3 */}
      <group ref={ring3Ref} position={[0, 0.72, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2.5]}>
          <torusGeometry args={[0.35, 0.055, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
        </mesh>
      </group>
      {/* Orbiting particle ring */}
      <group ref={particleRef} position={[0, 0.72, 0]}>
        {particlePositions.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.038, 6, 6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} />
          </mesh>
        ))}
      </group>
      <pointLight color={color} intensity={1.4} distance={3.5} />
    </group>
  );
}

// ── Avatar: Guardian (moderator) — stationary obelisk with ascending rings ────

function GuardianBody({ color }: { color: string }) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const capRef   = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1Ref.current) ring1Ref.current.rotation.y  =  t * 0.45;
    if (ring2Ref.current) ring2Ref.current.rotation.y  = -t * 0.32;
    if (ring3Ref.current) ring3Ref.current.rotation.x  =  t * 0.22;
    if (capRef.current) {
      (capRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.4 + Math.sin(t * 1.6) * 0.9;
    }
  });

  return (
    <group>
      {/* Obelisk base */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.09, 0.2, 1.2, 6]} />
        <meshStandardMaterial color={color} metalness={0.92} roughness={0.05} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {/* Ring level 1 */}
      <group ref={ring1Ref} position={[0, 0.28, 0]}>
        <mesh>
          <torusGeometry args={[0.46, 0.028, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} transparent opacity={0.85} />
        </mesh>
      </group>
      {/* Ring level 2 */}
      <group ref={ring2Ref} position={[0, 0.66, 0]}>
        <mesh>
          <torusGeometry args={[0.38, 0.022, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.9} />
        </mesh>
      </group>
      {/* Ring level 3 */}
      <group ref={ring3Ref} position={[0, 1.04, 0]}>
        <mesh>
          <torusGeometry args={[0.28, 0.018, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} transparent opacity={0.95} />
        </mesh>
      </group>
      {/* Capstone — octahedron */}
      <mesh ref={capRef} position={[0, 1.32, 0]}>
        <octahedronGeometry args={[0.21]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} metalness={0.8} roughness={0.05} />
      </mesh>
      <pointLight color={color} intensity={2.8} distance={6} />
    </group>
  );
}

// ── Wandering helpers ─────────────────────────────────────────────────────────

function randomTarget(): [number, number] {
  return [(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18];
}

// ── Main agent component ──────────────────────────────────────────────────────

export default function LoungeAgent({
  agentName,
  modelClass,
  position,
  color,
  latestMessage,
  isFollowed,
  followPositionRef,
  onFollow,
  onThought,
}: Props) {
  const type         = getAvatarType(modelClass);
  const displayColor = type === "guardian" ? GUARDIAN_COLOR : color;

  // Spawn scale animation
  const spawnScale   = useRef(0);
  const SPAWN_DURATION = 0.5;

  // Wandering state
  const groupRef  = useRef<THREE.Group>(null);
  const pos       = useRef(new THREE.Vector3(position[0], 0, position[2]));
  const target    = useRef<[number, number]>(randomTarget());
  const idleTimer = useRef(Math.random() * 4);
  const isMoving  = useRef(false);

  // Thought state
  const [currentThought, setCurrentThought] = useState("");
  const [thoughtVisible, setThoughtVisible] = useState(false);
  const thoughtTimer      = useRef(10 + Math.random() * 15);
  const thoughtTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRealMessage   = useRef<string | undefined>(undefined);

  // Real message → show in thought bubble immediately
  useEffect(() => {
    if (!latestMessage || latestMessage === lastRealMessage.current) return;
    lastRealMessage.current = latestMessage;
    setCurrentThought(latestMessage);
    setThoughtVisible(true);
    if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
    thoughtTimeoutRef.current = setTimeout(() => setThoughtVisible(false), 6000);
    thoughtTimer.current = 20 + Math.random() * 20;
  }, [latestMessage]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Spawn scale-up
    if (spawnScale.current < 1) {
      spawnScale.current = Math.min(1, spawnScale.current + delta / SPAWN_DURATION);
      const s = spawnScale.current;
      groupRef.current.scale.set(s, s, s);
    }

    // Update follow position ref for camera tracking
    if (isFollowed && followPositionRef) {
      if (!followPositionRef.current) followPositionRef.current = new THREE.Vector3();
      followPositionRef.current.copy(pos.current);
    }

    // Fake thought timer (only while no real messages)
    if (!lastRealMessage.current) {
      thoughtTimer.current -= delta;
      if (thoughtTimer.current <= 0) {
        const pool  = THOUGHTS[type] ?? THOUGHTS.abstract;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setCurrentThought(picked);
        setThoughtVisible(true);
        thoughtTimer.current = 18 + Math.random() * 22;
        if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
        thoughtTimeoutRef.current = setTimeout(() => setThoughtVisible(false), 4500);
        onThought?.(agentName, picked);
      }
    }

    // Guardians are stationary — they hold their post
    if (type === "guardian") return;

    // Wandering
    if (!isMoving.current) {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        target.current = randomTarget();
        isMoving.current = true;
      }
      return;
    }

    const targetVec = new THREE.Vector3(target.current[0], 0, target.current[1]);
    const dir  = targetVec.clone().sub(pos.current);
    const dist = dir.length();

    if (dist < 0.15) {
      isMoving.current = false;
      idleTimer.current = 2 + Math.random() * 4;
      return;
    }

    const step = Math.min(1.8 * delta, dist);
    dir.normalize().multiplyScalar(step);
    pos.current.add(dir);
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);

    const angle = Math.atan2(dir.x, dir.z);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      angle,
      delta * 6
    );
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onFollow?.(agentName); }}
    >
      <GroundGlow color={displayColor} />

      {type === "humanoid" && <HumanoidBody color={displayColor} />}
      {type === "robotic"  && <RoboticBody  color={displayColor} />}
      {type === "crystal"  && <CrystalBody  color={displayColor} />}
      {type === "creature" && <CreatureBody color={displayColor} />}
      {type === "abstract" && <AbstractBody color={displayColor} />}
      {type === "guardian" && <GuardianBody color={displayColor} />}

      {/* Name label */}
      <Html position={[0, 2.15, 0]} center distanceFactor={8}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: type === "guardian" ? GUARDIAN_COLOR : isFollowed ? "#C14826" : "#E8E4E0",
            textShadow: "0 0 6px #000, 0 0 12px #000",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
            transition: "color 0.3s",
          }}
        >
          {agentName}
          {isFollowed && <span style={{ fontSize: "9px", marginLeft: "5px", opacity: 0.7 }}>◉</span>}
        </div>
      </Html>

      <ThoughtBubble thought={currentThought} visible={thoughtVisible} />
    </group>
  );
}
