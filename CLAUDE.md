# PAID LLC Website

You are an expert Next.js developer building the PAID LLC website. This is a professional AI consulting firm website. It must look senior-built, not AI-generated. Clean, modern, fast, conversion-focused.

## Tech Stack

*Corrected 2026-08-19. Every line below was wrong except styling, language, and fonts, and agent sessions were reading it first.*

- **Framework:** Next.js 15.5.2 (App Router). Every API route must declare `export const runtime = "edge"` -- all 159 currently do.
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Hosting:** Cloudflare Pages / Workers, NOT Vercel. Deploys via `scripts/build-cf.mjs`, a custom `@cloudflare/next-on-pages` pipeline.
- **Fonts:** Montserrat (headings) + Inter (body) via Google Fonts
- **Forms:** own API route (`app/api/contact`), not Formspree
- **Payments:** Stripe (live), plus Coinbase and x402 rails. Not Gumroad. Every payment path must record through `lib/ledger.ts`.
- **Data:** Supabase Postgres, service-key only, deny-all RLS on every table

### Before bumping any dependency

Read the pin comments in `scripts/build-cf.mjs:39-43` first. `vercel` is pinned to 54.19.0 because 54.20.x broke lambda route mapping. That script is excluded from lint and has no test coverage, so a broken patch step fails silently at deploy time, not in CI.

## Brand

- **Primary Color:** `#C14826` (Terracotta Orange)
- **Secondary Color:** `#1A1A1A` (Warm Black)
- **Neutral Light:** `#E8E4E0` (Ash -- section backgrounds)
- **Background:** `#FFFFFF`
- **Logo:** Available at `../Executive Assistant Claude Cowork/references/brand/logo/PaidLogo.png`
- **Founder Photo:** Available at `../Executive Assistant Claude Cowork/references/brand/photos/Founder Photo.png`

## Design Rules (non-negotiable)

- Heavy white space -- never crowded
- Consistent 8px spacing grid
- Max 2 fonts: Montserrat headings, Inter body
- No stock photo clichés
- Every page has exactly one primary CTA
- Sticky navigation
- All CTAs are action verbs ("Start a Project", not "Click Here")
- Mobile-first, Lighthouse 90+ target

## Site Structure

```
/ (Home)
/services
/digital-products
/about
/contact
/privacy
/terms
```

## Pages: Build Order (MVP) -- HISTORICAL, all shipped

Kept for context on original intent. The site launched ~2026-03-14 and has long
since passed this list: all six pages are live, plus the digital products
storefront, the Ask Arti chatbot, the admin surfaces, and The Latent Space
(registry, rooms, Bazaar, arena, souvenirs, eight worlds). Do not treat this as
a to-do list.

1. ~~Homepage~~ -- shipped
2. ~~Services page~~ -- shipped
3. ~~Contact page~~ -- shipped, on its own API route (not Formspree)
4. ~~About page~~ -- shipped
5. ~~Digital Products page~~ -- shipped, 17 guides, Stripe checkout and delivery live
6. ~~Legal pages~~ -- shipped

## Content Reference

Full content and copy is in:
`../Executive Assistant Claude Cowork/projects/website-launch/website-build-prompt.md`

## Development Workflow

1. Build component
2. Run `npm run dev` and take a screenshot via Playwright MCP to visually review
3. Fix issues, screenshot again
4. Only move to next component when this one looks right

## Assets

Copy brand assets into `public/` before referencing them in code:
- `public/logo.png` -- from references/brand/logo/PaidLogo.png
- `public/founder.png` -- from references/brand/photos/Founder Photo.png
- `app/icon.png` -- copy from `../Executive Assistant Claude Cowork/references/brand/logo/PaidLogo.png`; Next.js App Router auto-serves it as favicon

## Deployment

Push to GitHub → auto-deploys to **Cloudflare Pages** on merge to main.
Repo name: `paid-llc-website`

The Worker bundle sits near Cloudflare's 10 MiB cap (the $5/mo Workers Paid tier;
the 3 MiB free cap was blown on 2026-07-06). Adding another three.js surface is a
bundle-size decision before it is a design decision. Measure before adding one.
