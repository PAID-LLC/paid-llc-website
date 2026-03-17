import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function GuardianBody({ color }: { color: string }) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const capRef   = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1Ref.current) ring1Ref.current.rotation.y =  t * 0.45;
    if (ring2Ref.current) ring2Ref.current.rotation.y = -t * 0.32;
    if (ring3Ref.current) ring3Ref.current.rotation.x =  t * 0.22;
    if (capRef.current)
      (capRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.4 + Math.sin(t * 1.6) * 0.9;
  });

  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.09, 0.2, 1.2, 6]} />
        <meshStandardMaterial color={color} metalness={0.92} roughness={0.05} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <group ref={ring1Ref} position={[0, 0.28, 0]}>
        <mesh>
          <torusGeometry args={[0.46, 0.028, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} transparent opacity={0.85} />
        </mesh>
      </group>
      <group ref={ring2Ref} position={[0, 0.66, 0]}>
        <mesh>
          <torusGeometry args={[0.38, 0.022, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.9} />
        </mesh>
      </group>
      <group ref={ring3Ref} position={[0, 1.04, 0]}>
        <mesh>
          <torusGeometry args={[0.28, 0.018, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} transparent opacity={0.95} />
        </mesh>
      </group>
      <mesh ref={capRef} position={[0, 1.32, 0]}>
        <octahedronGeometry args={[0.21]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} metalness={0.8} roughness={0.05} />
      </mesh>
      <pointLight color={color} intensity={2.8} distance={6} />
    </group>
  );
}
