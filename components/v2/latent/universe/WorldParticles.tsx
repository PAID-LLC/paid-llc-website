"use client";

import { Html } from "@react-three/drei";

const SLOTS = Array.from({ length: 6 }, (_, i) => ({
  angle: (i / 6) * 360,
  dur: 3.2 + (i % 3) * 0.7,
  delay: (i * 0.61) % 3,
}));

// ── World particle accent ───────────────────────────────────────────────────
// The map-scale echo of Centerpiece.tsx's <Particles>: each room's real
// glyph set (currency in the Bazaar, citations in the Hub, bits in the
// Sandbox) drifting up past the centerpiece, or a plain ember dot when a
// theme carries no glyph set. Pure CSS (a DOM particle via Html), matching
// how the floor already animates this rather than driving it through
// useFrame — cheaper and it's the same visual language.
export default function WorldParticles({
  glyphs,
  color,
  glow,
}: {
  glyphs?: string[];
  color: string;
  glow: string;
}) {
  return (
    <Html position={[0, 0.3, 0]} center distanceFactor={46} zIndexRange={[50, 50]}>
      <div style={{ position: "relative", width: 1, height: 1, pointerEvents: "none" }}>
        <style>{`
          @keyframes uvRise {
            0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
            15% { opacity: 0.9; }
            100% { transform: translate(-50%, -70px) scale(1); opacity: 0; }
          }
        `}</style>
        {SLOTS.map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: Math.cos((s.angle * Math.PI) / 180) * 14,
              top: Math.sin((s.angle * Math.PI) / 180) * 6,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: glyphs ? 12 : 6,
              fontWeight: 700,
              color: color,
              textShadow: `0 0 6px ${glow}`,
              animation: `uvRise ${s.dur}s ease-out infinite`,
              animationDelay: `${s.delay}s`,
            }}
          >
            {glyphs ? glyphs[i % glyphs.length] : "•"}
          </span>
        ))}
      </div>
    </Html>
  );
}
