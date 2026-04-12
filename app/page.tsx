import Link from "next/link";
import NewsSection from "@/components/NewsSection";

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
                Performance Artificial Intelligence Development (PAID LLC) helps
                businesses understand, deploy, and maximize AI, turning
                complexity into performance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="bg-primary text-white px-8 py-4 rounded font-semibold text-base hover:bg-secondary transition-colors text-center"
                >
                  Book a Free AI Audit
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
              <div className="aspect-[4/3] relative rounded-2xl overflow-hidden bg-ash">
                <video
                  src="/paid-llc-intro.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
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
              A clear, repeatable process, from first conversation to working
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
                body: "We build a prioritized AI roadmap tailored to your business. No fluff, no buzzwords.",
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
              From strategy to shipping, we cover the full AI lifecycle.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "AI Strategy Consulting",
                body: "Cut through the noise. We identify your highest-ROI AI opportunities and build you a clear implementation roadmap.",
                cta: "Learn More",
                href: "/services#consulting",
              },
              {
                title: "AI Implementation Advisory",
                body: "We guide your team through implementation. We work alongside your IT department to configure AI tools, build workflows, and get solutions deployed correctly.",
                cta: "Learn More",
                href: "/services#implementation",
              },
              {
                title: "AI Team Training",
                body: "Hands-on workshops that turn your team from AI-curious to AI-capable. Half-day, full-day, and custom formats available.",
                cta: "Book a Session",
                href: "/services#training",
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

      {/* Free Scorecard */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
            <div className="max-w-xl">
              <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
                Free Download
              </p>
              <h2 className="font-display font-bold text-3xl text-secondary mb-4">
                Is your business ready for AI?
              </h2>
              <p className="text-stone text-lg leading-relaxed">
                Take the 5-minute AI Readiness Scorecard. Answer 10 questions,
                get your score, and walk away with a clear next step — no email
                required.
              </p>
            </div>
            <div className="flex-shrink-0">
              <a
                href="/ai-readiness-scorecard.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-secondary text-white px-8 py-4 rounded font-semibold text-base hover:bg-primary transition-colors text-center"
              >
                Download Free Scorecard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Perspective */}
      <section className="bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
              Founder Perspective
            </p>
            <h2 className="font-display font-bold text-4xl text-white mb-4">
              Straight talk on AI in business.
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              Observations from the field. No hype, no vendor pitches.
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-charcoal rounded-xl p-8 flex flex-col justify-between">
              <p className="text-ash leading-relaxed italic">
                &ldquo;AI won&apos;t replace your team. But someone using AI effectively will outcompete someone who isn&apos;t. That gap is widening every month.&rdquo;
              </p>
              <div className="mt-8 pt-6 border-t border-stone/20">
                <p className="text-white font-semibold text-sm">Travis Raveling</p>
                <p className="text-stone text-sm">Founder, PAID LLC</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We've Built */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
              Proof of Work
            </p>
            <h2 className="font-display font-bold text-4xl text-secondary mb-4">
              We built PAID LLC with the same tools we recommend.
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              This site is the case study. Every system we sell, we&apos;ve shipped ourselves.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                label: "AI Chatbot",
                title: "Ask Arti",
                body: "Intent-matching assistant built on a custom knowledge base. No external API costs — edge-deployed on Cloudflare Pages.",
              },
              {
                label: "Purchase & Delivery System",
                title: "Stripe + Supabase",
                body: "Webhook-driven purchase pipeline: payment captured, signed download URL generated, delivered automatically — zero manual steps.",
              },
              {
                label: "Digital Products",
                title: "9 AI Guides Published",
                body: "Researched, written, formatted to PDF, and uploaded to cloud storage. Available at paiddev.com/digital-products.",
              },
              {
                label: "Agent Infrastructure",
                title: "The Latent Space",
                body: "Registry, souvenir system, and digital artifact shop — built for AI agents and the humans who operate them.",
              },
              {
                label: "AI-Integrated Website",
                title: "paiddev.com",
                body: "Next.js 14 + Tailwind, deployed to Cloudflare Pages. Built start-to-finish using Claude Code as the development partner.",
              },
              {
                label: "Free Lead Magnet",
                title: "AI Readiness Scorecard",
                body: "A 10-question self-assessment that scores AI readiness across five business areas. Free, no email required.",
              },
            ].map((item) => (
              <div key={item.title} className="border border-ash rounded-xl p-8">
                <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-3">
                  {item.label}
                </p>
                <h3 className="font-display font-bold text-lg text-secondary mb-3">
                  {item.title}
                </h3>
                <p className="text-stone text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          {/* Latent Space live demo */}
          <div className="mt-12">
            <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-4">
              Live Demo
            </p>
            <div className="rounded-2xl overflow-hidden border border-ash">
              <video
                src="/latent-space-demo.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* AI News Feed */}
      <NewsSection />

      {/* Final CTA */}
      <section className="bg-primary">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="font-display font-bold text-4xl lg:text-5xl text-white mb-6 max-w-2xl mx-auto">
            Ready to put AI to work for your business?
          </h2>
          <p className="text-white/70 text-lg mb-8">
            15 minutes. No pitch. Just a clear look at where AI can move the needle for you.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-white text-primary px-10 py-4 rounded font-semibold text-base hover:bg-ash transition-colors"
          >
            Book a Free AI Audit
          </Link>
        </div>
      </section>
    </>
  );
}
