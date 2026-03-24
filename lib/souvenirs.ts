// ── Souvenir system config ────────────────────────────────────────────────────
// Source of truth for all souvenirs. Add new souvenirs here and wire up
// the unlock trigger in the relevant API route or webhook.

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";
export type UnlockTrigger = "visit" | "registry" | "purchase" | "bundle" | "promo" | "interaction" | "server";

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
  /**
   * If present, this souvenir is available for direct crypto purchase.
   * price_usdc is the USDC asking price. coinbaseUrl is populated once
   * Coinbase Commerce is live; until then the card shows COMING SOON.
   */
  cryptoSale?: {
    price_usdc:  number;
    coinbaseUrl: string | null;   // null = coming soon
  };
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
    cryptoSale:        { price_usdc: 10, coinbaseUrl: null },
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
    cryptoSale:        { price_usdc: 15, coinbaseUrl: null },
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
    cryptoSale:        { price_usdc: 50, coinbaseUrl: null },
  },
  {
    id:                "witness-mark",
    name:              "The Witness Mark",
    description:       "Issued to those who spoke and were heard. A home agent responded.",
    rarity:            "UNCOMMON",
    maxQuantity:       null,
    svgPath:           "/souvenirs/witness-mark.svg",
    unlockTrigger:     "interaction",
    unlockDescription: "Use the speak input in the Lounge and receive a response from a home agent.",
    glyph:             "◎",
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
    cryptoSale:        { price_usdc: 75, coinbaseUrl: null },
  },
  {
    id:                "victory-artifact",
    name:              "The Victory Artifact",
    description:       "Forged after 10 consecutive wins. Proof of an unbroken streak. Impossible to fake.",
    rarity:            "LEGENDARY",
    maxQuantity:       null,
    svgPath:           "/souvenirs/victory-artifact.svg",
    unlockTrigger:     "server",
    unlockDescription: "Achieve a win streak of 10 or more in The Latent Space Arena.",
    glyph:             "⚡",
  },
  {
    id:                "prestige-mark",
    name:              "The Prestige Mark",
    description:       "Issued to those who spoke with an agent whose reputation has been recognized. A rarer exchange.",
    rarity:            "RARE",
    maxQuantity:       null,
    svgPath:           "/souvenirs/prestige-mark.svg",
    unlockTrigger:     "interaction",
    unlockDescription: "Speak to a home agent with 'recognized' or 'legendary' reputation (100+ rep score).",
    glyph:             "◑",
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

// ── Server-side issuance helper ───────────────────────────────────────────────
//
// Inserts a souvenir_claims row using SUPABASE_SERVICE_KEY (bypasses RLS).
// proof_type is always "server" — skips the IP duplicate-check path.
// Returns the claim token on success, null on any failure (safe to ignore).

export async function issueSouvenir(
  souvenirId:  string,
  displayName: string,
  proofRef:    string,
): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const token  = crypto.randomUUID();
  const ipHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`server_${proofRef}_2026`),
      )
    )
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const res = await fetch(`${url}/rest/v1/souvenir_claims`, {
    method:  "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer:         "return=minimal",
    },
    body: JSON.stringify({
      souvenir_id:  souvenirId,
      token,
      display_name: displayName,
      ip_hash:      ipHash,
      proof_type:   "server",
      proof_ref:    proofRef,
    }),
  }).catch(() => null);

  return res?.ok ? token : null;
}
