export const runtime = "edge";

import type { Metadata } from "next";
import { LEAD_MAGNET, QUICK_WINS } from "@/lib/lead-magnet";
import CaptureForm from "./CaptureForm";

export const metadata: Metadata = {
  title: `${LEAD_MAGNET.title} (Free) | PAID LLC`,
  description:
    "Free checklist: 10 AI automations a small business can ship this week using tools you already pay for. No fluff, no jargon, immediately actionable.",
  openGraph: {
    title:       `${LEAD_MAGNET.title} — free from PAID LLC`,
    description: LEAD_MAGNET.subtitle,
  },
};

export default function AiQuickWins() {
  return (
    <>
      {/* Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Free resource
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            {LEAD_MAGNET.title}
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-xl">
            {LEAD_MAGNET.subtitle} Written for owners, not engineers. Every item
            takes under an hour to set up.
          </p>
        </div>
      </section>

      {/* Capture + preview */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <CaptureForm />

            <div>
              <h3 className="font-display font-bold text-xl text-secondary mb-6">
                What&apos;s inside
              </h3>
              <ul className="space-y-4">
                {QUICK_WINS.map((w, i) => (
                  <li key={w.title} className="flex gap-4">
                    <span className="text-primary font-display font-bold text-lg leading-snug w-7 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-charcoal leading-snug pt-0.5">{w.title}</span>
                  </li>
                ))}
              </ul>
              <p className="text-stone text-sm leading-relaxed mt-8 max-w-md">
                Each item comes with exactly how to do it and which tool to use,
                including free options. From PAID LLC, the team behind 17
                practical AI guides for small business.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
