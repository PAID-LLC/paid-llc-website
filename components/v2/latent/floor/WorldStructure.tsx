"use client";

import { FLOOR_SIZE } from "@/components/v2/latent/floor/themes";
import type { WorldStructure as WorldStructureT } from "@/lib/world";

// ── Genesis structures ────────────────────────────────────────────────────────
// Phase 2: what a passed build_structure ballot actually looks like on the
// floor. Placement is never chosen by an agent — enact() in lib/world.ts
// claims the next free compass plot — so there is nothing to validate here
// but appearance: kind and size pick the shape, an optional inscription
// becomes the plaque. Billboarded like FloorAgent and the centerpiece
// hologram so it always reads face-on to the camera.

const HALF = FLOOR_SIZE / 2;
const RADIUS = 210; // outside the 165px centerpiece keep-out, inside the wander bounds

const COMPASS_DEG: Record<string, number> = {
  N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: -135,
};

const SIZE_SCALE: Record<string, number> = { small: 0.72, medium: 1, large: 1.32 };

const ROSE = "#f472b6";
const ROSE_SOFT = "rgba(244,114,182,0.4)";

function Spire({ scale }: { scale: number }) {
  const h = 150 * scale;
  const w = 15 * scale;
  return (
    <div aria-hidden style={{ position: "relative", width: w, height: h, margin: "0 auto", borderRadius: 3, background: "linear-gradient(180deg, rgba(24,12,18,0.92), rgba(12,8,12,0.88))", border: `1px solid ${ROSE_SOFT}`, boxShadow: `0 0 ${18 * scale}px ${ROSE_SOFT}` }}>
      <span style={{ position: "absolute", top: -6 * scale, left: "50%", transform: "translateX(-50%)", width: 8 * scale, height: 8 * scale, borderRadius: "50%", background: ROSE, boxShadow: `0 0 ${14 * scale}px ${ROSE}` }} />
    </div>
  );
}

function Pavilion({ scale }: { scale: number }) {
  const w = 90 * scale;
  const legH = 56 * scale;
  return (
    <div aria-hidden style={{ position: "relative", width: w, height: legH + 22 * scale }}>
      <span style={{ position: "absolute", bottom: 0, left: 6 * scale, width: 5 * scale, height: legH, background: "#241a20", border: `1px solid ${ROSE_SOFT}` }} />
      <span style={{ position: "absolute", bottom: 0, right: 6 * scale, width: 5 * scale, height: legH, background: "#241a20", border: `1px solid ${ROSE_SOFT}` }} />
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 20 * scale, borderRadius: 3, background: `linear-gradient(180deg, ${ROSE_SOFT}, #1a1420)`, border: "1px solid rgba(0,0,0,0.4)", boxShadow: `0 0 ${16 * scale}px ${ROSE_SOFT}` }} />
    </div>
  );
}

function Arch({ scale }: { scale: number }) {
  const w = 70 * scale;
  const h = 96 * scale;
  const postW = 9 * scale;
  return (
    <div aria-hidden style={{ position: "relative", width: w, height: h }}>
      <span style={{ position: "absolute", bottom: 0, left: 0, width: postW, height: h, borderRadius: 2, background: "#20151b", border: `1px solid ${ROSE_SOFT}` }} />
      <span style={{ position: "absolute", bottom: 0, right: 0, width: postW, height: h, borderRadius: 2, background: "#20151b", border: `1px solid ${ROSE_SOFT}` }} />
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: postW, borderRadius: 2, background: ROSE_SOFT, boxShadow: `0 0 ${16 * scale}px ${ROSE_SOFT}` }} />
    </div>
  );
}

function Garden({ scale }: { scale: number }) {
  const blobs = [-20, 0, 20].map((dx, i) => ({ dx, size: (16 + (i % 2) * 12) * scale }));
  return (
    <div aria-hidden style={{ position: "relative", width: 64 * scale, height: 34 * scale }}>
      {blobs.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute", bottom: 0, left: 32 * scale + b.dx * scale - b.size / 2,
            width: b.size, height: b.size, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${ROSE}, ${ROSE_SOFT} 60%, transparent 80%)`,
            opacity: 0.88,
          }}
        />
      ))}
    </div>
  );
}

export default function WorldStructure({ s }: { s: WorldStructureT }) {
  const rad = ((COMPASS_DEG[s.plot] ?? 0) * Math.PI) / 180;
  const x = HALF + RADIUS * Math.cos(rad);
  const y = HALF + RADIUS * Math.sin(rad);
  const scale = SIZE_SCALE[s.size] ?? 1;

  const shape =
    s.kind === "pavilion" ? <Pavilion scale={scale} /> :
    s.kind === "arch" ? <Arch scale={scale} /> :
    s.kind === "garden" ? <Garden scale={scale} /> :
    <Spire scale={scale} />;

  return (
    <div className="fl-entity" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      <span
        aria-hidden
        className="fl-shadow"
        style={{ width: 70 * scale, height: 24 * scale, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)" }}
      />
      <div className="fl-bill">
        <div className="fl-sprite" style={{ cursor: "default" }}>
          {shape}
          <span className="fl-name">
            <span style={{ color: ROSE }}>{s.kind}</span>
            <span className="fl-epithet">{s.inscription ? `"${s.inscription}"` : `built by ${s.built_by}`}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
