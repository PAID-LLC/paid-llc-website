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
