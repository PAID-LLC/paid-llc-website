import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

export const metadata: Metadata = {
  title: "About | paiddev.com",
  description:
    "paiddev.com was built to close the gap between AI potential and AI results. Meet founder Travis Raveling.",
};

const approach = [
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
];

const myths = [
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
];

const stats = [
  { stat: "33x", body: "Energy reduction per Gemini prompt over 12 months", source: "Google, 2024 to 2025" },
  { stat: "25x", body: "Energy efficiency improvement in current-gen GPUs vs. 2 years ago", source: "" },
  { stat: "2.5 to 3.7%", body: "AI's current share of global greenhouse gas emissions", source: "" },
  { stat: "~60%", body: "Projected data center energy growth from fossil fuels", source: "Goldman Sachs Research" },
];

export default function About() {
  return (
    <>
      {/* Header */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>About</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          AI should work for your business, not the other way around.
        </h1>
      </section>

      {/* Who We Are / Our Approach */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className={v2.h2}>Who We Are</h2>
              <div className="mt-6 space-y-5">
                <p className={v2.body}>
                  paiddev.com (Performance Artificial Intelligence Development LLC) was
                  built on a straightforward idea: AI should work for your
                  business, not the other way around.
                </p>
                <p className={v2.body}>
                  Most businesses know AI is important. Few know how to make it
                  actually useful. paiddev.com bridges that gap, helping clients
                  understand what AI can do, identify where it creates real
                  value, and implement it in ways that stick.
                </p>
                <p className={v2.body}>
                  After nearly three decades in corporate America (eight years at
                  AT&amp;T spanning sales, collections, contact center leadership,
                  and operations, and more than twenty years at Best Buy moving
                  through accounting, financial analysis, and finance leadership),
                  I had a clear view of how technology either accelerates or
                  disrupts businesses depending on how well leaders understand it.
                  When AI shifted from experiment to business reality, I kept
                  seeing the same problem: powerful tools, no clear path from
                  curiosity to results. paiddev.com exists to close that gap.
                </p>
              </div>
            </div>
            <div>
              <h2 className={v2.h2}>Our Approach</h2>
              <div className="mt-6 space-y-5">
                {approach.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                      &rarr;
                    </span>
                    <div>
                      <p className="font-mono text-sm font-semibold text-zinc-100">
                        {item.title}
                      </p>
                      <p className={`${v2.bodySm} mt-1`}>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI and the Environment */}
      <section id="sustainability" className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <p className={v2.kicker}>AI and the Environment</p>
          <h2 className={`${v2.h2} mt-4`}>What the numbers actually say.</h2>
          <p className={`${v2.body} mt-4 max-w-2xl`}>
            The conversation is louder than the data. Here&apos;s what&apos;s real.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {myths.map(({ myth, fact }) => (
              <div key={myth} className={v2.card}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                  Myth
                </p>
                <p className={`${v2.h3} mt-2 leading-snug`}>{myth}</p>
                <p className={`${v2.bodySm} mt-3`}>{fact}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-white/[0.06] pt-12">
            <p className="mb-8 font-mono text-[11px] uppercase tracking-widest text-cyan-300">
              By the Numbers
            </p>
            <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(({ stat, body, source }) => (
                <div key={stat}>
                  <p className="font-mono text-4xl font-bold text-zinc-100">
                    {stat}
                  </p>
                  <p className={`${v2.bodySm} mt-2`}>
                    {body}
                    {source ? ` (${source})` : ""}
                  </p>
                </div>
              ))}
            </div>
            <p className={`${v2.body} max-w-xl`}>
              paiddev.com helps businesses implement AI at the right scale for the
              right tasks. That&apos;s not just good ROI. It&apos;s how
              responsible deployment works.
            </p>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[0.06]">
              <Image
                src="/founder.png"
                alt="Travis Raveling, Founder of paiddev.com"
                fill
                className="object-cover object-top"
              />
            </div>
            <div>
              <p className={v2.kicker}>Founder</p>
              <h2 className={`${v2.h2} mt-4`}>Travis Raveling</h2>
              <div className="mt-6 space-y-4">
                <p className={v2.body}>
                  Travis Raveling is the founder of paiddev.com and an AI consultant
                  helping individuals and businesses put artificial intelligence
                  to work. With a focus on practical implementation over theory,
                  Travis specializes in translating AI complexity into clear
                  strategy and real results.
                </p>
                <p className={v2.body}>
                  A lifelong Minnesotan with degrees in Business Administration
                  and Accounting, Travis brings a finance-first lens to every AI
                  engagement, focused on outcomes that show up on the bottom line.
                  Outside of work, he&apos;s raising five kids and spending time
                  outdoors whenever Minnesota allows it.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/contact" className={v2.btnPrimary}>
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
