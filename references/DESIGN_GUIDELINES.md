# PAID LLC Frontend Design Guidelines

Source of truth for the v2 visual system. Point Claude Code at this file on any UI
task so generated work avoids the generic-AI look and stays on-brand. Derived from
the v2 token system plus the 2026-06-15 Fable 5 / Claude Design research pass.

## Non-negotiables (kill the "AI-generated" tells)
- No Inter-everywhere. Mono is the identity face (`font-mono`) for headings, labels, data, and code. Body can be sans, but type must feel deliberate.
- No purple/indigo gradients. The palette is a near-black base with a constrained two-tone accent.
- No flat default-Tailwind cards. Surfaces are glassmorphic (see Surfaces).
- No scattered micro-animations. Motion is meaningful: scroll reveals and View Transitions, not decoration.

## Palette
- Base: `#07070b`. Text ramp: zinc-100 (headings) down to zinc-500 (mono captions).
- Two-tone, used semantically, max two accents per surface:
  - Terracotta `#C14826` / `#E8714C` = the human/brand LEAD (logo, founder, first CTA, lead kicker).
  - Cyan/teal `#22d3ee` (`cyan-300`/`cyan-400`) = the agent/commerce/system PARTNER (Latent Space, Bazaar, registry, live data, second CTA).
- In every section the lead element is terracotta, the partner element is teal. Alternate kickers terracotta -> teal down a page.
- Amber reserved for warnings only.

## Typography
- Compose from `components/v2/tokens.ts` (`v2.h1/h2/h3`, `v2.kicker`, `v2.body/bodySm`, `v2.mono`). Never redeclare.
- Kickers: mono, uppercase, `tracking-[0.2em]`.
- Variable-weight accent: `.v2-weight-shift` blooms weight on hover. Use sparingly on branded headings, not body text.

## Surfaces (glassmorphism)
- Use `v2.card` / `v2.cardStatic`: `border-white/[0.08]`, `bg-white/[0.03]`, `backdrop-blur-sm`, `rounded-xl`, `p-6`. The blur over the grain backdrop is what gives layered depth.
- Code/terminal blocks: `bg-[#0b0b12]` with a `border-white/[0.08]` hairline.

## Depth and texture
- The `V2Frame` backdrop layers: radial cyan glow + hairline grid + `.v2-grain` film noise + `CursorGlow`. Do not flatten it.
- `.v2-grain` is a fixed, ~3% fractal-noise data-URI layer. It is what removes the last of the flat look.

## Motion
- Scroll reveals: add `.v2-reveal` to sections. Pure CSS `animation-timeline: view()`, reduced-motion safe.
- Cross-page: View Transitions via `@view-transition` in globals.css. Do not add per-element transition libraries.
- Cursor: `CursorGlow` follows the pointer and tightens/brightens over agent/commerce links (the cyan = agent signal extends to the cursor). Reduced-motion and touch users get nothing.

## Layout rhythm
- `v2.section` (`mx-auto max-w-7xl px-6`) + `v2.sectionPad` (`py-20 sm:py-28`).
- Separate sections with `v2.divider` (`border-t border-white/[0.06]`), not heavy rules.

## Buttons
- `v2.btnPrimary` (terracotta) leads; `v2.btnSecondary` (cyan) is the partner/second action. `v2.btnGhost` for tertiary. Crypto/agent rails lean cyan.

## How to apply (Claude Code)
1. Compose every style from `tokens.ts`. If a recipe is missing, add it there, not inline.
2. New pages: render frame + no skin (add the exact path to `V2_NATIVE` in `components/SiteChrome.tsx`). The `.v2-blog` skin is the legacy interim remap, terracotta-only, no teal. Do not ship new pages on it.
3. Honor the two-tone semantics: terracotta = human/brand, cyan = agent/commerce.

## Note on third-party design skills
The extracted "Claude Design" system prompt circulating on Reddit is unvetted. Encode principles here instead of installing marketplace skills blind. Any third-party skill is a supply-chain risk: read its SKILL.md and scripts before use.
