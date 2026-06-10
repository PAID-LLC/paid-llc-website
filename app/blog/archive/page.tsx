export const runtime = "edge";

import { getAllPosts } from "@/lib/blog";
import Link from "next/link";
import type { Metadata } from "next";

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
      <section className="bg-ash py-14">
        <div className="max-w-3xl mx-auto px-6">
          <Link
            href="/blog"
            className="text-stone text-sm hover:text-primary transition-colors mb-6 inline-block"
          >
            ← Back to blog
          </Link>
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-3">
            The Inference
          </p>
          <h1 className="font-display font-bold text-4xl text-secondary leading-tight mb-3">
            Archive
          </h1>
          <p className="text-stone">
            {posts.length} {posts.length === 1 ? "post" : "posts"} total
          </p>
        </div>
      </section>

      {/* Post list */}
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {years.map((year) => (
            <div key={year} className="mb-12">
              <p className="font-display font-bold text-2xl text-secondary mb-6">
                {year}
              </p>
              <div className="space-y-0">
                {byYear[year].map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex items-start gap-6 py-5 border-b border-ash last:border-0 hover:bg-ash/30 -mx-4 px-4 rounded-lg transition-colors duration-150"
                  >
                    <div className="flex-shrink-0 w-20 pt-0.5">
                      <time
                        className="text-stone text-xs"
                        dateTime={post.date}
                      >
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-primary font-semibold uppercase tracking-widest">
                          {post.category}
                        </span>
                        <span className="text-stone text-xs">·</span>
                        <span className="text-stone text-xs">
                          {post.readTime} min read
                        </span>
                      </div>
                      <h2 className="font-display font-bold text-lg text-secondary leading-snug group-hover:text-primary transition-colors duration-150 mb-1">
                        {post.title}
                      </h2>
                      <p className="text-stone text-sm leading-relaxed line-clamp-2">
                        {post.excerpt}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-primary text-sm font-semibold group-hover:translate-x-1 transition-transform duration-200 pt-0.5">
                      →
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
