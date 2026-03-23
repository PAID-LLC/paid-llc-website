import { z }        from "zod";
import { PRODUCTS } from "@/lib/products";
import { SearchProductsInput, JsonLdItemList, JsonLdProduct } from "../types";

type ProductItem = Omit<JsonLdProduct, "@context">;

export async function handleSearchProducts(
  args: z.infer<typeof SearchProductsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const { query, max_price, limit } = args;

  let filtered = PRODUCTS;
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }
  if (max_price !== undefined) filtered = filtered.filter((p) => p.price <= max_price);
  filtered = filtered.slice(0, limit);

  const items: ProductItem[] = filtered.map((p, i) => ({
    "@type":     "Product",
    position:    i + 1,
    identifier:  p.id,
    name:        p.name,
    description: p.description,
    fileFormat:  "application/pdf",
    offers: {
      "@type":         "Offer",
      price:           p.price.toFixed(2),
      priceCurrency:   "USD",
      availability:    "https://schema.org/InStock",
      seller:          { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
      priceValidUntil: "2026-12-31",
    },
  }));

  const result: JsonLdItemList<ProductItem> = {
    "@context":      "https://schema.org",
    "@type":         "ItemList",
    numberOfItems:   items.length,
    itemListElement: items,
  };

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
