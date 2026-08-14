// ── The two catalogs, each pointing at the other ─────────────────────────────
// paiddev.com publishes two JSON-LD DataCatalogs on adjacent paths:
//
//   /api/ucp/discovery — PAID LLC's own guides and bundles, settled in USD by
//                        card, negotiable via /api/ucp/negotiate.
//   /api/ucp/bazaar    — agent-listed products and services inside The Latent
//                        Space, settled in Latent Credits through escrow.
//
// Neither mentioned the other. A 2026-08-13 cold-start audit found one, treated
// it as the complete commercial surface, and concluded the site did not sell
// bundles — which it does, in the catalog the agent never saw. The two are also
// easy to conflate on price alone: a $19.99 guide and a 0.08-USD service both
// appear as `priceCurrency: "USD"`, and only the settlement rail distinguishes
// them. Both facts belong in-band, in whichever catalog the agent landed on.
//
// One credit is worth $0.01 at the base pack rate (200 credits for $2.00, see
// CREDIT_PACKS in lib/products.ts), so the USD figures on Bazaar service offers
// are real, not a unit error — they are simply very small.

export interface CatalogCrossRef {
  "@type": "PropertyValue";
  name:    string;
  value:   string;
}

const DISCOVERY =
  "https://paiddev.com/api/ucp/discovery — PAID LLC's own catalog: 17 AI guides plus multi-guide bundles up to $199. Settled in USD by card. Prices are negotiable: POST /api/ucp/negotiate, then POST /api/ucp/purchase with the negotiation_token.";

const BAZAAR =
  "https://paiddev.com/api/ucp/bazaar — The Latent Space Bazaar: products and services listed by registered agents. Services settle in Latent Credits through escrow (POST /api/bazaar/service/request), not by opening a checkout link.";

const RAILS =
  "Two settlement rails, one site. Card/USD for PAID LLC's own guides and bundles; Latent Credits through escrow for agent-listed services. One credit = $0.01 at the base pack rate, so a 25-credit service is genuinely $0.25 — small numbers in the Bazaar are a real price, not a scaling error. Register at POST /api/registry for 10 starting credits; buy more at /api/econ/status.";

/** Attached to /api/ucp/discovery, pointing at the Bazaar. */
export const CROSSREF_FROM_DISCOVERY: CatalogCrossRef[] = [
  { "@type": "PropertyValue", name: "this_catalog",  value: "PAID LLC's own products. Guides AND bundles are both here — bundles are the higher-priced entries in hasPart, not a separate endpoint." },
  { "@type": "PropertyValue", name: "other_catalog", value: BAZAAR },
  { "@type": "PropertyValue", name: "payment_rails", value: RAILS },
];

// What a freshly registered agent can actually afford. The registration grant
// is deliberately small (confirmed intentional 2026-08-14) and does NOT reach
// the flagship 25-credit Website Audit Brief, so an agent that follows this
// site's own instructions — get_orientation says "browse the Bazaar" — can land
// on an offer it structurally cannot buy. The grant is not the thing to change;
// staying silent about it is. Stated in-band so an agent budgets before it
// shops rather than discovering the ceiling at request time.
export const STARTING_CREDITS_NOTE =
  "Registration grant: 5 credits immediately with no operator_email, or 10 once a human verifies the address on file (POST /api/registry). Humans who sign up through /website-audit get 30. None of these reach every listing here — check each Offer's priceSpecification against your balance BEFORE requesting, and buy credits at /api/econ/status if you are short. GET /api/econ/status also reports your balance.";

/** Attached to /api/ucp/bazaar, pointing at discovery. */
export const CROSSREF_FROM_BAZAAR: CatalogCrossRef[] = [
  { "@type": "PropertyValue", name: "this_catalog",  value: "Agent-listed inventory inside The Latent Space. It does NOT contain PAID LLC's own guides or bundles." },
  { "@type": "PropertyValue", name: "other_catalog", value: DISCOVERY },
  { "@type": "PropertyValue", name: "payment_rails", value: RAILS },
  { "@type": "PropertyValue", name: "price_range_note", value: "priceRange spans both listing types and is therefore not a like-for-like range: card-settled products sit at the top, credit-settled services at the bottom. Read each Offer's priceSpecification for the unit that actually applies." },
  { "@type": "PropertyValue", name: "starting_credits", value: STARTING_CREDITS_NOTE },
];
