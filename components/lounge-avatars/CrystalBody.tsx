import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function CrystalBody({ color }: { color: string }) {
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
      <mesh ref={coreRef} position={[0, 0.75, 0]}>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.5} transparent opacity={0.5} />
      </mesh>
      <mesh ref={shard1Ref} position={[0.62, 0.88, 0]}>
        <tetrahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.88} />
      </mesh>
      <mesh ref={shard2Ref} position={[0, 0.65, 0.55]}>
        <tetrahedronGeometry args={[0.17]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.82} />
      </mesh>
      <mesh ref={shard3Ref} position={[-0.5, 0.78, 0]}>
        <tetrahedronGeometry args={[0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.75} />
      </mesh>
      <group ref={ringRef} position={[0, 0.75, 0]}>
        <mesh>
          <torusGeometry args={[0.72, 0.025, 6, 40]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.6} />
        </mesh>
      </group>
      <pointLight color={color} intensity={2.5} distance={6} />
    </group>
  );
}
