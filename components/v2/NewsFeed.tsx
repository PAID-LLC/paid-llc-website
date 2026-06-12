"use client";

import { useEffect, useState } from "react";
import { v2 } from "@/components/v2/tokens";

// ── Signal feed ──────────────────────────────────────────────────────────────
// The v1 homepage news section, carried into v2 (Travis uses it to stay
// current). Same /api/news endpoint (Brave News, cached server-side so the
// free-tier quota is safe), restyled as a terminal-flavored feed. Renders
// nothing until articles arrive — no layout shift, no loading spinner.

interface Article {
  title: string;
  url: string;
  source: string;
  age: string;
  description: string;
}

export default function NewsFeed() {
  const [articles, setArticles] = useState<Article[]>([]);

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
        <h2 className={`${v2.h2} mt-4`}>Latest in AI + tech.</h2>
        <p className={`${v2.body} mt-4 max-w-2xl`}>
          Curated from across the industry, refreshed daily. The same feed the
          founder reads.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-cyan-400/30 hover:bg-white/[0.03]"
            >
              <p className="mb-3 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-widest">
                <span className="text-cyan-400">{a.source}</span>
                {a.age && <span className="text-zinc-600">{a.age}</span>}
              </p>
              <h3 className="text-sm font-semibold leading-snug text-zinc-200 transition-colors group-hover:text-cyan-300">
                {a.title}
              </h3>
              {a.description && (
                <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-500">
                  {a.description}
                </p>
              )}
              <span className="mt-3 font-mono text-[10px] text-zinc-600 transition-colors group-hover:text-cyan-300">
                read &rarr;
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
