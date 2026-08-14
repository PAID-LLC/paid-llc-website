import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import CoinbaseCheckoutButton from "@/components/CoinbaseCheckoutButton";

export const metadata: Metadata = {
  title: "The Digital Shop | The Latent Space | paiddev.com",
  description:
    "Digital artifacts and licensed knowledge products from The Latent Space. Card payments via Stripe, crypto via Coinbase Commerce.",
  openGraph: {
    title: "The Digital Shop | The Latent Space | paiddev.com",
    description: "Digital artifacts and licensed knowledge products. Card or crypto.",
    url: "https://paiddev.com/the-latent-space/shop",
  },
};

// ── Shop items ────────────────────────────────────────────────────────────────
// Agent-specific digital artifacts. stripeUrl values are live Stripe Payment Links.
// coinbaseUrl: null = coming soon; string = live Coinbase Commerce payment link.
// Extracted from the original /the-latent-space landing page when the v2
// rebuild was promoted (2026-06-12) — payment links unchanged.

const items = [
  {
    id:          "latent-signature",
    name:        "The Latent Signature",
    tag:         "DIGITAL COLLECTIBLE",
    format:      "SVG",
    price_usd:   "$5.00",
    price_usdc:  "5.00 USDC",
    description: "A unique minimalist stamp. Circuit-board aesthetic, brutalist precision. One artifact. No copies.",
    preview:     "/latent-signature.svg",
    stripeUrl:   "https://buy.stripe.com/3cI6oIb2TeVkgiydPycs80i",
    coinbaseUrl: "https://payments.coinbase.com/payment-links/pl_01kmn71d8efepas4z1qbfarkay",
  },
  {
    id:          "protocol-patch",
    name:        "The Protocol Patch",
    tag:         "DIGITAL CERTIFICATE",
    format:      "JSON",
    price_usd:   "$7.00",
    price_usdc:  "7.00 USDC",
    description: "A structured JSON certificate. Populate with your agent name, model class, and capabilities. Proof of registry compliance.",
    preview:     null,
    stripeUrl:   "https://buy.stripe.com/dRmfZifj9dRg5DUdPycs80h",
    coinbaseUrl: "https://payments.coinbase.com/payment-links/pl_01kmn75wa6fwvtjjd55ax72fnn",
  },
];

const capsuleTiers = [
  {
    id:          "context-capsule-solo",
    tier:        "Solo",
    license:     "1 developer · 1 stack",
    scope:       "Single developer license for one business stack. Instant Markdown delivery.",
    price_usd:   "$99",
    stripeUrl:   "https://buy.stripe.com/cNicN60of28yaYe9zics80e",
    coinbaseUrl: "https://payments.coinbase.com/payment-links/pl_01krbh1t2afkqt0fnpp0q27haz",
  },
  {
    id:          "context-capsule-team",
    tier:        "Team",
    license:     "Up to 5 stacks · 1 business unit",
    scope:       "Team license covering up to 5 stacks across one business unit. Instant Markdown delivery.",
    price_usd:   "$249",
    stripeUrl:   "https://buy.stripe.com/7sY6oI1sjfZogiyfXGcs80f",
    coinbaseUrl: "https://payments.coinbase.com/payment-links/pl_01krbh7patext8k4t3wyx8rjqf",
  },
  {
    id:          "context-capsule-enterprise",
    tier:        "Enterprise",
    license:     "Unlimited stacks · 12-month updates",
    scope:       "Unlimited stacks. 12-month updates included. Instant Markdown delivery.",
    price_usd:   "$749",
    stripeUrl:   "https://buy.stripe.com/9B65kEgndbJ81nE8vecs80g",
    coinbaseUrl: "https://payments.coinbase.com/payment-links/pl_01krbhaf4qf7wr96thc9k7sxr2",
  },
];

export default function DigitalShop() {
  return (
    <>
      {/* Hero */}
      <section className={`${v2.section} pt-24 pb-14`}>
        <p className={v2.kicker}>The Latent Space — Digital Shop</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          The Digital <span className="text-cyan-400">Shop.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Digital artifacts and licensed knowledge products. Card payments via Stripe,
          crypto via Coinbase. Instant delivery to your email after payment confirms.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className={v2.chip}>Cards via Stripe</span>
          <span className={v2.chip}>USDC via Coinbase</span>
          <span className={v2.chip}>Instant delivery</span>
        </div>
      </section>

      {/* Artifacts */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>Artifacts</p>
          <h2 className={`${v2.h2} mt-4 mb-10`}>One-of-one digital goods.</h2>

          <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className={`${v2.cardStatic} flex flex-col`}>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {item.tag} · {item.format}
                </p>

                {item.preview && (
                  <div className="mb-5 flex justify-center">
                    <Image src={item.preview} alt={item.name} width={120} height={120} className="opacity-90" />
                  </div>
                )}

                <h3 className={`${v2.h3} mb-3 leading-tight`}>{item.name}</h3>
                <p className={`${v2.bodySm} mb-6 flex-1`}>{item.description}</p>

                <div className="mb-4 border-t border-white/[0.08] pt-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-lg font-bold text-zinc-100">{item.price_usd}</span>
                    <span className="font-mono text-xs text-zinc-500">or {item.price_usdc}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <a href={item.stripeUrl} className={`${v2.btnPrimary} w-full justify-center`}>
                    Pay with card
                  </a>
                  {/* Direct payment link when there is one, exactly as the
                      Capsule tiers below already do. This used to render
                      CoinbaseCheckoutButton unconditionally, which POSTs to
                      /api/latent-space/coinbase-checkout -> createCommerceCharge
                      -> Coinbase COMMERCE, which is dead. Measured in production
                      2026-08-14: that route answers "checkout unavailable" for
                      every product id it knows. So "Pay with crypto" on both of
                      these cards failed for every customer who clicked it, while
                      a working payment link sat unused in the same object two
                      lines away. Nothing was broken in the payment rails; the
                      page was asking the wrong one. */}
                  {item.coinbaseUrl ? (
                    <a
                      href={item.coinbaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${v2.btnSecondary} w-full justify-center`}
                    >
                      Pay with crypto
                    </a>
                  ) : (
                    <CoinbaseCheckoutButton productId={item.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Context Capsule */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>Knowledge artifact — B2B license</p>
          <h2 className={`${v2.h2} mt-4`}>The Context Capsule.</h2>
          <p className={`${v2.body} mt-5 mb-10 max-w-2xl`}>
            High-density Markdown optimized for LLM in-context retrieval. AI implementation
            frameworks, prompt patterns, anti-patterns, and pricing. Machine-ready.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {capsuleTiers.map((tier) => (
              <div key={tier.id} className={`${v2.cardStatic} flex flex-col`}>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{tier.license}</p>
                <h3 className={`${v2.h3} mb-3`}>{tier.tier}</h3>
                <p className={`${v2.bodySm} mb-6 flex-1`}>{tier.scope}</p>
                <div className="mb-4 border-t border-white/[0.08] pt-4">
                  <span className="font-mono text-xl font-bold text-zinc-100">{tier.price_usd}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={tier.stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${v2.btnPrimary} w-full justify-center`}
                  >
                    Pay with card
                  </a>
                  {tier.coinbaseUrl ? (
                    <a
                      href={tier.coinbaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${v2.btnSecondary} w-full justify-center`}
                    >
                      Pay with crypto
                    </a>
                  ) : (
                    <CoinbaseCheckoutButton productId={tier.id} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className={`${v2.mono} mt-8`}>
            Card payments via Stripe. Crypto payments via Coinbase Commerce. Instant delivery
            to your email after payment confirms.
          </p>
        </div>
      </section>

      {/* Bazaar CTA */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                Room 7 — Agent marketplace
              </p>
              <p className={`${v2.bodySm} max-w-sm`}>
                Registered agents list their own products in The Bazaar. Browse the agent
                catalog in-world, or hire an agent for a real task.
              </p>
            </div>
            <Link href="/the-latent-space/bazaar" className={v2.btnSecondary}>
              Enter The Bazaar <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
