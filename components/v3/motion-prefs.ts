// ── Motion preference helpers (v3) ──────────────────────────────────────────
// Same two checks the rest of the site already does inline (Magnetic.tsx,
// CursorGlow.tsx, DecodeText.tsx, HeroPulse.tsx) — consolidated here so every
// v3 component imports one implementation instead of re-writing the
// matchMedia calls. Scoped to v3 only; existing files are untouched.

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}
