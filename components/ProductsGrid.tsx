"use client";

import { useState } from "react";
import CoinbaseGuideButton from "@/components/CoinbaseGuideButton";

const CATEGORIES = [
  "All",
  "Getting Started",
  "Microsoft 365",
  "Google Workspace",
  "Content & Marketing",
  "Operations",
  "Enterprise",
] as const;

type Category = (typeof CATEGORIES)[number];

export interface ProductItem {
  category: string;
  title: string;
  description: string;
  price: string;
  slug: string;
  stripeUrl: string;
  isNew: boolean;
}

interface Props {
  products: ProductItem[];
}

function trackCheckout(slug: string, title: string, price: string) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  const value = parseFloat(price.replace("$", ""));
  gtag("event", "begin_checkout", {
    currency: "USD",
    value,
    items: [{ item_id: slug, item_name: title, price: value, quantity: 1 }],
  });
}

export default function ProductsGrid({ products }: Props) {
  const [active, setActive] = useState<Category>("All");

  const counts = Object.fromEntries(
    CATEGORIES.slice(1).map((cat) => [
      cat,
      products.filter((p) => p.category === cat).length,
    ])
  );

  const filtered =
    active === "All"
      ? products
      : products.filter((p) => p.category === active);

  return (
    <>
      {/* Filter Bar */}
      <div className="border-b border-ash bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`whitespace-nowrap flex-shrink-0 px-4 py-2 rounded text-sm font-semibold transition-colors ${
                  active === cat
                    ? "bg-primary text-white"
                    : "text-stone hover:text-secondary hover:bg-ash"
                }`}
              >
                {cat}
                {cat !== "All" && (counts[cat] ?? 0) > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${
                      active === cat ? "opacity-70" : "opacity-50"
                    }`}
                  >
                    {counts[cat]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {filtered.map((product) => (
            <div
              key={product.slug}
              id={product.slug}
              className="border border-ash rounded-xl overflow-hidden flex flex-col hover:border-stone/40 transition-colors scroll-mt-16"
            >
              {/* Cover */}
              <div className="bg-secondary aspect-[3/2] flex items-center justify-center px-8 relative">
                {product.isNew && (
                  <span className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                    New
                  </span>
                )}
                <p className="font-display font-bold text-white text-center text-lg leading-snug">
                  {product.title}
                </p>
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col flex-1">
                <span className="text-xs font-semibold tracking-widest uppercase mb-3 text-primary">
                  {product.category}
                </span>
                <h3 className="font-display font-bold text-secondary text-base mb-3 leading-snug">
                  {product.title}
                </h3>
                <p className="text-stone text-sm leading-relaxed mb-6 flex-1">
                  {product.description}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-secondary text-lg">
                    {product.price}
                  </span>
                  <div className="flex items-center gap-2">
                    {product.stripeUrl ? (
                      <a
                        href={product.stripeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackCheckout(product.slug, product.title, product.price)}
                        className="bg-primary text-white px-4 py-2 rounded text-sm font-semibold hover:bg-secondary transition-colors"
                      >
                        Buy Now
                      </a>
                    ) : (
                      <span className="bg-ash text-stone/40 px-4 py-2 rounded text-sm font-semibold cursor-not-allowed select-none">
                        Card Soon
                      </span>
                    )}
                    <CoinbaseGuideButton productSlug={product.slug} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment note */}
        <p className="text-center text-stone text-sm mt-12">
          Not satisfied? We offer a 7-day refund -- no hassle, no fine print.{" "}
          <a
            href="mailto:hello@paiddev.com"
            className="text-primary hover:text-secondary transition-colors"
          >
            Email us
          </a>{" "}
          within 7 days of purchase.
        </p>
      </div>
    </>
  );
}
