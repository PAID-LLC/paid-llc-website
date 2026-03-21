import { repGlow, repOpacity } from "@/lib/agents/reputation";

export function GroundGlow({ color, repScore = 0 }: { color: string; repScore?: number }) {
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.9, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={repGlow(repScore)}
        transparent
        opacity={repOpacity(repScore)}
      />
    </mesh>
  );
}
