"use client";

import { motion, useReducedMotion } from "framer-motion";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";

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
  const reduce = useReducedMotion();

  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad} grid items-center gap-12 lg:grid-cols-2`}>
        <motion.div
          initial={{ opacity: 0, x: reduce ? 0 : -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className={v2.kicker}>Specification-Driven Development</p>
          <h2 className={`${v3.h2} mt-4`}>The spec is the source of truth.</h2>
          <p className={`${v2.body} mt-5`}>
            AI can write code faster than anyone can review it. The leverage is no longer in
            typing. It is in specifying: a precise statement of intent, constraints, and proof
            that survives model upgrades, team changes, and rewrites.
          </p>
          <p className={`${v2.body} mt-4`}>
            Every system we ship is anchored to a written spec. Agents implement it, QA agents
            verify it, and the spec outlives the implementation. When the code is regenerated
            next year by a better model, the contract holds.
          </p>
        </motion.div>

        {/* Spec file card — lines type in one at a time as it enters view */}
        <motion.div
          className={v2.terminal}
          initial={{ opacity: 0, x: reduce ? 0 : 24, scale: reduce ? 1 : 0.97 }}
          whileInView={{ opacity: 1, x: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[11px] text-zinc-500">specs/checkout-delivery.yaml</span>
            <span className={v2.chipLive}>
              <span className={v2.dotLive} />
              verified
            </span>
          </div>
          <motion.div
            className="px-4 py-4 text-[13px] leading-6"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.2 } } }}
          >
            {specLines.map((line) => (
              <motion.pre
                key={line.text}
                className={line.color}
                variants={{
                  hidden: { opacity: 0, y: reduce ? 0 : 6 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                }}
              >
                {line.text}
              </motion.pre>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
