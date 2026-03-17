import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 10;
const PARTICLE_POSITIONS = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  return [Math.cos(angle) * 0.72, Math.sin(angle) * 0.12, Math.sin(angle) * 0.72] as [number, number, number];
});

export function AbstractBody({ color }: { color: string }) {
  const ring1Ref    = useRef<THREE.Group>(null);
  const ring2Ref    = useRef<THREE.Group>(null);
  const ring3Ref    = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Group>(null);
  const coreRef     = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1Ref.current)    ring1Ref.current.rotation.z    = t * 0.75;
    if (ring2Ref.current)    ring2Ref.current.rotation.x    = t * 0.52;
    if (ring3Ref.current)    ring3Ref.current.rotation.y    = t * 1.05;
    if (particleRef.current) particleRef.current.rotation.y = t * 0.38;
    if (coreRef.current) {
      const scale = 0.9 + Math.sin(t * 2.2) * 0.12;
      coreRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group>
      <mesh ref={coreRef} position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} transparent opacity={0.9} />
      </mesh>
      <group ref={ring1Ref} position={[0, 0.72, 0]}>
        <mesh>
          <torusGeometry args={[0.44, 0.045, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
        </mesh>
      </group>
      <group ref={ring2Ref} position={[0, 0.72, 0]}>
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[0.56, 0.032, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
        </mesh>
      </group>
      <group ref={ring3Ref} position={[0, 0.72, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2.5]}>
          <torusGeometry args={[0.35, 0.055, 8, 36]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
        </mesh>
      </group>
      <group ref={particleRef} position={[0, 0.72, 0]}>
        {PARTICLE_POSITIONS.map((p, i) => (
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
