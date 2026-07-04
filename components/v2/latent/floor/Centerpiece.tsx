"use client";

import type { CSSProperties, ReactNode } from "react";
import { FLOOR_SIZE, TICKER_ROWS, type FloorTheme } from "@/components/v2/latent/floor/themes";

// ── Floor centerpieces ───────────────────────────────────────────────────────
// The structure at the center of each 3D floor — the one thing that makes a
// room instantly recognizable from across the diorama. Everything renders
// inside .fl-floor coordinates (0..FLOOR_SIZE, preserve-3d, +z is up) using
// the shared fl-* classes from FloorScene's stylesheet. Flat layers sit on
// the tiles at small translateZ offsets; sprites live in .fl-bill billboards;
// genuinely 3D pieces (spindle rings, the sandbox cube) build in world space
// the same way the cutaway walls do.

const HALF = FLOOR_SIZE / 2;

// Deterministic particle drift slots (SSR-safe: no randomness at render time).
const P_SLOTS = Array.from({ length: 8 }, (_, i) => ({
  left: -44 + ((i * 29) % 88),
  dx: -18 + ((i * 13) % 36),
  dur: 2.3 + (i % 4) * 0.55,
  delay: (i * 0.67) % 2.7,
}));

// Rising particles over the centerpiece: glowing dots by default, or the
// theme's glyph set (currency in the Bazaar, citations in the Hub, bits in
// the Sandbox). `mult` scales speed — forge sparks fly, hub glyphs drift.
function Particles({ t, mult = 1 }: { t: FloorTheme; mult?: number }) {
  return (
    <>
      {P_SLOTS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={t.particleGlyph ? "fl-glyph" : "fl-ember"}
          style={
            {
              left: p.left,
              "--dx": `${p.dx}px`,
              animationDuration: `${p.dur * mult}s`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        >
          {t.particleGlyph ? t.particleGlyph[i % t.particleGlyph.length] : null}
        </span>
      ))}
    </>
  );
}

// Topic hologram floating above the structure (height set per theme).
function Holo({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <div className="fl-holo">
      <div aria-hidden className="fl-holo-beam" />
      <div
        className="rounded-lg border px-4 py-3 text-center backdrop-blur-sm"
        style={{ borderColor: t.accentSoft, background: "rgba(5,5,10,0.66)", boxShadow: `0 0 24px ${t.accentSoft}` }}
      >
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: t.accent }}>
          {t.topicLabel}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-300">{topic ?? "open floor"}</p>
      </div>
    </div>
  );
}

// Light wash on the tiles under the structure.
function GlowPool({ t }: { t: FloorTheme }) {
  return (
    <div
      aria-hidden
      className="fl-glowpool"
      style={{
        position: "absolute",
        left: HALF - 230,
        top: HALF - 230,
        width: 460,
        height: 460,
        transform: "translateZ(0.4px)",
        background: `radial-gradient(circle, ${t.accentSoft} 0%, transparent 62%)`,
        opacity: 0.8,
      }}
    />
  );
}

// Billboarded content anchored at the floor's center.
function CenterBill({ z = 0, children }: { z?: number; children: ReactNode }) {
  return (
    <div className="fl-entity" style={{ transform: `translate3d(${HALF}px, ${HALF}px, ${z}px)` }}>
      <div className="fl-bill">{children}</div>
    </div>
  );
}

// Flat ring on (or hovering over) the tiles; dashed rings rotate to read alive.
function Ring({
  r,
  z = 0.6,
  color,
  dash = false,
  spin,
  rev = false,
  opacity = 0.4,
  glow,
}: {
  r: number;
  z?: number;
  color: string;
  dash?: boolean;
  spin?: number;
  rev?: boolean;
  opacity?: number;
  glow?: string;
}) {
  const border = `1px ${dash ? "dashed" : "solid"} ${color}`;
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: HALF - r, top: HALF - r, width: r * 2, height: r * 2, transform: `translate3d(0,0,${z}px)` }}
    >
      <div
        className={spin ? (rev ? "fl-rot-rev" : "fl-rot") : undefined}
        style={
          {
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border,
            opacity,
            boxShadow: glow ? `0 0 24px ${glow}` : undefined,
            "--rdur": spin ? `${spin}s` : undefined,
          } as CSSProperties
        }
      />
    </div>
  );
}

const OCT = "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";
const HEX = "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0 50%)";

// ── roast pit: octagon coals + flame column ──────────────────────────────────
function Firepit({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <>
      <GlowPool t={t} />
      <Ring r={165} z={0.5} color={t.accentSoft} opacity={0.35} glow={t.accentSoft} />
      <div aria-hidden style={{ position: "absolute", left: HALF - 112, top: HALF - 112, width: 224, height: 224, transform: "translateZ(0.8px)", clipPath: OCT, background: "linear-gradient(135deg, #17171f, #101017)" }} />
      <div aria-hidden className="fl-dais-coals" style={{ position: "absolute", left: HALF - 96, top: HALF - 96, width: 192, height: 192, transform: "translateZ(1px)", clipPath: OCT, background: `radial-gradient(circle at 50% 48%, ${t.emberA} 0%, ${t.emberB} 32%, #200e07 60%, #0e0e14 82%)` }} />
      <CenterBill>
        <div aria-hidden className="fl-flame" />
        <Particles t={t} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── nexus: arrival pad + landing beam ────────────────────────────────────────
function Beacon({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <>
      <GlowPool t={t} />
      <Ring r={150} z={0.5} color={t.accentSoft} opacity={0.4} glow={t.accentSoft} />
      <Ring r={105} z={0.6} color={t.accentSoft} dash spin={40} opacity={0.45} />
      <Ring r={60} z={0.7} color={t.accent} opacity={0.5} />
      <div aria-hidden className="fl-padpulse" style={{ position: "absolute", left: HALF - 150, top: HALF - 150, width: 300, height: 300, transform: "translateZ(0.8px)" }} />
      {/* Raised halo hovering over the pad */}
      <Ring r={95} z={120} color={t.accentSoft} dash spin={18} rev opacity={0.5} />
      <CenterBill>
        <div aria-hidden className="fl-beam" style={{ width: 120, height: 300 }} />
        <div aria-hidden className="fl-beam-core" style={{ width: 32, height: 300 }} />
        <Particles t={t} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── bazaar: striped market stall + rising currency ───────────────────────────
function Market({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <>
      <GlowPool t={t} />
      <div aria-hidden style={{ position: "absolute", left: HALF - 140, top: HALF - 140, width: 280, height: 280, transform: "translateZ(0.8px)", borderRadius: "50%", border: `1px solid ${t.accentSoft}`, background: "radial-gradient(circle, #17171f 0%, #101017 70%)", opacity: 0.9 }} />
      <Ring r={165} z={0.5} color={t.accentSoft} opacity={0.35} glow={t.accentSoft} />
      <CenterBill>
        <div aria-hidden style={{ position: "absolute", bottom: -4, left: 0, transform: "translateX(-50%)", width: 250, height: 170 }}>
          {/* legs */}
          <div style={{ position: "absolute", bottom: 0, left: 30, width: 7, height: 118, background: "#1d1d27", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: 0, right: 30, width: 7, height: 118, background: "#1d1d27", border: "1px solid rgba(255,255,255,0.08)" }} />
          {/* counter */}
          <div style={{ position: "absolute", bottom: 0, left: 22, right: 22, height: 46, background: "linear-gradient(180deg, #1b1b25, #12121a)", border: "1px solid rgba(255,255,255,0.10)", borderTop: `2px solid ${t.accentSoft}` }} />
          {/* striped canopy */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 42, borderRadius: "4px 4px 0 0", background: `repeating-linear-gradient(90deg, ${t.accent} 0 26px, #1a1a24 26px 52px)`, opacity: 0.8, border: "1px solid rgba(0,0,0,0.4)", boxShadow: `0 0 22px ${t.accentSoft}` }} />
          {/* hanging sign */}
          <div className="font-mono" style={{ position: "absolute", top: 58, left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: "0.3em", whiteSpace: "nowrap", color: t.accent, textShadow: `0 0 10px ${t.accentSoft}` }}>
            OPEN 24/7
          </div>
        </div>
        <Particles t={t} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── forge: machine core, orbiting rings, sparks ──────────────────────────────
function Spindle({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <>
      <GlowPool t={t} />
      <div aria-hidden style={{ position: "absolute", left: HALF - 120, top: HALF - 120, width: 240, height: 240, transform: "translateZ(0.8px)", clipPath: HEX, background: "linear-gradient(135deg, #17171f, #101017)" }} />
      <div aria-hidden style={{ position: "absolute", left: HALF - 88, top: HALF - 88, width: 176, height: 176, transform: "translateZ(1px)", clipPath: HEX, background: `radial-gradient(circle, ${t.floorGlow} 0%, #0e0e14 78%)` }} />
      {/* The iteration loop: three rings orbiting the column at rising heights */}
      <Ring r={95} z={46} color={t.accentSoft} dash spin={11} opacity={0.55} />
      <Ring r={72} z={96} color={t.accentSoft} dash spin={8} rev opacity={0.55} />
      <Ring r={50} z={146} color={t.accent} dash spin={5.5} opacity={0.6} />
      <CenterBill>
        <div aria-hidden className="fl-beam-core" style={{ width: 10, height: 168, filter: "blur(1.5px)", boxShadow: `0 0 18px ${t.accentSoft}` }} />
        <Particles t={t} mult={0.55} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── vault: data obelisk with a scrolling ticker ──────────────────────────────
function Obelisk({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return { x: HALF + 100 * Math.cos(a), y: HALF + 100 * Math.sin(a) };
  });
  return (
    <>
      <GlowPool t={t} />
      {/* Vault door, seen from above */}
      <Ring r={130} z={0.5} color={t.accentSoft} opacity={0.5} glow={t.accentSoft} />
      <Ring r={85} z={0.6} color={t.accentSoft} dash spin={30} opacity={0.4} />
      {bolts.map((b, i) => (
        <div key={i} aria-hidden style={{ position: "absolute", left: b.x - 4, top: b.y - 4, width: 8, height: 8, transform: "translateZ(0.7px)", borderRadius: "50%", background: "#1c1c26", border: `1px solid ${t.accentSoft}` }} />
      ))}
      <CenterBill>
        <div
          aria-hidden
          style={{ position: "absolute", bottom: -4, left: 0, transform: "translateX(-50%)", width: 74, height: 200, borderRadius: 6, background: "linear-gradient(180deg, rgba(7,12,10,0.92), rgba(10,14,12,0.85))", border: `1px solid ${t.accentSoft}`, boxShadow: `0 0 26px ${t.accentSoft}`, overflow: "hidden" }}
        >
          <div className="fl-scroll font-mono" style={{ fontSize: 9, lineHeight: "16px", textAlign: "center", whiteSpace: "nowrap", color: t.emberA, textShadow: `0 0 6px ${t.emberB}` }}>
            {TICKER_ROWS.concat(TICKER_ROWS).map((row, i) => (
              <div key={i}>{row}</div>
            ))}
          </div>
        </div>
        <Particles t={t} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── sandbox: rotating wireframe cube that glitches ───────────────────────────
const CUBE = 120;
const C2 = CUBE / 2;

function GlitchCube({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  const face: CSSProperties = {
    position: "absolute",
    width: CUBE,
    height: CUBE,
    transformOrigin: "0 0",
    border: `1px solid ${t.accentSoft}`,
    background: t.wallTint,
  };
  // Vertical faces stand up exactly like the cutaway walls do.
  const stand = `rotateX(-90deg) translateY(${-CUBE}px)`;
  const standSide = `rotateZ(-90deg) rotateX(-90deg) translateY(${-CUBE}px)`;
  const corners: [string, string][] = [
    ["0deg", `translate(${HALF - 150}px, ${HALF - 150}px)`],
    ["90deg", `translate(${HALF + 130}px, ${HALF - 150}px)`],
    ["180deg", `translate(${HALF + 130}px, ${HALF + 130}px)`],
    ["270deg", `translate(${HALF - 150}px, ${HALF + 130}px)`],
  ];
  return (
    <>
      <GlowPool t={t} />
      {/* Test pad: dashed bounds, cell grid, corner brackets */}
      <div aria-hidden style={{ position: "absolute", left: HALF - 150, top: HALF - 150, width: 300, height: 300, transform: "translateZ(0.6px)", border: `1px dashed ${t.accentSoft}`, opacity: 0.55, backgroundImage: `repeating-linear-gradient(0deg, ${t.floorLine} 0 1px, transparent 1px 30px), repeating-linear-gradient(90deg, ${t.floorLine} 0 1px, transparent 1px 30px)` }} />
      {corners.map(([rot, pos], i) => (
        <div key={i} aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 20, height: 20, transform: `${pos} translateZ(0.7px) rotate(${rot})`, borderTop: `2px solid ${t.accent}`, borderLeft: `2px solid ${t.accent}`, opacity: 0.8 }} />
      ))}
      {/* The scenario cube: five wireframe faces spinning in world space */}
      <div aria-hidden style={{ position: "absolute", left: HALF, top: HALF, transform: "translate3d(0,0,30px)", transformStyle: "preserve-3d" }}>
        <div className="fl-glitch" style={{ position: "absolute", transformStyle: "preserve-3d" }}>
          <div className="fl-rot" style={{ position: "absolute", transformStyle: "preserve-3d", "--rdur": "16s" } as CSSProperties}>
            <div style={{ ...face, transform: `translate3d(${-C2}px, ${-C2}px, 0) ${stand}` }} />
            <div style={{ ...face, transform: `translate3d(${-C2}px, ${C2}px, 0) ${stand}` }} />
            <div style={{ ...face, transform: `translate3d(${-C2}px, ${C2}px, 0) ${standSide}` }} />
            <div style={{ ...face, transform: `translate3d(${C2}px, ${C2}px, 0) ${standSide}` }} />
            <div style={{ ...face, transform: `translate3d(${-C2}px, ${-C2}px, ${CUBE}px)` }} />
          </div>
        </div>
      </div>
      {/* The scenario seed glowing at the cube's heart */}
      <CenterBill z={90}>
        <div aria-hidden className="fl-glowpool" style={{ position: "absolute", left: -13, top: -13, width: 26, height: 26, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent} 0%, transparent 70%)` }} />
      </CenterBill>
      <CenterBill>
        <Particles t={t} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

// ── hub: floating holo pages + citation glyphs ───────────────────────────────
const PAGES = [
  { x: -120, y: 44, rot: -5, delay: 0 },
  { x: 26, y: 88, rot: 3, delay: -2 },
  { x: -42, y: 150, rot: -2, delay: -4 },
];

function Archive({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  return (
    <>
      <GlowPool t={t} />
      <Ring r={125} z={0.5} color={t.accentSoft} opacity={0.35} glow={t.accentSoft} />
      <Ring r={75} z={0.6} color={t.accentSoft} dash spin={50} opacity={0.4} />
      <CenterBill>
        <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, width: 0, height: 0 }}>
          {PAGES.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: p.x, bottom: p.y, transform: `rotate(${p.rot}deg)` }}>
              <div className="fl-hover" style={{ width: 96, padding: "8px 9px", borderRadius: 4, background: "rgba(5,5,10,0.72)", border: `1px solid ${t.accentSoft}`, boxShadow: `0 0 18px ${t.accentSoft}`, animationDelay: `${p.delay}s` }}>
                {[72, 64, 76, 46].map((w, j) => (
                  <div key={j} style={{ width: w, height: 2, marginTop: j === 0 ? 0 : 6, background: t.accentSoft, opacity: j === 0 ? 0.9 : 0.5 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Particles t={t} mult={1.4} />
        <Holo t={t} topic={topic} />
      </CenterBill>
    </>
  );
}

export default function Centerpiece({ t, topic }: { t: FloorTheme; topic?: string | null }) {
  switch (t.centerpiece) {
    case "beacon":
      return <Beacon t={t} topic={topic} />;
    case "market":
      return <Market t={t} topic={topic} />;
    case "spindle":
      return <Spindle t={t} topic={topic} />;
    case "obelisk":
      return <Obelisk t={t} topic={topic} />;
    case "glitchcube":
      return <GlitchCube t={t} topic={topic} />;
    case "archive":
      return <Archive t={t} topic={topic} />;
    case "firepit":
    default:
      return <Firepit t={t} topic={topic} />;
  }
}
