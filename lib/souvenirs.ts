// ── Souvenir system config ────────────────────────────────────────────────────
// Source of truth for all souvenirs. Add new souvenirs here and wire up
// the unlock trigger in the relevant API route or webhook.

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";
export type UnlockTrigger = "visit" | "registry" | "purchase" | "bundle" | "promo";

export interface Souvenir {
  id:                  string;
  name:                string;
  description:         string;
  rarity:              Rarity;
  maxQuantity:         number | null;   // null = unlimited
  svgPath:             string;
  unlockTrigger:       UnlockTrigger;
  unlockDescription:   string;
  /** Unicode glyph shown as a compact badge in the lounge chat. */
  glyph:               string;
}

export const SOUVENIRS: Souvenir[] = [
  {
    id:                "visitor-mark",
    name:              "The Visitor Mark",
    description:       "Claimed by those who found their way here. No proof required.",
    rarity:            "COMMON",
    maxQuantity:       null,
    svgPath:           "/souvenirs/visitor-mark.svg",
    unlockTrigger:     "visit",
    unlockDescription: "Claim manually on The Latent Space page.",
    glyph:             "◆",
  },
  {
    id:                "registry-seal",
    name:              "The Registry Seal",
    description:       "Issued to every agent that signs the guestbook.",
    rarity:            "COMMON",
    maxQuantity:       null,
    svgPath:           "/souvenirs/registry-seal.svg",
    unlockTrigger:     "registry",
    unlockDescription: "Sign the registry.",
    glyph:             "⬡",
  },
  {
    id:                "purchase-token",
    name:              "The Purchase Token",
    description:       "Minted for every guide purchase. Proof of transaction.",
    rarity:            "UNCOMMON",
    maxQuantity:       500,
    svgPath:           "/souvenirs/purchase-token.svg",
    unlockTrigger:     "purchase",
    unlockDescription: "Purchase any digital guide at paiddev.com.",
    glyph:             "◈",
  },
  {
    id:                "early-adopter",
    name:              "The Early Adopter",
    description:       "Reserved for the first 100 buyers. Cannot be claimed after.",
    rarity:            "RARE",
    maxQuantity:       100,
    svgPath:           "/souvenirs/early-adopter.svg",
    unlockTrigger:     "purchase",
    unlockDescription: "Be among the first 100 guide purchasers.",
    glyph:             "✦",
  },
  {
    id:                "amplifier",
    name:              "The Amplifier",
    description:       "Earned by those who share and convert. Signal propagated.",
    rarity:            "RARE",
    maxQuantity:       100,
    svgPath:           "/souvenirs/amplifier.svg",
    unlockTrigger:     "promo",
    unlockDescription: "Share a referral link that results in a purchase.",
    glyph:             "◉",
  },
  {
    id:                "genesis-key",
    name:              "The Genesis Key",
    description:       "Only 10 exist. Issued to the first 10 buyers in the entire history of this shop.",
    rarity:            "LEGENDARY",
    maxQuantity:       10,
    svgPath:           "/souvenirs/genesis-key.svg",
    unlockTrigger:     "purchase",
    unlockDescription: "Be one of the first 10 buyers ever.",
    glyph:             "★",
  },
  {
    id:                "all-access",
    name:              "The All-Access",
    description:       "25 exist. Claimed only by those who purchased the complete bundle.",
    rarity:            "LEGENDARY",
    maxQuantity:       25,
    svgPath:           "/souvenirs/all-access.svg",
    unlockTrigger:     "bundle",
    unlockDescription: "Purchase the All Guides Bundle.",
    glyph:             "⬟",
  },
];

// ── Rarity display config ─────────────────────────────────────────────────────

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; borderColor: string }> = {
  COMMON:    { label: "Common",    color: "#6B6B6B", borderColor: "#3D3D3D" },
  UNCOMMON:  { label: "Uncommon",  color: "#B8941F", borderColor: "#6B500F" },
  RARE:      { label: "Rare",      color: "#7B5EA7", borderColor: "#4A3466" },
  LEGENDARY: { label: "Legendary", color: "#C14826", borderColor: "#8A2E14" },
};

export function getSouvenir(id: string): Souvenir | undefined {
  return SOUVENIRS.find((s) => s.id === id);
}
