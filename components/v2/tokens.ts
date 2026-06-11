// ── V2 design tokens ───────────────────────────────────────────────────────
//
// Shared class recipes for the /v2 redesign. Every v2 component composes
// from these instead of redeclaring styles, so the system stays consistent
// and a palette change is a one-file edit.
//
// Palette: near-black base (#07070b), zinc text ramp, cyan accent for
// system/agent signals, amber reserved for staging/warning states.

export const v2 = {
  // Layout
  section: "mx-auto max-w-7xl px-6",
  sectionPad: "py-20 sm:py-28",
  divider: "border-t border-white/[0.06]",

  // Type
  kicker: "font-mono text-xs uppercase tracking-[0.2em] text-cyan-400",
  h1: "font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-6xl",
  h2: "font-mono text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl",
  h3: "font-mono text-lg font-semibold text-zinc-100",
  body: "text-base leading-relaxed text-zinc-400",
  bodySm: "text-sm leading-relaxed text-zinc-400",
  mono: "font-mono text-xs text-zinc-500",

  // Surfaces
  card: "rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-cyan-400/20",
  cardStatic: "rounded-xl border border-white/[0.06] bg-white/[0.02] p-6",
  terminal:
    "rounded-xl border border-white/[0.08] bg-[#0b0b12] font-mono text-sm shadow-[0_0_40px_rgba(34,211,238,0.04)]",

  // Controls
  btnPrimary:
    "inline-flex items-center gap-2 rounded-md bg-cyan-400/10 border border-cyan-400/40 px-5 py-2.5 font-mono text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20 hover:border-cyan-400/60",
  btnGhost:
    "inline-flex items-center gap-2 rounded-md border border-white/10 px-5 py-2.5 font-mono text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100",

  // Signals
  chip: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400",
  chipLive:
    "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300",
  dotLive: "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse",
};
