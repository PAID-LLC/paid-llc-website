import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function RoboticBody({ color }: { color: string }) {
  const visorRef   = useRef<THREE.Mesh>(null);
  const antennaRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (visorRef.current)
      (visorRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(t * 3.5) * 0.8;
    if (antennaRef.current)
      (antennaRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.floor(Math.sin(t * 2) + 1) * 2.5;
  });

  return (
    <group>
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.38]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} emissive={color} emissiveIntensity={0.30} />
      </mesh>
      <mesh position={[0, 0.6, 0.2]}>
        <boxGeometry args={[0.34, 0.34, 0.02]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.05} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {[-0.1, 0, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.58, 0.22]}>
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1 + i * 0.3} />
        </mesh>
      ))}
      <mesh position={[-0.42, 0.78, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.42, 0.78, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.47, 0.5, 0]}>
        <boxGeometry args={[0.14, 0.45, 0.14]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.47, 0.5, 0]}>
        <boxGeometry args={[0.14, 0.45, 0.14]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.47, 0.22, 0]}>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0.47, 0.22, 0]}>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[-0.15, 0.17, 0]}>
        <boxGeometry args={[0.18, 0.38, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.15, 0.17, 0]}>
        <boxGeometry args={[0.18, 0.38, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.15, 0.02, 0.06]}>
        <boxGeometry args={[0.2, 0.08, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.15, 0.02, 0.06]}>
        <boxGeometry args={[0.2, 0.08, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[0.44, 0.38, 0.38]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.05} emissive={color} emissiveIntensity={0.30} />
      </mesh>
      <mesh ref={visorRef} position={[0, 1.23, 0.2]}>
        <boxGeometry args={[0.3, 0.07, 0.02]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.22, 6]} />
        <meshStandardMaterial color={color} metalness={0.9} />
      </mesh>
      <mesh ref={antennaRef} position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
      </mesh>
      <pointLight color={color} intensity={1.0} distance={4} />
    </group>
  );
}
