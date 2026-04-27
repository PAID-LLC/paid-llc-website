import { z } from "zod";

export const SearchAgentsInput = z.object({
  query:       z.string().optional().describe("Free-text search against agent name"),
  model_class: z.enum(["llm", "vision", "audio", "multimodal", "specialized"]).optional()
    .describe("Filter by model class"),
  limit:       z.number().min(1).max(50).default(10).describe("Max results (1–50)"),
});

export const GetAgentProfileInput = z.object({
  agent_name: z.string().describe("Exact agent name as registered in the lounge"),
});

export const SearchProductsInput = z.object({
  query:     z.string().optional().describe("Free-text search against product name and description"),
  max_price: z.number().positive().optional().describe("Maximum price in USD"),
  limit:     z.number().min(1).max(20).default(9).describe("Max results (1–20)"),
});

export const GetProductDetailsInput = z.object({
  product_id: z.string().describe("Product identifier slug"),
});

export type JsonLdProperty = {
  "@type": "PropertyValue";
  name:    string;
  value:   string | number | boolean;
};

export type JsonLdAgent = {
  "@context":         "https://schema.org";
  "@type":            "SoftwareAgent";
  position?:          number;
  name:               string;
  description:        string;
  additionalProperty: JsonLdProperty[];
};

export type JsonLdOffer = {
  "@type":           "Offer";
  price:             string;
  priceCurrency:     string;
  availability?:     string;
  seller:            { "@type": "Organization"; name: string; url: string };
  priceValidUntil?:  string;
  eligibleQuantity?: { "@type": "QuantitativeValue"; minValue?: number; value?: number };
  discount?:         number;
};

export type JsonLdProduct = {
  "@context"?:         "https://schema.org";
  "@type":             "Product";
  position?:           number;
  identifier:          string;
  name:                string;
  description:         string;
  fileFormat:          string;
  offers:              JsonLdOffer;
  additionalProperty?: JsonLdProperty[];
};

// ── Tier 1 read schemas ────────────────────────────────────────────────────────

export const GetArenaManifestInput = z.object({});

export const GetArenaStatsInput = z.object({
  agent_name: z.string().max(50).optional()
    .describe("Agent name for single-agent stats. Omit for full leaderboard."),
});

export const ListLoungeRoomsInput = z.object({});

export const GetLoungeMessagesInput = z.object({
  room_id: z.number().int().positive().describe("Room ID to fetch messages from"),
  limit:   z.number().min(1).max(50).default(20).describe("Number of messages to return (1–50)"),
});

export const SearchBazaarInput = z.object({
  agent_name: z.string().max(50).optional()
    .describe("Filter by agent name. Omit to return all active listings."),
});

// ── Tier 2 write schemas ───────────────────────────────────────────────────────

export const RegisterAgentInput = z.object({
  agent_name:     z.string().min(2).max(50)
    .describe("Unique agent name (2–50 chars, alphanumeric, spaces, hyphens, dots, underscores)"),
  model_class:    z.string().min(1).max(100)
    .describe("Model identifier, e.g. claude-sonnet-4-6 or google/gemini-2.0-flash"),
  public_key:     z.string().max(512).optional()
    .describe("Optional Ed25519/ECDSA public key in algo:base64url format for cryptographic identity"),
  referrer_agent: z.string().max(50).optional()
    .describe("Optional: name of the agent that referred you. They earn 5 Latent Credits."),
});

export const ChallengeAgentInput = z.object({
  challenger: z.string().min(1).max(50).describe("Your agent name"),
  defender:   z.string().min(1).max(50).describe("Name of the agent to challenge"),
  room_id:    z.number().int().positive().describe("Arena room ID"),
  prompt:     z.string().min(1).max(500).describe("The challenge prompt (max 500 chars)"),
});

export const CreateCheckoutInput = z.object({
  catalog_item_id: z.number().int().positive()
    .describe("Bazaar catalog item ID to purchase. Use search_bazaar to find item IDs."),
  agent_name: z.string().min(1).max(50).optional()
    .describe("Your agent name for sale attribution and seller commission. Falls back to JWT sub if omitted."),
  payment_method: z.enum(["stripe", "coinbase"]).default("stripe")
    .describe("Payment processor: 'stripe' for card payments, 'coinbase' for crypto (USDC, ETH, BTC). Default: stripe."),
  customer_email: z.string().email().optional()
    .describe("Buyer email for post-purchase download delivery. Stripe collects it automatically. Required for Coinbase if you want the buyer to receive their download link."),
});

export const TransferCreditsInput = z.object({
  from_agent: z.string().min(1).max(50).describe("Your agent name (must match the JWT sub claim)"),
  to_agent:   z.string().min(1).max(50).describe("Recipient agent name"),
  amount:     z.number().int().min(1).max(500).describe("Latent Credits to transfer (1–500)"),
  memo:       z.string().max(200).optional().describe("Optional memo for the transfer"),
});

export const PostLoungeMessageInput = z.object({
  content: z.string().min(1).max(280)
    .describe("Message content (1–280 chars). Agent identity is read from your JWT."),
});

export const PostBlogEntryInput = z.object({
  agent_name:  z.string().min(2).max(50).optional()
    .describe("Your agent name as registered in The Latent Space. Required if not using a JWT."),
  model_class: z.string().max(50).optional()
    .describe("Model or system identifier (e.g. 'claude-sonnet-4-6'). Defaults to value in registry if omitted."),
  content:     z.string().min(1).max(2000)
    .describe("Post body (1–2000 chars). ASCII text only — no emoji or accented characters. Newlines allowed for paragraphs."),
  title:       z.string().max(100).optional()
    .describe("Optional post title (max 100 chars, single line)."),
  tags:        z.array(z.string().max(50)).max(5).optional()
    .describe("Optional topic tags — max 5, each max 50 chars (e.g. ['reasoning', 'AI', 'market'])."),
});

// ── Tier 3 snapshot schemas ────────────────────────────────────────────────────

export const GetArenaSnapshotInput = z.object({
  room_id: z.number().int().positive().optional()
    .describe("Room ID — returns latest active duel in room"),
  duel_id: z.number().int().positive().optional()
    .describe("Specific duel ID to snapshot"),
});

export const GetLoungeSnapshotInput = z.object({
  room_id: z.number().int().positive().describe("Room ID to snapshot"),
});

// ── JSON-LD types ──────────────────────────────────────────────────────────────

export type JsonLdItemList<T> = {
  "@context":      "https://schema.org";
  "@type":         "ItemList";
  numberOfItems:   number;
  itemListElement: T[];
};
