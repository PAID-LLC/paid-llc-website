export const runtime = "edge";

import type { Metadata } from "next";
import { LEAD_MAGNET, QUICK_WINS } from "@/lib/lead-magnet";
import { v2 } from "@/components/v2/tokens";
import CaptureForm from "./CaptureForm";

export const metadata: Metadata = {
  title: `${LEAD_MAGNET.title} (Free) | paiddev.com`,
  description:
    "Free checklist: 10 AI automations a small business can ship this week using tools you already pay for. No fluff, no jargon, immediately actionable.",
  openGraph: {
    title:       `${LEAD_MAGNET.title} — free from paiddev.com`,
    description: LEAD_MAGNET.subtitle,
  },
};

// Teal the final word of the title to match the site-wide H1 accent pattern.
const titleWords = LEAD_MAGNET.title.trim().split(" ");
const titleLead = titleWords.slice(0, -1).join(" ");
const titleLast = titleWords[titleWords.length - 1];

export default function AiQuickWins() {
  return (
    <>
      {/* Header */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>Free resource</p>
        <h1 className={`${v2.h1} mt-5 max-w-2xl`}>
          {titleLead}{titleLead ? " " : ""}
          <span className="text-cyan-400">{titleLast}</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-xl text-lg`}>
          {LEAD_MAGNET.subtitle} Written for owners, not engineers. Every item
          takes under an hour to set up.
        </p>
      </section>

      {/* Capture + preview */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid items-start gap-16 lg:grid-cols-2">
            <CaptureForm />

            <div>
              <h3 className={v2.h3}>What&apos;s inside</h3>
              <ul className="mt-6 space-y-4">
                {QUICK_WINS.map((w, i) => (
                  <li key={w.title} className="flex gap-4">
                    <span className="w-7 shrink-0 font-mono text-lg font-bold leading-snug text-cyan-400/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="pt-0.5 leading-snug text-zinc-300">{w.title}</span>
                  </li>
                ))}
              </ul>
              <p className={`${v2.bodySm} mt-8 max-w-md`}>
                Each item comes with exactly how to do it and which tool to use,
                including free options. From paiddev.com, the team behind 17
                practical AI guides for small business.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
