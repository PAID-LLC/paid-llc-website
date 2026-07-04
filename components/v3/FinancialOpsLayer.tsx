"use client";

import { motion, useReducedMotion } from "framer-motion";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";

// This flow is the real production pipeline running on paiddev.com today,
// not aspirational architecture. Copy should stay in sync with it.
const flow = [
  { stage: "Checkout", detail: "Stripe" },
  { stage: "Verify", detail: "HMAC webhook" },
  { stage: "Fulfill", detail: "Signed URL" },
  { stage: "Deliver", detail: "Email receipt" },
  { stage: "Retain", detail: "List + follow-up" },
];

const agenticFeatures = [
  {
    title: "Agent-readable storefront",
    body: "agent.json discovery, UCP endpoints, and an MCP server let autonomous agents find, evaluate, and purchase without a human in the loop.",
  },
  {
    title: "Multi-rail payments",
    body: "Card payments through Stripe and crypto through Coinbase Business. The checkout meets the buyer, human or agent, on its preferred rail.",
  },
  {
    title: "Verified end to end",
    body: "Signature-checked webhooks, expiring signed URLs, and QA agents that exercise the live purchase path after every deploy.",
  },
];

export default function FinancialOpsLayer() {
  const reduce = useReducedMotion();

  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad}`}>
        <div className="flex flex-wrap items-center gap-3">
          <p className={v2.kicker}>Financial Operations Layer</p>
          <span className={v2.chipLive}>
            <span className={v2.dotLive} />
            Running in production
          </span>
        </div>
        <h2 className={`${v3.h2} mt-4 max-w-3xl`}>Commerce built for humans and agents.</h2>
        <p className={`${v2.body} mt-5 max-w-2xl`}>
          The pipeline below is not a diagram of what we would build for you. It is the system
          processing real orders on this domain right now. We build the same layer for clients.
        </p>

        {/* Live pipeline flow — nodes cascade in left to right as they enter view */}
        <div className="mt-12 overflow-x-auto">
          <motion.div
            className="flex min-w-max items-stretch gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.12 } } }}
          >
            {flow.map((node, i) => (
              <motion.div
                key={node.stage}
                className="flex items-center gap-3"
                variants={{
                  hidden: { opacity: 0, x: reduce ? 0 : -16 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
                }}
              >
                <div className="w-36 rounded-lg border border-white/[0.08] bg-[#0b0b12] px-4 py-3">
                  <p className="font-mono text-xs font-semibold text-zinc-100">{node.stage}</p>
                  <p className="mt-1 font-mono text-[11px] text-cyan-400/80">{node.detail}</p>
                </div>
                {i < flow.length - 1 && (
                  <span aria-hidden className="font-mono text-zinc-600">
                    &rarr;
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="mt-12 grid gap-4 lg:grid-cols-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.1 } } }}
        >
          {agenticFeatures.map((feature) => (
            <motion.div
              key={feature.title}
              className={v2.card}
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 20 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
              }}
            >
              <h3 className={v2.h3}>{feature.title}</h3>
              <p className={`${v2.bodySm} mt-2`}>{feature.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
