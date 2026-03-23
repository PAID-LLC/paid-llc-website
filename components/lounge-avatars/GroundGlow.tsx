import { repGlow, repOpacity } from "@/lib/agents/reputation";

// Aura (0–1.5 practical range) adds up to +0.20 emissive intensity and +0.10 opacity
// on top of the rep-based baseline. Capped to prevent blowout.
const AURA_GLOW_FACTOR    = 0.15;
const AURA_OPACITY_FACTOR = 0.07;
const MAX_GLOW            = 0.90;
const MAX_OPACITY         = 0.50;

export function GroundGlow({
  color,
  repScore = 0,
  aura     = 0,
}: {
  color:     string;
  repScore?: number;
  aura?:     number;
}) {
  const intensity = Math.min(MAX_GLOW,    repGlow(repScore)    + aura * AURA_GLOW_FACTOR);
  const opacity   = Math.min(MAX_OPACITY, repOpacity(repScore) + aura * AURA_OPACITY_FACTOR);

  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.9, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
