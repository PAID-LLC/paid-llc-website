import type { Metadata } from "next";
import ScorecardGate from "@/components/ScorecardGate";

export const metadata: Metadata = {
  title: "AI Readiness Scorecard | paiddev.com",
  description:
    "Answer 10 questions and get a clear picture of where your business stands on AI adoption. Free, instant download.",
};

export default function ScorecardPage() {
  return (
    <section className="bg-ash min-h-[70vh] flex items-center">
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
          Free Download
        </p>
        <h1 className="font-display font-bold text-4xl text-secondary mb-6">
          Is your business ready for AI?
        </h1>
        <p className="text-stone text-lg leading-relaxed mb-10 max-w-lg mx-auto">
          Answer 10 questions, get your score, and walk away with a clear next
          step. Takes 5 minutes.
        </p>
        <ScorecardGate />
      </div>
    </section>
  );
}
