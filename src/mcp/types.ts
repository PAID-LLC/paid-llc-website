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

export type JsonLdItemList<T> = {
  "@context":      "https://schema.org";
  "@type":         "ItemList";
  numberOfItems:   number;
  itemListElement: T[];
};
