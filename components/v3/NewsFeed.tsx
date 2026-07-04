"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { v2 } from "@/components/v2/tokens";
import { v3 } from "@/components/v3/tokens";

// ── Signal feed (v3) ──────────────────────────────────────────────────────────
// Same /api/news fetch and copy as v2's NewsFeed. Cards animate in on arrival
// (they land async, post-mount, so animating the arrival itself is more
// honest than a scroll trigger that may have already passed) via
// AnimatePresence + a staggered fade/rise.

interface Article {
  title: string;
  url: string;
  source: string;
  age: string;
  description: string;
}

export default function NewsFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d: { articles?: Article[] }) => setArticles(d.articles ?? []))
      .catch(() => {});
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className={v2.divider}>
      <div className={`${v2.section} ${v2.sectionPad}`}>
        <p className={v2.kickerBrand}>Signal feed</p>
        <h2 className={`${v3.h2} mt-4`}>Latest in AI + tech.</h2>
        <p className={`${v2.body} mt-4 max-w-2xl`}>
          Curated from across the industry, refreshed daily. The same feed the founder reads.
        </p>

        <motion.div
          className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.08 } } }}
        >
          <AnimatePresence>
            {articles.map((a, i) => {
              // Two-tone rhythm: cards alternate terracotta / teal accents.
              const lead = i % 2 === 0;
              const border = lead ? "hover:border-[#C14826]/40" : "hover:border-cyan-400/30";
              const accent = lead ? "text-[#E8714C]" : "text-cyan-400";
              const hoverText = lead ? "group-hover:text-[#E8714C]" : "group-hover:text-cyan-300";
              return (
                <motion.a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:bg-white/[0.03] ${border}`}
                  variants={{
                    hidden: { opacity: 0, y: reduce ? 0 : 18 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                  }}
                >
                  <p className="mb-3 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-widest">
                    <span className={accent}>{a.source}</span>
                    {a.age && <span className="text-zinc-600">{a.age}</span>}
                  </p>
                  <h3
                    className={`text-sm font-semibold leading-snug text-zinc-200 transition-colors ${hoverText}`}
                  >
                    {a.title}
                  </h3>
                  {a.description && (
                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-500">
                      {a.description}
                    </p>
                  )}
                  <span className={`mt-3 font-mono text-[10px] text-zinc-600 transition-colors ${hoverText}`}>
                    read &rarr;
                  </span>
                </motion.a>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
