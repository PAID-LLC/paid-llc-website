export type CommerceAction =
  | "discovery" | "negotiate" | "purchase"
  | "download"  | "bulk_request" | "counter_offer" | "transfer";

export type CommerceStatus =
  | "initiated" | "accepted" | "rejected" | "completed" | "failed";

export interface AgentCommerceLog {
  id:          number;
  agent_name:  string;
  action:      CommerceAction;
  resource_id: string | null;
  amount:      number | null;
  currency:    string;
  status:      CommerceStatus;
  metadata:    Record<string, unknown> | null;
  created_at:  string;
}

export interface NegotiateRequest {
  agent_name:   string;
  resource_id:  string;
  request_type: "member_pricing" | "bulk_access";
  quantity?:    number;
  agent_token?: string;
  pay_with?:    "stripe" | "latent_credits";
}

export interface UcpOffer {
  "@type":            "Offer";
  price:              string;
  priceCurrency:      string;
  availability?:      string;
  seller:             { "@type": "Organization"; name: string; url?: string };
  priceValidUntil?:   string;
  eligibleQuantity?:  { "@type": "QuantitativeValue"; minValue?: number; value?: number };
  discount?:          number;
}

export interface UcpProduct {
  "@type":             "Product";
  identifier:          string;
  name:                string;
  description:         string;
  fileFormat:          string;
  offers:              UcpOffer;
  additionalProperty?: { "@type": "PropertyValue"; name: string; value: string | number }[];
}

export interface UcpDiscoveryResponse {
  "@context":  "https://schema.org";
  "@type":     "DataCatalog";
  name:        string;
  description: string;
  provider:    { "@type": "Organization"; name: string; url: string };
  license:     string;
  hasPart:     UcpProduct[];
  /** This site publishes TWO catalogs and neither used to mention the other,
   *  so an agent that found one had no way to learn the second existed. See
   *  UCP_CATALOG_CROSSREF in lib/ucp-catalogs.ts. */
  additionalProperty?: { "@type": "PropertyValue"; name: string; value: string }[];
}

export interface NegotiateResponse {
  "@context":          "https://schema.org";
  "@type":             "Offer";
  /** JSON-LD identifier for the offer. Same value as negotiation_token. */
  identifier:          string;
  /** The field every doc names — openapi.json, ai.txt, and the agent docs all
   *  tell agents to read `negotiation_token` and pass it to /api/ucp/purchase.
   *  The payload only ever carried it as JSON-LD `identifier`, so an agent
   *  following the documentation found no token at all (found in a cold-start
   *  agent audit, 2026-08-13). Both names now ship the same value: `identifier`
   *  keeps the JSON-LD contract, `negotiation_token` matches the docs.
   *  Optional because a counter-offer is a rejection and issues no claimable
   *  token — its absence is the signal that this offer is not payable. */
  negotiation_token?:  string;
  itemOffered:         { "@type": "Product"; identifier: string; name: string };
  price:               string;
  priceCurrency:       string;
  availability?:       string;
  validThrough:        string;
  seller:              { "@type": "Organization"; name: string };
  priceSpecification?: {
    "@type":          "PriceSpecification";
    price:            number;
    priceCurrency:    string;
    eligibleQuantity: { "@type": "QuantitativeValue"; value: number };
  };
  additionalProperty:  { "@type": "PropertyValue"; name: string; value: string | number }[];
}
