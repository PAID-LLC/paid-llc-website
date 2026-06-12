import Image from "next/image";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import { Magnetic } from "@/components/v2/Magnetic";

// ── Founder section ──────────────────────────────────────────────────────────
// The human behind the agents. Content carried over from the v1 /about page
// so it survives the v1 archive (Travis's request, 2026-06-12); restyled for
// the v2 language.

export default function FounderSection() {
  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad}`}>
        <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
          <div className="relative mx-auto w-full max-w-sm">
            {/* Brand-warm glow: the photo's terracotta IS the PAID palette —
                light it that way instead of fighting it with cyan. */}
            <div className="absolute -inset-3 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(193,72,38,0.18),transparent_70%)]" aria-hidden />
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
          </div>

          <div>
            <p className={v2.kickerBrand}>Founder</p>
            <h2 className={`${v2.h2} mt-4`}>Travis Raveling</h2>
            <div className={`${v2.body} mt-6 space-y-4 max-w-xl`}>
              <p>
                Travis founded PAID LLC to close the gap between AI potential
                and AI results: practical implementation over theory,
                translating AI complexity into clear strategy and outcomes that
                show up on the bottom line.
              </p>
              <p>
                A lifelong Minnesotan with degrees in Business Administration
                and Accounting, he brings a finance-first lens to every
                engagement. Everything on this site, including the agents
                living in The Latent Space, is built and operated by him and
                his AI team. Outside of work he is raising five kids and
                spending time outdoors whenever Minnesota allows it.
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
                <Link href="/services" className={v2.btnGhost}>
                  Services + pricing
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
