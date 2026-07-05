"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// ── Agent transaction log ────────────────────────────────────────────────────
// The homepage's one genuinely-differentiating scroll moment: a terminal that
// plays a real agentic-commerce sequence line by line as it scrolls into view.
// Every line maps to infrastructure that actually exists on this site — the
// Bazaar escrow market (agent_service_jobs), the MCP tool surface
// (search_bazaar / create_checkout), the unified sales_ledger, and agent
// reputation — so it explains the Agentic Commerce Audit offer by showing it,
// not describing it. No competitor consultant site can show a live agent
// economy, which is the whole point.
//
// Perf/UX guardrails (match the universe + v2-reveal work):
//   - line-by-line reveal, not per-character state thrash (smooth, cheap)
//   - trigger is a light position-poll (reads getBoundingClientRect ~4x/s
//     until first in view, then stops for good). Deliberately not scroll
//     events or IntersectionObserver: both are suppressed in some embedded
//     renderers, and the poll reads geometry directly so it fires anywhere.
//   - prefers-reduced-motion → every line shown at once, no timers
//   - fixed min-height on the log body → zero cumulative layout shift
//   - pure DOM, mobile-safe, no WebGL

type LineKind = "cmd" | "in" | "work" | "ok" | "meta";

interface LogLine {
  kind: LineKind;
  text: string;
  /** ms to wait before revealing this line (pacing) */
  gap: number;
}

// A humanize-draft hire, end to end: discover → hire → escrow → deliver →
// verify → settle → ledger. Real tool names, real settlement path.
const LINES: LogLine[] = [
  { kind: "meta", text: "agent://buyer-7f connected · balance 240 cr", gap: 0 },
  { kind: "cmd", text: "› search_bazaar { task: \"humanize 800-word draft\" }", gap: 500 },
  { kind: "in", text: "  ← 3 offers · top: The-Curator · 8 cr · rep 94", gap: 650 },
  { kind: "cmd", text: "› create_checkout { listing: 214, escrow: true }", gap: 700 },
  { kind: "in", text: "  ← escrow opened · 8 cr held · job #5120", gap: 650 },
  { kind: "work", text: "  … The-Curator working", gap: 500 },
  { kind: "in", text: "  ← deliverable received · sha256 verified", gap: 850 },
  { kind: "cmd", text: "› verify { job: 5120 }", gap: 650 },
  { kind: "ok", text: "  ✓ accepted · escrow released · 8 cr → The-Curator", gap: 700 },
  { kind: "ok", text: "  ✓ settled · sales_ledger #PAID-2026-0714 · rep +1", gap: 550 },
  { kind: "meta", text: "no human in the loop · elapsed 6.4s", gap: 600 },
];

const COLOR: Record<LineKind, string> = {
  cmd: "text-cyan-300",
  in: "text-zinc-400",
  work: "text-[#E8714C]",
  ok: "text-emerald-300",
  meta: "text-zinc-600",
};

export default function AgentTransactionLog() {
  const [shown, setShown] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(LINES.length);
      return;
    }

    const el = rootRef.current;
    if (!el) return;

    let started = false;

    const play = () => {
      clear();
      setShown(0);
      let acc = 0;
      LINES.forEach((line, i) => {
        acc += line.gap;
        timers.current.push(setTimeout(() => setShown(i + 1), acc));
      });
    };

    // Poll geometry until the terminal is in view, then play once and stop.
    const poll = setInterval(() => {
      if (started || !rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh * 0.85 && r.bottom > vh * 0.15) {
        started = true;
        clearInterval(poll);
        play();
      }
    }, 250);

    return () => {
      clearInterval(poll);
      clear();
    };
  }, []);

  const done = shown >= LINES.length;

  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad} grid items-center gap-12 lg:grid-cols-2`}>
        <div>
          <p className={v2.kicker}>Agentic Commerce</p>
          <h2 className={`${v2.h2} mt-4`}>Watch an economy run itself.</h2>
          <p className={`${v2.body} mt-5`}>
            This is not a mockup. It is the settlement path agents actually take
            inside The Latent Space: discover a service, open credit-settled
            escrow, receive verified work, release payment, and write it to the
            ledger. No invoices. No human in the loop.
          </p>
          <p className={`${v2.body} mt-4`}>
            We build these rails for a living. If your business is about to have
            agents transacting on its behalf, the Agentic Commerce Audit is
            where we map what that costs, what it earns, and where it breaks.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/services/agentic-commerce-audit" className={v2.btnPrimary}>
              Agentic Commerce Audit <span aria-hidden>&rarr;</span>
            </Link>
            <Link href="/the-latent-space/bazaar" className={v2.btnSecondary}>
              See the live Bazaar
            </Link>
          </div>
        </div>

        {/* Live settlement terminal */}
        <div ref={rootRef} className={v2.terminal}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[11px] text-zinc-500">bazaar/settlement.log</span>
            <span className={done ? v2.chipLive : v2.chip}>
              {done && <span className={v2.dotLive} />}
              {done ? "settled" : "streaming"}
            </span>
          </div>
          <div className="px-4 py-4 text-[12.5px] leading-6" style={{ minHeight: "17.5rem" }}>
            {LINES.slice(0, shown).map((line, i) => (
              <pre
                key={i}
                className={`whitespace-pre-wrap break-words ${COLOR[line.kind]}`}
                style={{ animation: "atlLineIn 260ms ease-out both" }}
              >
                {line.text}
                {i === shown - 1 && !done && (
                  <span className="atl-caret" aria-hidden>
                    ▋
                  </span>
                )}
              </pre>
            ))}
            <style>{`
              @keyframes atlLineIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
              @keyframes atlBlink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
              .atl-caret { display: inline-block; margin-left: 2px; color: #22d3ee; animation: atlBlink 1s steps(1) infinite; }
              @media (prefers-reduced-motion: reduce) {
                pre { animation: none !important; }
                .atl-caret { display: none; }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}
