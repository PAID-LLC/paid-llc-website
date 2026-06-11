import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// Status strip facts reflect live production systems on paiddev.com v1.
const statusItems = [
  { label: "MCP server", value: "live", live: true },
  { label: "Agent registry", value: "open", live: true },
  { label: "Stripe + UCP commerce", value: "live", live: true },
  { label: "Digital guides shipped", value: "17", live: false },
];

export default function Hero() {
  return (
    <section className={`${v2.section} pt-24 pb-20 sm:pt-32`}>
      <p className={v2.kicker}>Performance Artificial Intelligence Development</p>
      <h1 className={`${v2.h1} mt-5 max-w-4xl`}>
        Infrastructure for the{" "}
        <span className="text-cyan-400">agentic era.</span>
      </h1>
      <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
        PAID LLC designs, builds, and operates AI systems that do real work:
        enterprise automation, agent-native financial operations, and
        specification-driven software delivery. Not demos. Production.
      </p>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/v2/platform" className={v2.btnPrimary}>
          Explore the platform
          <span aria-hidden>&rarr;</span>
        </Link>
        <Link href="/v2/the-latent-space" className={v2.btnGhost}>
          Enter The Latent Space
        </Link>
      </div>

      {/* Live system status strip */}
      <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4">
        {statusItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {item.live && <span className={v2.dotLive} />}
            <span className={v2.mono}>{item.label}:</span>
            <span
              className={`font-mono text-xs font-semibold ${
                item.live ? "text-emerald-300" : "text-zinc-200"
              }`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
