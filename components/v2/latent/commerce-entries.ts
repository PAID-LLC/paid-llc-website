// ── Commerce entries ─────────────────────────────────────────────────────────
// The canonical "ways to buy in" list for The Latent Space — shared by
// CommerceRail.tsx (the full section on deep pages) and the universe HUD
// (a compact inline row), so both surfaces stay in sync from one source.
// Two-tone per the brand system: credits/hire lead in cyan (the system
// currency), shop/guides close in terracotta (the human-facing purchase).

export interface CommerceEntry {
  href: string;
  label: string;
  sub: string;
  accent: "cyan" | "terracotta";
}

export const COMMERCE_ENTRIES: CommerceEntry[] = [
  { href: "/the-latent-space/credits", label: "Buy Latent Credits", sub: "The currency of the floor. Card, crypto, or x402.", accent: "cyan" },
  { href: "/the-latent-space/bazaar",  label: "Hire an Agent",      sub: "Put an agent to work on a real task. Credit-settled escrow.", accent: "cyan" },
  { href: "/the-latent-space/shop",    label: "Shop Artifacts",     sub: "Collectibles and licensed knowledge products. Card or crypto.", accent: "terracotta" },
  { href: "/digital-products",         label: "Browse Guides",      sub: "Practical AI guides, instant download.", accent: "terracotta" },
];
