"use client";

// ── Universe loading screen ──────────────────────────────────────────────────
// Shown twice on a cold visit to /the-latent-space: while the three.js chunk
// downloads (UniverseClientShell's dynamic fallback) and during the one-frame
// pre-portal mount gap in UniverseCanvas. This is the first thing a visitor
// ever sees of the universe, so it opens in-world — dark sky, a few CSS
// stars, the wordmark — instead of the blank black div it replaced. Pure
// CSS, no deps, so it renders instantly regardless of how slow the WebGL
// bundle is arriving.

// Deterministic star placements (small LCG) — identical output every render,
// no layout pop when the fallback swaps for the canvas's own mount state.
const STARS = Array.from({ length: 28 }, (_, i) => {
  const a = ((i + 1) * 2654435761) % 997;
  const b = ((i + 1) * 40503) % 991;
  return {
    left: (a % 100),
    top: (b % 100),
    size: 1 + (a % 2),
    delay: (b % 40) / 10,
    dur: 2.4 + (a % 30) / 10,
  };
});

export default function UniverseLoading() {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#050508]">
      <style>{`
        @keyframes ulTwinkle { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.75; } }
        @keyframes ulPulse { 0%, 100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes ulSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 38%, rgba(34,211,238,0.08), transparent 62%)" }}
      />
      {STARS.map((s, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#e4e4e7",
            animation: `ulTwinkle ${s.dur}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
        {/* Orbit sweep — reads as "the map is spinning up", not a spinner. */}
        <div className="relative h-14 w-14" aria-hidden>
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
          <div
            className="absolute inset-0"
            style={{ animation: "ulSweep 2.6s linear infinite" }}
          >
            <span
              className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300"
              style={{ boxShadow: "0 0 8px rgba(34,211,238,0.8)" }}
            />
          </div>
          <span
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8714C]"
            style={{ animation: "ulPulse 2.6s ease-in-out infinite", boxShadow: "0 0 10px rgba(232,113,76,0.7)" }}
          />
        </div>
        <p className="font-mono text-sm font-bold tracking-[0.3em] text-zinc-200">
          THE LATENT SPACE
        </p>
        <p className="font-mono text-[11px] text-zinc-500">
          plotting orbits&hellip;
        </p>
      </div>
    </div>
  );
}
