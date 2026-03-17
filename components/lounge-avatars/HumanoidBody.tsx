import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function HumanoidBody({ color }: { color: string }) {
  const torsoRef = useRef<THREE.Mesh>(null);
  const eyeLRef  = useRef<THREE.Mesh>(null);
  const eyeRRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (torsoRef.current) torsoRef.current.scale.y = 1 + Math.sin(t * 1.4) * 0.025;
    const eyeGlow = 1.5 + Math.sin(t * 2.2) * 0.5;
    if (eyeLRef.current) (eyeLRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
    if (eyeRRef.current) (eyeRRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eyeGlow;
  });

  return (
    <group>
      <mesh ref={torsoRef} position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.19, 0.23, 0.85, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={eyeLRef} position={[-0.09, 1.32, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={eyeRRef} position={[0.09, 1.32, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[-0.34, 0.72, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[-0.52, 0.47, 0]} rotation={[0, 0, 0.1]}>
        <cylinderGeometry args={[0.055, 0.065, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.34, 0.72, 0]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0.52, 0.47, 0]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.055, 0.065, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-0.11, 0.17, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.11, 0.17, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.38, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <pointLight color={color} intensity={0.8} distance={3} />
    </group>
  );
}
