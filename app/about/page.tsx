import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | PAID LLC",
  description:
    "PAID LLC was built to close the gap between AI potential and AI results. Meet founder Travis Raveling.",
};

export default function About() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            About
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            AI should work for your business — not the other way around.
          </h1>
        </div>
      </section>

      {/* Who We Are */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="font-display font-bold text-3xl text-secondary mb-6">
                Who We Are
              </h2>
              <div className="space-y-5 text-stone leading-relaxed">
                <p>
                  PAID LLC — Performance Artificial Intelligence Development —
                  was built on a straightforward idea: AI should work for your
                  business, not the other way around.
                </p>
                <p>
                  Most businesses know AI is important. Few know how to make it
                  actually useful. PAID LLC bridges that gap — helping clients
                  understand what AI can do, identify where it creates real
                  value, and implement it in ways that stick.
                </p>
                <p>
                  After nearly three decades in corporate America — eight years
                  at AT&T spanning sales, collections, contact center
                  leadership, and operations, and more than twenty years at Best
                  Buy moving through accounting, financial analysis, and finance
                  leadership — I had a clear view of how technology either
                  accelerates or disrupts businesses depending on how well
                  leaders understand it. When AI shifted from experiment to
                  business reality, I kept seeing the same problem: powerful
                  tools, no clear path from curiosity to results. PAID LLC
                  exists to close that gap.
                </p>
              </div>
            </div>
            <div>
              <h2 className="font-display font-bold text-3xl text-secondary mb-6">
                Our Approach
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Results over theory",
                    body: "Every engagement is measured by business outcomes, not deliverables.",
                  },
                  {
                    title: "Clarity over complexity",
                    body: "We translate AI jargon into plain language and practical action.",
                  },
                  {
                    title: "Implementation over advice",
                    body: "We don't just recommend. We build and deploy.",
                  },
                  {
                    title: "Accessible AI",
                    body: "Effective AI strategy shouldn't require an enterprise budget.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <span className="text-primary font-bold text-lg flex-shrink-0 mt-0.5">
                      →
                    </span>
                    <div>
                      <p className="font-display font-semibold text-secondary mb-1">
                        {item.title}
                      </p>
                      <p className="text-stone leading-relaxed text-sm">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI and the Environment */}
      <section id="sustainability" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-16">
            <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
              AI and the Environment
            </p>
            <h2 className="font-display font-bold text-4xl text-secondary mb-4">
              What the numbers actually say.
            </h2>
            <p className="text-stone text-lg leading-relaxed">
              The conversation is louder than the data. Here&apos;s what&apos;s real.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            {[
              {
                myth: "AI is an environmental disaster.",
                fact: "AI represents approximately 0.7% of global electricity consumption in 2026. Real cost, real growth. Not the crisis it's framed as.",
              },
              {
                myth: "More AI use means proportionally more energy consumed.",
                fact: "Between 2010 and 2018, global compute grew 550% and storage grew 2,500%, while data center electricity use rose only 6%. Efficiency gains consistently outpace demand growth.",
              },
              {
                myth: "AI has no environmental upside.",
                fact: "AI has the potential to cut more than 5 billion tons of CO2 across agriculture, transportation, and manufacturing. The IEA projects data center electricity to double by 2030. Whether that growth comes from fossil fuels or clean energy depends on how AI gets deployed.",
              },
              {
                myth: "Every AI query has the same footprint.",
                fact: "A standard query produces roughly 0.03 to 1.14 grams of CO2. A reasoning model chain can be 100 times higher. Model selection and task design are leverage points.",
              },
            ].map(({ myth, fact }) => (
              <div key={myth} className="border border-ash rounded-xl p-8 hover:border-primary transition-colors">
                <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-2">Myth</p>
                <p className="font-display font-semibold text-secondary mb-4 leading-snug">{myth}</p>
                <p className="text-stone leading-relaxed text-sm">{fact}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-ash pt-12">
            <p className="text-primary font-semibold text-xs tracking-widest uppercase mb-8">By the Numbers</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
              {[
                { stat: "33x",          label: "Energy reduction per Gemini prompt over 12 months",               source: "Google, 2024 to 2025" },
                { stat: "25x",          label: "Energy efficiency improvement in current-gen GPUs vs. 2 years ago", source: "" },
                { stat: "2.5 to 3.7%", label: "AI's current share of global greenhouse gas emissions",             source: "" },
                { stat: "~60%",         label: "Projected data center energy growth from fossil fuels",             source: "Goldman Sachs Research" },
              ].map(({ stat, label, source }) => (
                <div key={stat}>
                  <p className="font-display font-bold text-4xl text-secondary mb-2">{stat}</p>
                  <p className="text-stone text-sm leading-relaxed">
                    {label}{source ? ` (${source})` : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-stone leading-relaxed max-w-xl">
              PAID LLC helps businesses implement AI at the right scale for the right tasks. That&apos;s not just good ROI. It&apos;s how responsible deployment works.
            </p>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white">
              <Image
                src="/founder.png"
                alt="Travis Raveling, Founder of PAID LLC"
                fill
                className="object-cover object-top"
              />
            </div>
            <div>
              <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
                Founder
              </p>
              <h2 className="font-display font-bold text-4xl text-secondary mb-6">
                Travis Raveling
              </h2>
              <div className="space-y-4 text-stone leading-relaxed">
                <p>
                  Travis Raveling is the founder of PAID LLC and an AI
                  consultant helping individuals and businesses put artificial
                  intelligence to work. With a focus on practical implementation
                  over theory, Travis specializes in translating AI complexity
                  into clear strategy and real results.
                </p>
                <p>
                  A lifelong Minnesotan with degrees in Business Administration
                  and Accounting, Travis brings a finance-first lens to every AI
                  engagement — focused on outcomes that show up on the bottom
                  line. Outside of work, he&apos;s raising five kids and spending
                  time outdoors whenever Minnesota allows it.
                </p>
              </div>
              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-block bg-primary text-white px-8 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
                >
                  Work With Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
