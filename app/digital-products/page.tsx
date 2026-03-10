import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Products | PAID LLC",
  description:
    "AI guides for teams and individuals — self-serve resources to put AI to work immediately.",
};

export default function DigitalProducts() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Digital Products
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            AI guides that get you moving.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl">
            Self-serve guides for teams and individuals ready to put AI to work
            — without waiting for a consultant.
          </p>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border border-ash rounded-xl overflow-hidden flex flex-col"
              >
                {/* Cover placeholder */}
                <div className="bg-ash aspect-[3/2] flex items-center justify-center">
                  <span className="font-display font-bold text-stone text-sm tracking-widest uppercase">
                    Coming Soon
                  </span>
                </div>
                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-display font-bold text-secondary text-lg mb-2">
                    AI Guide — Title Coming Soon
                  </h3>
                  <p className="text-stone text-sm leading-relaxed mb-6 flex-1">
                    A practical guide to help your team get real results from
                    AI tools — without the fluff.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-secondary">
                      —
                    </span>
                    <span className="text-stone text-sm">Launching soon</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notify CTA */}
          <div className="mt-20 bg-ash rounded-2xl p-12 text-center">
            <h2 className="font-display font-bold text-3xl text-secondary mb-4">
              Want to know when guides drop?
            </h2>
            <p className="text-stone leading-relaxed mb-8 max-w-md mx-auto">
              The first guide is in production. Reach out and we&apos;ll let you
              know when it&apos;s available.
            </p>
            <Link
              href="/contact"
              className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
            >
              Get Notified
            </Link>
          </div>
        </div>
      </section>

      {/* Consulting CTA */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Need more than a guide?
            </h2>
            <p className="text-stone text-lg leading-relaxed mb-8">
              Our consulting and implementation services take you from strategy
              to shipping — with a dedicated partner the whole way.
            </p>
            <Link
              href="/services"
              className="inline-block border-2 border-white text-white px-8 py-4 rounded font-semibold text-sm hover:bg-white hover:text-secondary transition-colors"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
