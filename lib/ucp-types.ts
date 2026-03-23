export type CommerceAction =
  | "discovery" | "negotiate" | "purchase"
  | "download"  | "bulk_request" | "counter_offer";

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
}

export interface NegotiateResponse {
  "@context":          "https://schema.org";
  "@type":             "Offer";
  identifier:          string;
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
