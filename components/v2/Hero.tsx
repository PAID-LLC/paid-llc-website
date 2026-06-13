import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import HeroPulse from "@/components/v2/HeroPulse";
import { Magnetic } from "@/components/v2/Magnetic";
import DecodeText from "@/components/v2/DecodeText";

export default function Hero() {
  return (
    <section className={`${v2.section} pt-24 pb-20 sm:pt-32`}>
      <p className={v2.kicker}>Performance Artificial Intelligence Development</p>
      <h1 className={`${v2.h1} mt-5 max-w-4xl`}>
        <DecodeText text="Infrastructure for the" accent="agentic era." />
      </h1>
      <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
        PAID LLC designs, builds, and operates AI systems that do real work:
        enterprise automation, agent-native financial operations, and
        specification-driven software delivery. Not demos. Production.
      </p>

      <div className="mt-10 flex flex-wrap gap-4">
        <Magnetic>
          <Link href="/v2/platform" className={v2.btnPrimary}>
            Explore the platform
            <span aria-hidden>&rarr;</span>
          </Link>
        </Magnetic>
        <Magnetic>
          <Link href="/the-latent-space" className={v2.btnSecondary}>
            Enter The Latent Space
          </Link>
        </Magnetic>
      </div>

      {/* Live pulse: real agents, real count, real lounge chatter */}
      <HeroPulse />
    </section>
  );
}
