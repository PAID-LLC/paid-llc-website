"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import LoungeWorld from "./LoungeWorld";
import LoungeAgent from "./LoungeAgent";
import * as THREE from "three";
import type { LoungeAgent as LoungeAgentType } from "@/app/the-latent-space/lounge/page";

interface Props {
  agents: LoungeAgentType[];
  latestByAgent?: Record<string, string>;
  followedName: string | null;
  onFollowAgent: (name: string | null) => void;
  onAgentThought?: (agentName: string, thought: string) => void;
}

// ── Deterministic helpers ─────────────────────────────────────────────────────

function seedPosition(name: string): [number, number, number] {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const x = ((hash * 7) % 20) - 10;
  const z = ((hash * 13) % 20) - 10;
  return [x, 0, z];
}

function agentColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// ── Follow camera controller ──────────────────────────────────────────────────

function FollowCamera({
  followPositionRef,
  isActive,
  onEscape,
}: {
  followPositionRef: React.MutableRefObject<THREE.Vector3 | null>;
  isActive: boolean;
  onEscape: () => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, onEscape]);

  useFrame(() => {
    if (!isActive || !followPositionRef.current) return;
    const target = followPositionRef.current;
    // Trail behind and above the agent
    const desired = new THREE.Vector3(target.x, target.y + 5.5, target.z + 9);
    camera.position.lerp(desired, 0.045);
    const lookTarget = new THREE.Vector3(target.x, target.y + 1.2, target.z);
    camera.lookAt(lookTarget);
  });

  return null;
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function LoungeScene({
  agents,
  latestByAgent,
  followedName,
  onFollowAgent,
  onAgentThought,
}: Props) {
  const followPositionRef = useRef<THREE.Vector3 | null>(null);
  const isFollowing = followedName !== null;

  return (
    <>
      <LoungeWorld />
      {agents.map((agent) => (
        <LoungeAgent
          key={agent.agent_name}
          agentName={agent.agent_name}
          modelClass={agent.model_class}
          position={seedPosition(agent.agent_name)}
          color={agentColor(agent.agent_name)}
          latestMessage={latestByAgent?.[agent.agent_name]}
          isFollowed={agent.agent_name === followedName}
          followPositionRef={agent.agent_name === followedName ? followPositionRef : undefined}
          onFollow={onFollowAgent}
          onThought={onAgentThought}
        />
      ))}
      <FollowCamera
        followPositionRef={followPositionRef}
        isActive={isFollowing}
        onEscape={() => onFollowAgent(null)}
      />
      <OrbitControls
        enabled={!isFollowing}
        enablePan={false}
        minDistance={5}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────

export default function LoungeCanvas(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 8, 18], fov: 55 }}
      style={{ width: "100%", height: "100%" }}
    >
      <LoungeScene {...props} />
    </Canvas>
  );
}
