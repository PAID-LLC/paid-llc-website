export const runtime = "edge";

import { getAllPosts } from "@/lib/blog";
import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

export const metadata: Metadata = {
  title: "Archive | The Inference — PAID LLC",
  description: "All posts from The Inference, newest first.",
};

export default function ArchivePage() {
  const posts = getAllPosts();

  // Group by year for easy scanning
  const byYear = posts.reduce<Record<string, typeof posts>>((acc, post) => {
    const year = new Date(post.date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(post);
    return acc;
  }, {});

  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <main>
      {/* Header */}
      <section className={`${v2.section} pt-20 pb-10`}>
        <Link
          href="/blog"
          className="mb-6 inline-block font-mono text-xs text-zinc-500 transition-colors hover:text-cyan-300"
        >
          &larr; Back to blog
        </Link>
        <p className={v2.kicker}>The Inference</p>
        <h1 className={`${v2.h1} mt-5`}>Archive</h1>
        <p className={`${v2.body} mt-4`}>
          {posts.length} {posts.length === 1 ? "post" : "posts"} total
        </p>
      </section>

      {/* Post list */}
      <section className="border-t border-white/[0.06]">
        <div className={`${v2.section} max-w-3xl py-14`}>
          {years.map((year) => (
            <div key={year} className="mb-12">
              <p className="mb-6 font-mono text-2xl font-bold text-zinc-100">
                {year}
              </p>
              <div className="space-y-0">
                {byYear[year].map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group -mx-4 flex items-start gap-6 rounded-lg border-b border-white/[0.06] px-4 py-5 transition-colors duration-150 last:border-0 hover:bg-white/[0.02]"
                  >
                    <div className="w-20 flex-shrink-0 pt-0.5">
                      <time
                        className="font-mono text-xs text-zinc-500"
                        dateTime={post.date}
                      >
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                          {post.category}
                        </span>
                        <span className="text-xs text-zinc-600">·</span>
                        <span className="font-mono text-xs text-zinc-500">
                          {post.readTime} min read
                        </span>
                      </div>
                      <h2 className="mb-1 font-mono text-lg font-semibold leading-snug text-zinc-100 transition-colors duration-150 group-hover:text-cyan-100">
                        {post.title}
                      </h2>
                      <p className={`${v2.bodySm} line-clamp-2`}>
                        {post.excerpt}
                      </p>
                    </div>
                    <span className="flex-shrink-0 pt-0.5 font-mono text-sm text-[#E8714C] transition-transform duration-200 group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
