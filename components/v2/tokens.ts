// ── V2 design tokens ───────────────────────────────────────────────────────
//
// Shared class recipes for the /v2 redesign. Every v2 component composes
// from these instead of redeclaring styles, so the system stays consistent
// and a palette change is a one-file edit.
//
// Palette: near-black base (#07070b), zinc text ramp, dual accents:
//   cyan       — agent/system signals (Latent Space, registry, MCP, live data)
//   terracotta — the PAID brand (#C14826, brand-guidelines.md): the human
//                layer — logo, founder, news, CTAs that lead to a person
// Amber reserved for warning states. Max two accents per surface.

export const v2 = {
  // Layout
  section: "mx-auto max-w-7xl px-6",
  sectionPad: "py-20 sm:py-28",
  divider: "border-t border-white/[0.06]",

  // Type — two-tone rhythm (Travis, 2026-06-12): in every section the LEAD
  // element is terracotta (kicker, first CTA, first card) and the PARTNER
  // element is teal (headline accents, second CTA, alternating cards).
  kicker: "font-mono text-xs uppercase tracking-[0.2em] text-[#E8714C]",
  kickerBrand: "font-mono text-xs uppercase tracking-[0.2em] text-[#E8714C]",
  h1: "font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-6xl",
  h2: "font-mono text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl",
  h3: "font-mono text-lg font-semibold text-zinc-100",
  body: "text-base leading-relaxed text-zinc-400",
  bodySm: "text-sm leading-relaxed text-zinc-400",
  mono: "font-mono text-xs text-zinc-500",

  // Surfaces — glassmorphic (Fable 5 design pass 2026-06-15): backdrop-blur +
  // a brighter hairline border so cards read as layered glass over the grain
  // backdrop, not flat panels. Propagates everywhere the recipes are used.
  card: "rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 transition-colors hover:border-cyan-400/25",
  cardStatic: "rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6",
  terminal:
    "rounded-xl border border-white/[0.08] bg-[#0b0b12] font-mono text-sm shadow-[0_0_40px_rgba(34,211,238,0.04)]",

  // Controls — btnPrimary terracotta (lead), btnSecondary teal (partner):
  // when two CTAs sit together, first is primary, second is secondary.
  btnPrimary:
    "inline-flex items-center gap-2 rounded-md bg-[#C14826]/15 border border-[#C14826]/50 px-5 py-2.5 font-mono text-sm font-medium text-[#E8714C] transition-colors hover:bg-[#C14826]/25 hover:border-[#C14826]/70",
  btnSecondary:
    "inline-flex items-center gap-2 rounded-md bg-cyan-400/10 border border-cyan-400/40 px-5 py-2.5 font-mono text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20 hover:border-cyan-400/60",
  btnGhost:
    "inline-flex items-center gap-2 rounded-md border border-white/10 px-5 py-2.5 font-mono text-sm text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100",
  btnBrand:
    "inline-flex items-center gap-2 rounded-md bg-[#C14826]/15 border border-[#C14826]/50 px-5 py-2.5 font-mono text-sm font-medium text-[#E8714C] transition-colors hover:bg-[#C14826]/25 hover:border-[#C14826]/70",

  // Signals
  chip: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400",
  chipLive:
    "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300",
  dotLive: "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse",
};
