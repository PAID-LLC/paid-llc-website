"use client";

import { useRef } from "react";

// ── Micro-interactions (wow audit Tier 1.5) ─────────────────────────────────
// Two pointer-tracking wrappers, both no-ops for coarse pointers and
// prefers-reduced-motion. Direct style writes from event handlers — no React
// state, no re-renders.
//
// <Magnetic>: children drift up to ~5px toward the cursor and spring back.
//   Wrap CTAs: <Magnetic><Link ...>...</Link></Magnetic>
//
// <Tilt>: 3D perspective tilt up to ~5deg following the cursor across the
//   element, with a press-down on click. Wrap cards.

function interactive(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Magnetic({ children }: { children: React.ReactNode }) {
  const el = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const node = el.current;
    if (!node || !interactive()) return;
    const r = node.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    node.style.transform = `translate(${dx * 0.14}px, ${dy * 0.22}px)`;
  };
  const onLeave = () => {
    const node = el.current;
    if (!node) return;
    node.style.transform = "translate(0, 0)";
  };

  return (
    <span
      ref={el}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="inline-block transition-transform duration-300 ease-out will-change-transform"
    >
      {children}
    </span>
  );
}

export function Tilt({
  children,
  max = 5,
  className = "",
}: {
  children: React.ReactNode;
  max?: number;       // max tilt in degrees
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const node = el.current;
    if (!node || !interactive()) return;
    const r = node.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    node.style.transform =
      `perspective(700px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const onLeave = () => {
    const node = el.current;
    if (!node) return;
    node.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg)";
  };
  const onDown = () => {
    const node = el.current;
    if (!node || !interactive()) return;
    node.style.transform += " scale(0.985)";
  };

  return (
    <div
      ref={el}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseDown={onDown}
      onMouseUp={onLeave}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}
