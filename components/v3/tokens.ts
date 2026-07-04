import { v2 } from "@/components/v2/tokens";

// ── V3 type-scale extension ─────────────────────────────────────────────────
// Same palette/card/button/chip recipes as v2 (unchanged — the redesign
// keeps the existing color scheme). Only the headline scale grows, for the
// hyper-bold homepage treatment. Kept local to v3 so components/v2/tokens.ts
// (used by every other page) is never touched by this pass.
export const v3 = {
  ...v2,
  h1: "font-mono text-6xl font-bold tracking-tight text-zinc-100 sm:text-8xl lg:text-[7.5rem] leading-[0.94]",
  h2: "font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-6xl leading-[1.02]",
  h3: "font-mono text-xl font-semibold text-zinc-100 sm:text-2xl",
};
