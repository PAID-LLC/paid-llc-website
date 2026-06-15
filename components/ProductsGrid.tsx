"use client";

import { useState } from "react";
import { v2 } from "@/components/v2/tokens";
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
      {/* Filter bar */}
      <div className="border-b border-white/[0.06]">
        <div className={v2.section}>
          <div className="flex gap-1.5 overflow-x-auto py-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`flex-shrink-0 whitespace-nowrap rounded-md px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  active === cat
                    ? "border border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                {cat}
                {cat !== "All" && (counts[cat] ?? 0) > 0 && (
                  <span className="ml-1.5 opacity-60">{counts[cat]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className={`${v2.section} py-16`}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <div
              key={product.slug}
              id={product.slug}
              className={`${v2.cardStatic} group flex scroll-mt-24 flex-col transition-colors hover:border-cyan-400/20`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                  {product.category}
                </span>
                {product.isNew && (
                  <span className="inline-flex items-center rounded-full border border-[#C14826]/40 bg-[#C14826]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#E8714C]">
                    New
                  </span>
                )}
              </div>

              <h3 className={`${v2.h3} leading-snug`}>{product.title}</h3>
              <p className={`${v2.bodySm} mt-2 flex-1`}>{product.description}</p>

              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-bold text-zinc-100">
                    {product.price}
                  </span>
                  {product.stripeUrl ? (
                    <a
                      href={product.stripeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackCheckout(product.slug, product.title, product.price)}
                      className="inline-flex items-center rounded-md border border-[#C14826]/50 bg-[#C14826]/15 px-4 py-2 font-mono text-xs font-medium text-[#E8714C] transition-colors hover:border-[#C14826]/70 hover:bg-[#C14826]/25"
                    >
                      Buy Now
                    </a>
                  ) : (
                    <span className="cursor-not-allowed select-none rounded-md border border-white/10 px-4 py-2 font-mono text-xs text-zinc-600">
                      Card Soon
                    </span>
                  )}
                </div>
                <CoinbaseGuideButton productSlug={product.slug} block />
              </div>
            </div>
          ))}
        </div>

        {/* Payment note */}
        <p className={`${v2.bodySm} mt-12 text-center`}>
          Not satisfied? We offer a 7-day refund, no hassle, no fine print.{" "}
          <a
            href="mailto:hello@paiddev.com"
            className="text-[#E8714C] transition-colors hover:text-[#F08A66]"
          >
            Email us
          </a>{" "}
          within 7 days of purchase.
        </p>
      </div>
    </>
  );
}
