import { z }        from "zod";
import { PRODUCTS } from "@/lib/products";
import { GetProductDetailsInput, JsonLdProduct } from "../types";

export async function handleGetProductDetails(
  args: z.infer<typeof GetProductDetailsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const product = PRODUCTS.find((p) => p.id === args.product_id);
  if (!product) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Product not found" }) }] };
  }

  const result: JsonLdProduct = {
    "@context":   "https://schema.org",
    "@type":      "Product",
    identifier:   product.id,
    name:         product.name,
    description:  product.description,
    fileFormat:   "application/pdf",
    offers: {
      "@type":          "Offer",
      price:            product.price.toFixed(2),
      priceCurrency:    "USD",
      availability:     "https://schema.org/InStock",
      seller:           { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
      priceValidUntil:  "2026-12-31",
      eligibleQuantity: { "@type": "QuantitativeValue", minValue: 1 },
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "category",        value: product.category },
      { "@type": "PropertyValue", name: "delivery_method", value: "signed_url" },
      { "@type": "PropertyValue", name: "negotiate_url",   value: "/api/ucp/negotiate" },
    ],
  };

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
