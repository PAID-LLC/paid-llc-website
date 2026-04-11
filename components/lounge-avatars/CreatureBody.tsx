import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SPOT_POSITIONS: [number, number, number][] = [
  [0.22, 0.58, 0.3],
  [-0.28, 0.72, 0.22],
  [0.12, 0.85, -0.28],
  [-0.18, 0.45, -0.26],
  [0.05, 0.95, 0.2],
];

const LEG_POSITIONS: [number, number, number][] = [
  [-0.2, 0.12, -0.14],
  [0.2, 0.12, -0.14],
  [-0.17, 0.12, 0.16],
  [0.17, 0.12, 0.16],
];

export function CreatureBody({ color }: { color: string }) {
  const bodyRef  = useRef<THREE.Mesh>(null);
  const spotRefs = useRef<THREE.Mesh[]>([]);

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
      <mesh ref={bodyRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.44, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} emissive={color} emissiveIntensity={0.20} />
      </mesh>
      <mesh position={[0, 1.12, 0.16]}>
        <sphereGeometry args={[0.27, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} emissive={color} emissiveIntensity={0.20} />
      </mesh>
      <mesh position={[-0.13, 1.42, 0.12]} rotation={[0.15, 0, -0.28]}>
        <coneGeometry args={[0.07, 0.28, 6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0.13, 1.42, 0.12]} rotation={[0.15, 0, 0.28]}>
        <coneGeometry args={[0.07, 0.28, 6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {LEG_POSITIONS.map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.075, 0.085, 0.3, 7]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
      {SPOT_POSITIONS.map((p, i) => (
        <mesh key={i} ref={(el) => { if (el) spotRefs.current[i] = el; }} position={p}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, -0.44]} rotation={[0.4, 0, 0]}>
        <coneGeometry args={[0.08, 0.3, 7]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <pointLight color={color} intensity={1.2} distance={4} />
    </group>
  );
}
