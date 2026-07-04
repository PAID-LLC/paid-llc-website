"use client";

import { useRef } from "react";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";
import { gsap, useGSAP } from "@/components/v3/gsap";

// ── Enterprise Automation showcase ──────────────────────────────────────────
// Same 4-stage pipeline copy as v2's EnterpriseAutomation. On a large screen
// with a fine pointer, the section pins and the stage cards translate
// horizontally as the page scrolls vertically — a signature GSAP move that's
// awkward to do with CSS alone. gsap.matchMedia() (not a one-time width
// check) creates/tears down the pin as the viewport crosses the breakpoint
// or prefers-reduced-motion changes live, not just on mount.
// Below the breakpoint, on touch, or under reduced motion: plain wrapping
// flex grid, no horizontal scroll-jack (a known mobile anti-pattern).

const stages = [
  {
    step: "01",
    title: "Assess",
    body: "Map the workflows that burn hours. Score them by automation leverage, risk, and data readiness before a line of code exists.",
  },
  {
    step: "02",
    title: "Specify",
    body: "Every automation starts as a written specification: intent, constraints, failure modes, and the verification that proves it works.",
  },
  {
    step: "03",
    title: "Automate",
    body: "Agents, pipelines, and integrations built against the spec. Edge-deployed, observable, and reversible by design.",
  },
  {
    step: "04",
    title: "Operate",
    body: "Automation is not a handoff. Monitoring, QA agents, and iteration loops keep the system honest after launch.",
  },
];

export default function EnterpriseShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // gsap.matchMedia() (core), not ScrollTrigger.matchMedia() — the core
      // utility returns an instance with .revert() and auto-reverts every
      // tween/ScrollTrigger created inside .add() when the query stops
      // matching or on cleanup, which is what a live resize across the
      // breakpoint needs.
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
        () => {
          const track = trackRef.current;
          if (!track) return;
          const distance = () => track.scrollWidth - window.innerWidth;

          gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: () => `+=${distance()}`,
              scrub: 1,
              pin: true,
              invalidateOnRefresh: true,
            },
          });
        }
      );
      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad} pb-10 lg:pb-0`}>
        <p className={v2.kicker}>Enterprise Automation</p>
        <h2 className={`${v3.h2} mt-4 max-w-3xl`}>Automation that survives contact with production.</h2>
        <p className={`${v2.body} mt-5 max-w-2xl`}>
          Most AI pilots die between the demo and the workflow. Ours ship through a four-stage
          pipeline where each stage has an exit criterion, not a vibe.
        </p>
      </div>

      <div className="overflow-hidden">
        <div ref={trackRef} className="flex flex-wrap gap-6 px-6 pb-10 lg:flex-nowrap lg:pb-32">
          {stages.map((stage) => (
            <div
              key={stage.step}
              className={`${v2.card} w-full shrink-0 sm:w-[calc(50%-0.75rem)] lg:w-[34rem]`}
            >
              <span className="font-mono text-xs font-bold text-cyan-400/70">{stage.step}</span>
              <h3 className={`${v2.h3} mt-3`}>{stage.title}</h3>
              <p className={`${v2.bodySm} mt-2`}>{stage.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
