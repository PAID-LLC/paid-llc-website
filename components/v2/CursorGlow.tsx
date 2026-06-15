"use client";

import { useEffect, useRef } from "react";

// ── Cursor-reactive grid glow (wow audit Tier 1.3) ──────────────────────────
// A soft cyan radial light that follows the pointer across the fixed v2
// backdrop, brightening the hairline grid near the cursor. Writes coordinates
// to CSS custom properties from a rAF-throttled mousemove handler — no React
// re-renders, no layout work, GPU-composited.
//
// Touch devices (no fine pointer) and prefers-reduced-motion users get
// nothing: the component renders an inert layer that never lights up.

export default function CursorGlow() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let x = 0, y = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        node.style.setProperty("--mx", `${x}px`);
        node.style.setProperty("--my", `${y}px`);
        node.style.opacity = "1";
      });
    };
    const onLeave = () => { node.style.opacity = "0"; };

    // Contextual cursor (Fable 5 design pass 2026-06-15): tighten and brighten
    // the glow over agent/commerce links so the cyan = agent signal carries
    // into the pointer itself. Delegated, so it covers links added later.
    const HOT = 'a[href*="latent-space"],a[href*="bazaar"],a[href*="registry"],a[href*="credits"],a[href*="arena"],[data-agent]';
    const onOver = (e: Event) => {
      if ((e.target as Element)?.closest?.(HOT)) {
        node.style.setProperty("--cg-r", "300px");
        node.style.setProperty("--cg-a", "0.15");
      }
    };
    const onOut = (e: Event) => {
      if ((e.target as Element)?.closest?.(HOT)) {
        node.style.setProperty("--cg-r", "420px");
        node.style.setProperty("--cg-a", "0.07");
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={el}
      aria-hidden
      className="absolute inset-0 opacity-0"
      style={{
        transition: "opacity 0.6s ease, background 0.3s ease",
        background:
          "radial-gradient(var(--cg-r, 420px) circle at var(--mx, 50%) var(--my, 30%), rgba(34,211,238,var(--cg-a, 0.07)), transparent 70%)",
      }}
    >
      {/* Brightened grid lines, revealed only inside the cursor radius */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(34,211,238,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.10) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 30%), black, transparent 75%)",
          maskImage:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 30%), black, transparent 75%)",
        }}
      />
    </div>
  );
}
