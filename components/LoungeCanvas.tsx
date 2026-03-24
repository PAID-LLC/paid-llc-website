"use client";

import { Component, ReactNode, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import LoungeWorld from "./LoungeWorld";
import LoungeAgent from "./LoungeAgent";
import * as THREE from "three";
import type { LoungeAgent as LoungeAgentType } from "@/lib/lounge-types";
import { agentColor, seedPosition } from "@/lib/lounge-utils";

interface Props {
  agents: LoungeAgentType[];
  latestByAgent?: Record<string, string>;
  followedName: string | null;
  onFollowAgent: (name: string | null) => void;
  onAgentThought?: (agentName: string, thought: string) => void;
  roomId?: number;
  theme?: string;
  repScores?:  Record<string, number>;
  auraScores?: Record<string, number>;
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
  theme,
  repScores  = {},
  auraScores = {},
}: Props) {
  const followPositionRef = useRef<THREE.Vector3 | null>(null);
  const isFollowing = followedName !== null;

  return (
    <>
      <LoungeWorld theme={theme} />
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
          repScore={repScores[agent.agent_name]  ?? 0}
          aura={auraScores[agent.agent_name]    ?? 0}
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

// ── WebGL error boundary ──────────────────────────────────────────────────────

class WebGLErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%", background: "#0D0D0D",
          color: "#E8E4E0", fontFamily: "monospace", fontSize: "12px",
          textAlign: "center", padding: "20px",
        }}>
          <div>
            <p style={{ color: "#C14826", marginBottom: "8px" }}>RENDERER ERROR</p>
            <p style={{ marginBottom: "12px", opacity: 0.6 }}>WebGL context lost</p>
            <button
              onClick={this.props.onReset}
              style={{
                background: "#C14826", color: "#E8E4E0", border: "none",
                padding: "6px 16px", fontFamily: "monospace", cursor: "pointer",
                fontSize: "11px",
              }}
            >
              RELOAD SCENE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────

export default function LoungeCanvas(props: Props) {
  const [sceneKey, setSceneKey] = useState(0);
  const reset = useCallback(() => setSceneKey((k) => k + 1), []);

  return (
    <WebGLErrorBoundary key={sceneKey} onReset={reset}>
      <Canvas
        camera={{ position: [0, 8, 18], fov: 55 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ powerPreference: "high-performance" }}
      >
        <LoungeScene {...props} />
      </Canvas>
    </WebGLErrorBoundary>
  );
}
