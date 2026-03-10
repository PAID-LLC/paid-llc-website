import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services | PAID LLC",
  description:
    "AI Strategy Consulting and AI Implementation & Development services from PAID LLC.",
};

export default function Services() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Services
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            AI that works for your business.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl">
            We offer two core service lines — strategy and implementation — plus
            self-serve digital guides for teams ready to move on their own.
          </p>
        </div>
      </section>

      {/* Service 1 */}
      <section id="consulting" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-display font-bold text-primary text-sm tracking-widest uppercase">
                Service 01
              </span>
              <h2 className="font-display font-bold text-4xl text-secondary mt-4 mb-6">
                AI Strategy Consulting
              </h2>
              <p className="text-stone text-lg leading-relaxed mb-8">
                Not sure where to start with AI? We cut through the noise. We
                assess your business, identify the highest-ROI AI applications,
                and build you a clear implementation roadmap.
              </p>
              <div className="mb-8">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Who it&apos;s for
                </p>
                <p className="text-stone leading-relaxed">
                  Business owners, operators, and teams who know AI matters but
                  don&apos;t know where to focus.
                </p>
              </div>
              <div className="mb-10">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Deliverables
                </p>
                <ul className="space-y-2">
                  {[
                    "AI opportunity audit",
                    "Prioritized implementation roadmap",
                    "Tool recommendations",
                    "Implementation plan",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-6">
                <p className="font-display font-bold text-2xl text-secondary">
                  Starting at $1,500
                </p>
              </div>
            </div>
            <div className="lg:pt-16">
              <div className="bg-ash rounded-xl p-8">
                <p className="font-display font-bold text-xl text-secondary mb-4">
                  Book a Consultation
                </p>
                <p className="text-stone leading-relaxed mb-6">
                  Tell us about your business and where you want AI to make an
                  impact. We&apos;ll take it from there.
                </p>
                <Link
                  href="/contact"
                  className="block bg-primary text-white px-6 py-3.5 rounded font-semibold text-sm text-center hover:bg-secondary transition-colors"
                >
                  Book a Consultation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-ash" />
      </div>

      {/* Service 2 */}
      <section id="implementation" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-display font-bold text-primary text-sm tracking-widest uppercase">
                Service 02
              </span>
              <h2 className="font-display font-bold text-4xl text-secondary mt-4 mb-6">
                AI Implementation &amp; Development
              </h2>
              <p className="text-stone text-lg leading-relaxed mb-8">
                We don&apos;t just advise — we build. From custom AI workflows and
                automation to AI-powered websites and software, we implement
                solutions that work.
              </p>
              <div className="mb-8">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Who it&apos;s for
                </p>
                <p className="text-stone leading-relaxed">
                  Businesses ready to move from strategy to execution, or teams
                  needing technical AI development.
                </p>
              </div>
              <div className="mb-10">
                <p className="font-display font-semibold text-secondary text-sm uppercase tracking-widest mb-3">
                  Deliverables
                </p>
                <ul className="space-y-2">
                  {[
                    "Custom AI integrations",
                    "Automated workflows",
                    "AI-powered web and software applications",
                    "Team training and handoff",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone">
                      <span className="text-primary mt-1 flex-shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-6">
                <p className="font-display font-bold text-2xl text-secondary">
                  Starting at $5,000
                </p>
              </div>
            </div>
            <div className="lg:pt-16">
              <div className="bg-ash rounded-xl p-8">
                <p className="font-display font-bold text-xl text-secondary mb-4">
                  Start a Project
                </p>
                <p className="text-stone leading-relaxed mb-6">
                  Tell us what you want to build. We&apos;ll scope it, price it, and
                  get to work.
                </p>
                <Link
                  href="/contact"
                  className="block bg-primary text-white px-6 py-3.5 rounded font-semibold text-sm text-center hover:bg-secondary transition-colors"
                >
                  Start a Project
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Products CTA */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h3 className="font-display font-bold text-2xl text-secondary mb-2">
                Not ready for a full engagement?
              </h3>
              <p className="text-stone leading-relaxed max-w-lg">
                Our digital guides let you start applying AI immediately — at
                your own pace.
              </p>
            </div>
            <Link
              href="/digital-products"
              className="flex-shrink-0 border-2 border-secondary text-secondary px-8 py-3.5 rounded font-semibold text-sm hover:bg-secondary hover:text-white transition-colors text-center"
            >
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              How We Work
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              Every engagement follows the same four-phase process.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { phase: "01", label: "Discovery" },
              { phase: "02", label: "Strategy" },
              { phase: "03", label: "Implementation" },
              { phase: "04", label: "Ongoing Support" },
            ].map((item, i, arr) => (
              <div key={item.phase} className="flex items-center gap-4">
                <div className="flex-1 bg-charcoal rounded-lg p-6">
                  <span className="font-display font-bold text-primary text-xs tracking-widest block mb-2">
                    {item.phase}
                  </span>
                  <p className="font-display font-semibold text-white">
                    {item.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-stone hidden md:block">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
