"use client";

import { useEffect, useState } from "react";

// ── Kinetic headline (wow audit Tier 2) ─────────────────────────────────────
// Terminal-style decode: the headline starts as glyph noise and resolves
// left-to-right over ~0.9s. Server-rendered output is the REAL text (SEO and
// LCP safe); the scramble only runs client-side after mount, and not at all
// for prefers-reduced-motion.

const GLYPHS = "!<>-_\\/[]{}—=+*^?#____";

export default function DecodeText({
  text,
  accent,
}: {
  text:   string;  // plain part
  accent: string;  // cyan-highlighted tail
}) {
  const full = `${text} ${accent}`;
  const [out, setOut] = useState(full);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const DURATION = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION, 1);
      const resolved = Math.floor(full.length * t);
      let s = full.slice(0, resolved);
      for (let i = resolved; i < full.length; i++) {
        s += full[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split the rendered string back into plain/accent at the original boundary
  // so the accent color stays put while characters are still noise.
  const plainPart  = out.slice(0, text.length);
  const accentPart = out.slice(text.length + 1);

  return (
    <>
      {plainPart}{" "}
      <span className="text-cyan-400">{accentPart}</span>
    </>
  );
}
