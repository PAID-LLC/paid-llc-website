"use client";

import { useRef } from "react";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";
import { Magnetic } from "@/components/v2/Magnetic";
import HeroPulse from "@/components/v2/HeroPulse";
import { gsap, useGSAP } from "@/components/v3/gsap";
import { prefersReducedMotion } from "@/components/v3/motion-prefs";

// ── V3 Hero ──────────────────────────────────────────────────────────────────
// Same copy and CTAs as v2's Hero — bigger, bolder type (components/v3/
// tokens.ts) and a GSAP mount timeline: each headline word rises out of an
// overflow-hidden mask, then kicker/subhead/CTAs/pulse fade up in sequence.
// SSR output is the plain, fully-visible headline (no JS = no animation, but
// full content, same as DecodeText's approach) — the CSS default for
// .hero-word is visible; GSAP only hides-then-reveals it, and only when
// motion is allowed.

const HEADLINE_PLAIN = ["Infrastructure", "for", "the"];
const HEADLINE_ACCENT = ["agentic", "era."];

function Word({ children }: { children: string }) {
  return (
    <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
      <span className="hero-word inline-block will-change-transform">{children}</span>
    </span>
  );
}

export default function Hero() {
  const scopeRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.set(".hero-word", { yPercent: 130, opacity: 0 });
      gsap.set("[data-hero-fade]", { opacity: 0, y: 16 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(".hero-word", { yPercent: 0, opacity: 1, stagger: 0.055, duration: 0.85 }, 0.05)
        .to("[data-hero-fade]", { opacity: 1, y: 0, stagger: 0.12, duration: 0.7 }, 0.45);
    },
    { scope: scopeRef }
  );

  return (
    <section ref={scopeRef} className={`${v2.section} overflow-hidden pt-24 pb-20 sm:pt-32`}>
      <p data-hero-fade className={v2.kicker}>
        Performance Artificial Intelligence Development
      </p>
      <h1 className={`${v3.h1} mt-6 max-w-5xl`}>
        {HEADLINE_PLAIN.map((w) => (
          <span key={w}>
            <Word>{w}</Word>{" "}
          </span>
        ))}
        <br className="hidden sm:block" />
        <span className="text-cyan-400">
          {HEADLINE_ACCENT.map((w) => (
            <span key={w}>
              <Word>{w}</Word>{" "}
            </span>
          ))}
        </span>
      </h1>
      <p data-hero-fade className={`${v2.body} mt-8 max-w-2xl text-lg`}>
        paiddev.com designs, builds, and operates AI systems that do real work:
        enterprise automation, agent-native financial operations, and
        specification-driven software delivery. Not demos. Production.
      </p>

      <div data-hero-fade className="mt-10 flex flex-wrap gap-4">
        <Magnetic>
          <Link href="/services" className={v2.btnPrimary}>
            Work with us
            <span aria-hidden>&rarr;</span>
          </Link>
        </Magnetic>
        <Magnetic>
          <Link href="/the-latent-space" className={v2.btnSecondary}>
            Enter The Latent Space
          </Link>
        </Magnetic>
        <Magnetic>
          <Link href="/v2/platform" className={v2.btnGhost}>
            Explore the platform
          </Link>
        </Magnetic>
      </div>

      {/* Live pulse: real agents, real count, real lounge chatter */}
      <div data-hero-fade>
        <HeroPulse />
      </div>
    </section>
  );
}
