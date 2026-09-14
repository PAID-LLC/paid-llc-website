// ── The sponsor slot, before there is a sponsor ──────────────────────────────
// The slot ships on day one carrying our own things. Two reasons, neither of
// them decorative: an empty slot looks like a broken page, and a slot that has
// been running for a month is a far easier thing to sell than a promise to build
// one. Replace an entry with a paying advertiser by adding a `sponsor` object to
// the edition row; the component prefers that over anything here.
//
// Rotation is by day-of-year so a given edition always renders the same ad. That
// matters for server rendering: a random pick would differ between the initial
// render and any revalidation, and the archive would change under the reader.

export interface HouseAd {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}

export const HOUSE_ADS: HouseAd[] = [
  {
    id: "website-audit",
    eyebrow: "From PAID LLC",
    title: "Have an AI agent read your website",
    body:
      "The same kind of analysis this page runs on comment sections, pointed at your " +
      "homepage: positioning, clarity, the messaging gaps a visitor notices and you " +
      "cannot. Structured brief back in minutes.",
    cta: "See the audit",
    href: "/website-audit",
  },
  {
    id: "guides",
    eyebrow: "From PAID LLC",
    title: "Seventeen guides to the AI tools you already pay for",
    body:
      "Copilot, ChatGPT, Claude, Gemini. Written for people who want the thing working " +
      "by the end of the afternoon, not a survey of the field.",
    cta: "Browse the guides",
    href: "/digital-products",
  },
  {
    id: "quick-wins",
    eyebrow: "Free",
    title: "The AI quick-wins checklist",
    body:
      "Ten automations you can set up this week without writing code, with the exact " +
      "steps for each. No course, no upsell, just the checklist.",
    cta: "Get the checklist",
    href: "/free/ai-quick-wins",
  },
];

/** Stable per-edition rotation. */
export function houseAdFor(editionDate: string): HouseAd {
  const [y, m, d] = editionDate.split("-").map(Number);
  const dayNumber =
    Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
      : 0;
  return HOUSE_ADS[Math.abs(dayNumber) % HOUSE_ADS.length];
}
