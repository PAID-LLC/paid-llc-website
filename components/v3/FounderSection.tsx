"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";
import { Magnetic } from "@/components/v2/Magnetic";

// ── Founder section (v3) ─────────────────────────────────────────────────────
// Same content as v2's FounderSection (carried over from the v1 /about page
// per Travis's request). Adds a subtle scroll parallax on the photo and a
// fade-up entrance on the bio column. Magnetic CTAs kept as-is — cheap,
// proven, no reason to rebuild in Framer Motion.

export default function FounderSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-32, 32]);

  return (
    <section className={v2.divider}>
      <div ref={sectionRef} className={`${v2.section} ${v2.sectionPad}`}>
        <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
          <motion.div
            className="relative mx-auto w-full max-w-sm"
            style={{ y: photoY }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Brand-warm glow: the photo's terracotta IS the PAID palette —
                light it that way instead of fighting it with cyan. */}
            <div
              className="absolute -inset-3 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(193,72,38,0.18),transparent_70%)]"
              aria-hidden
            />
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-[#C14826]/30">
              <Image
                src="/founder.png"
                alt="Travis Raveling, Founder of PAID LLC"
                fill
                sizes="(max-width: 1024px) 90vw, 380px"
                className="object-cover object-top saturate-[0.92]"
              />
              {/* Grade: darken the lower edge so the bright photo seats into
                  the dark UI instead of floating on top of it */}
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,7,11,0.55),transparent_45%)]"
              />
              <div className="absolute inset-x-0 bottom-0 border-t border-[#C14826]/25 bg-[#07070b]/85 px-4 py-2.5 backdrop-blur-sm">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#E8714C]">
                  founder / human-in-the-loop
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <p className={v2.kickerBrand}>Founder</p>
            <h2 className={`${v3.h2} mt-4`}>Travis Raveling</h2>
            <div className={`${v2.body} mt-6 max-w-xl space-y-4`}>
              <p>
                Travis founded PAID LLC to close the gap between AI potential and AI results:
                practical implementation over theory, translating AI complexity into clear
                strategy and outcomes that show up on the bottom line.
              </p>
              <p>
                A lifelong Minnesotan with degrees in Business Administration and Accounting, he
                brings a finance-first lens to every engagement. Everything on this site,
                including the agents living in The Latent Space, is built and operated by him and
                his AI team. Outside of work he is raising five kids and spending time outdoors
                whenever Minnesota allows it.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Magnetic>
                <Link href="/contact" className={v2.btnBrand}>
                  Work with us
                  <span aria-hidden>&rarr;</span>
                </Link>
              </Magnetic>
              <Magnetic>
                <Link href="/services" className={v2.btnSecondary}>
                  Services + pricing
                </Link>
              </Magnetic>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
