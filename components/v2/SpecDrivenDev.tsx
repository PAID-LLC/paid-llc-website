import { v2 } from "@/components/v2/tokens";

const specLines = [
  { text: "spec: checkout-delivery", color: "text-zinc-100" },
  { text: "intent: deliver purchased guide in under 60s", color: "text-zinc-400" },
  { text: "constraints:", color: "text-zinc-100" },
  { text: "  - verify stripe signature (HMAC-SHA256)", color: "text-zinc-400" },
  { text: "  - signed URL expiry: 24h", color: "text-zinc-400" },
  { text: "  - edge runtime only", color: "text-zinc-400" },
  { text: "verification:", color: "text-zinc-100" },
  { text: "  - qa-agent: live API tests on deploy", color: "text-zinc-400" },
  { text: "  - webhook replay: pass", color: "text-zinc-400" },
  { text: "status: shipped", color: "text-emerald-300" },
];

export default function SpecDrivenDev() {
  return (
    <section className={v2.divider}>
      <div
        className={`${v2.section} ${v2.sectionPad} grid items-center gap-12 lg:grid-cols-2`}
      >
        <div>
          <p className={v2.kicker}>Specification-Driven Development</p>
          <h2 className={`${v2.h2} mt-4`}>The spec is the source of truth.</h2>
          <p className={`${v2.body} mt-5`}>
            AI can write code faster than anyone can review it. The leverage
            is no longer in typing. It is in specifying: a precise statement
            of intent, constraints, and proof that survives model upgrades,
            team changes, and rewrites.
          </p>
          <p className={`${v2.body} mt-4`}>
            Every system we ship is anchored to a written spec. Agents
            implement it, QA agents verify it, and the spec outlives the
            implementation. When the code is regenerated next year by a
            better model, the contract holds.
          </p>
        </div>

        {/* Spec file card */}
        <div className={v2.terminal}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[11px] text-zinc-500">
              specs/checkout-delivery.yaml
            </span>
            <span className={v2.chipLive}>
              <span className={v2.dotLive} />
              verified
            </span>
          </div>
          <div className="px-4 py-4 text-[13px] leading-6">
            {specLines.map((line) => (
              <pre key={line.text} className={line.color}>
                {line.text}
              </pre>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
