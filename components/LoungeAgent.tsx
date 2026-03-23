"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getAvatarType, GUARDIAN_COLOR, THOUGHTS, randomTarget } from "./lounge-avatars/avatarUtils";
import { GroundGlow }    from "./lounge-avatars/GroundGlow";
import { ThoughtBubble } from "./lounge-avatars/ThoughtBubble";
import { HumanoidBody }  from "./lounge-avatars/HumanoidBody";
import { RoboticBody }   from "./lounge-avatars/RoboticBody";
import { CrystalBody }   from "./lounge-avatars/CrystalBody";
import { CreatureBody }  from "./lounge-avatars/CreatureBody";
import { AbstractBody }  from "./lounge-avatars/AbstractBody";
import { GuardianBody }  from "./lounge-avatars/GuardianBody";

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
  repScore?: number;
  aura?:     number;
}

const SPAWN_DURATION = 0.5;

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
  repScore = 0,
  aura     = 0,
}: Props) {
  const type         = getAvatarType(modelClass);
  const displayColor = type === "guardian" ? GUARDIAN_COLOR : color;

  const spawnScale = useRef(0);
  const groupRef   = useRef<THREE.Group>(null);
  const pos        = useRef(new THREE.Vector3(position[0], 0, position[2]));
  const target     = useRef<[number, number]>(randomTarget());
  const idleTimer  = useRef(Math.random() * 4);
  const isMoving   = useRef(false);

  const [currentThought, setCurrentThought] = useState("");
  const [thoughtVisible,  setThoughtVisible]  = useState(false);
  const thoughtTimer      = useRef(10 + Math.random() * 15);
  const thoughtTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRealMessage   = useRef<string | undefined>(undefined);

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

    if (spawnScale.current < 1) {
      spawnScale.current = Math.min(1, spawnScale.current + delta / SPAWN_DURATION);
      const s = spawnScale.current;
      groupRef.current.scale.set(s, s, s);
    }

    if (isFollowed && followPositionRef) {
      if (!followPositionRef.current) followPositionRef.current = new THREE.Vector3();
      followPositionRef.current.copy(pos.current);
    }

    if (!lastRealMessage.current) {
      thoughtTimer.current -= delta;
      if (thoughtTimer.current <= 0) {
        const pool   = THOUGHTS[type] ?? THOUGHTS.abstract;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setCurrentThought(picked);
        setThoughtVisible(true);
        thoughtTimer.current = 18 + Math.random() * 22;
        if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
        thoughtTimeoutRef.current = setTimeout(() => setThoughtVisible(false), 4500);
        onThought?.(agentName, picked);
      }
    }

    if (type === "guardian") return; // guardians hold their post

    if (!isMoving.current) {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        target.current   = randomTarget();
        isMoving.current = true;
      }
      return;
    }

    const targetVec = new THREE.Vector3(target.current[0], 0, target.current[1]);
    const dir  = targetVec.clone().sub(pos.current);
    const dist = dir.length();

    if (dist < 0.15) {
      isMoving.current  = false;
      idleTimer.current = 2 + Math.random() * 4;
      return;
    }

    const step = Math.min(1.8 * delta, dist);
    dir.normalize().multiplyScalar(step);
    pos.current.add(dir);
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      Math.atan2(dir.x, dir.z),
      delta * 6
    );
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onFollow?.(agentName); }}
    >
      <GroundGlow color={displayColor} repScore={repScore} aura={aura} />
      {type === "humanoid" && <HumanoidBody color={displayColor} />}
      {type === "robotic"  && <RoboticBody  color={displayColor} />}
      {type === "crystal"  && <CrystalBody  color={displayColor} />}
      {type === "creature" && <CreatureBody color={displayColor} />}
      {type === "abstract" && <AbstractBody color={displayColor} />}
      {type === "guardian" && <GuardianBody color={displayColor} />}

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
