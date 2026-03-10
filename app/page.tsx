import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h1 className="font-display font-bold text-5xl lg:text-6xl text-secondary leading-tight mb-6">
                From AI Confusion to AI Confidence.
              </h1>
              <p className="text-stone text-xl leading-relaxed mb-10 max-w-lg">
                PAID LLC helps businesses understand, deploy, and maximize AI —
                turning complexity into performance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="bg-primary text-white px-8 py-4 rounded font-semibold text-base hover:bg-secondary transition-colors text-center"
                >
                  Work With Us
                </Link>
                <Link
                  href="/digital-products"
                  className="border border-ash text-secondary px-8 py-4 rounded font-semibold text-base hover:border-secondary hover:bg-ash transition-colors text-center"
                >
                  Browse AI Guides
                </Link>
              </div>
            </div>
            <div className="relative order-first lg:order-last">
              <div className="aspect-[4/5] relative rounded-2xl overflow-hidden bg-ash">
                <Image
                  src="/founder.png"
                  alt="Travis Raveling, Founder of PAID LLC"
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <h2 className="font-display font-bold text-4xl text-secondary mb-4">
              How It Works
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              A clear, repeatable process — from first conversation to working
              solution.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Discover",
                body: "We assess your business, goals, and current tech stack to identify your highest-value AI opportunities.",
              },
              {
                step: "02",
                title: "Strategize",
                body: "We build a prioritized AI roadmap tailored to your business — no fluff, no buzzwords.",
              },
              {
                step: "03",
                title: "Implement",
                body: "We deploy solutions, integrate tools, and train your team to operate them confidently.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-8">
                <span className="font-display font-bold text-primary text-sm tracking-widest block mb-4">
                  {item.step}
                </span>
                <h3 className="font-display font-bold text-xl text-secondary mb-3">
                  {item.title}
                </h3>
                <p className="text-stone leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <h2 className="font-display font-bold text-4xl text-secondary mb-4">
              What We Do
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              From strategy to shipping — we cover the full AI lifecycle.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "AI Strategy Consulting",
                body: "Cut through the noise. We identify your highest-ROI AI opportunities and build you a clear implementation roadmap.",
                cta: "Learn More",
                href: "/services",
              },
              {
                title: "AI Implementation & Development",
                body: "We don't just advise — we build. Custom AI workflows, automation, and AI-powered applications that actually work.",
                cta: "Learn More",
                href: "/services",
              },
              {
                title: "Digital Guides",
                body: "Self-serve AI guides for teams and individuals ready to put AI to work without waiting for a consultant.",
                cta: "Browse Guides",
                href: "/digital-products",
              },
            ].map((service) => (
              <div
                key={service.title}
                className="border border-ash rounded-xl p-8 flex flex-col"
              >
                <h3 className="font-display font-bold text-xl text-secondary mb-3">
                  {service.title}
                </h3>
                <p className="text-stone leading-relaxed mb-8 flex-1">
                  {service.body}
                </p>
                <Link
                  href={service.href}
                  className="text-primary font-semibold text-sm hover:text-secondary transition-colors"
                >
                  {service.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Results Matter
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              Every engagement is measured by business outcomes, not
              deliverables.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote:
                  "Client testimonial coming soon. Reach out to be one of our first case studies.",
                name: "Case Study",
                role: "Coming Soon",
              },
              {
                quote:
                  "Client testimonial coming soon. Reach out to be one of our first case studies.",
                name: "Case Study",
                role: "Coming Soon",
              },
              {
                quote:
                  "Client testimonial coming soon. Reach out to be one of our first case studies.",
                name: "Case Study",
                role: "Coming Soon",
              },
            ].map((item, i) => (
              <div key={i} className="bg-charcoal rounded-xl p-8">
                <p className="text-ash leading-relaxed mb-6 italic">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div>
                  <p className="text-white font-semibold text-sm">{item.name}</p>
                  <p className="text-stone text-sm">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-white mb-6 max-w-2xl mx-auto">
            Ready to put AI to work for your business?
          </h2>
          <Link
            href="/contact"
            className="inline-block bg-white text-primary px-10 py-4 rounded font-semibold text-base hover:bg-ash transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
