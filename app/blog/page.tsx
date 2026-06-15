export const runtime = "edge";

import { getAllPosts, CATEGORIES } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import Link from "next/link";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

export const metadata: Metadata = {
  title: "The Inference | PAID LLC",
  description:
    "AI strategy, agentic commerce, and building in public. Practical takes from inside real deployments.",
  openGraph: {
    title: "The Inference | PAID LLC",
    description:
      "AI strategy, agentic commerce, and building in public. Practical takes from inside real deployments.",
    url: "https://paiddev.com/blog",
    siteName: "PAID LLC",
    type: "website",
    images: [
      { url: "https://paiddev.com/og-default.png", width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Inference | PAID LLC",
    description:
      "AI strategy, agentic commerce, and building in public. Practical takes from inside real deployments.",
    creator: "@paiddevllc",
  },
  alternates: {
    types: { "application/rss+xml": "https://paiddev.com/blog/rss.xml" },
  },
};

const label = "font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500";

export default function BlogPage() {
  const posts = getAllPosts();
  const featured = posts[0];
  const recent = posts.slice(1, 4);
  const sidebarPosts = posts.slice(0, 5);

  return (
    <main>
      {/* Header */}
      <section className={`${v2.section} pt-20 pb-10`}>
        <p className={v2.kicker}>by PAID LLC</p>
        <h1 className={`${v2.h1} mt-5`}>The Inference</h1>
        <p className={`${v2.body} mt-5 max-w-xl text-lg`}>
          Practical takes from inside real AI deployments. No hype, no summaries
          of summaries.
        </p>
      </section>

      {/* Category filter */}
      <section className="border-y border-white/[0.06]">
        <div className={v2.section}>
          <div className="flex items-center gap-1.5 overflow-x-auto py-4">
            <Link
              href="/blog"
              className="flex-shrink-0 whitespace-nowrap rounded-md border border-cyan-400/50 bg-cyan-400/10 px-3.5 py-1.5 font-mono text-xs text-cyan-200"
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${encodeURIComponent(cat)}`}
                className="flex-shrink-0 whitespace-nowrap rounded-md border border-white/10 px-3.5 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      {posts.length > 0 ? (
        <section className={`${v2.section} py-14`}>
          <div className="lg:flex lg:gap-14">
            {/* Left sidebar */}
            <aside className="hidden w-56 flex-shrink-0 lg:block">
              <div className="sticky top-24">
                <p className={`${label} mb-4`}>Recent Posts</p>
                <nav className="space-y-1">
                  {sidebarPosts.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group block border-b border-white/[0.06] py-2.5 last:border-0"
                    >
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-300 transition-colors duration-150 group-hover:text-cyan-200">
                        {post.title}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-500">
                        {post.formattedDate}
                      </p>
                    </Link>
                  ))}
                </nav>
                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <Link
                    href="/blog/archive"
                    className="font-mono text-xs font-medium text-[#E8714C] transition-colors hover:text-[#F08A66]"
                  >
                    View archive &rarr;
                  </Link>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <div className="min-w-0 flex-1">
              {/* Featured post */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group mb-10 block border-b border-white/[0.06] pb-10"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                      {featured.category}
                    </span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="font-mono text-xs text-zinc-500">
                      {featured.readTime} min read
                    </span>
                    <span className="text-xs text-zinc-600">·</span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-[#E8714C]">
                      Latest
                    </span>
                  </div>
                  <h2
                    className={`${v2.h2} leading-tight transition-colors duration-200 group-hover:text-cyan-100`}
                  >
                    {featured.title}
                  </h2>
                  <p className={`${v2.body} mt-4 max-w-2xl`}>
                    {featured.excerpt}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <time
                      className="font-mono text-xs text-zinc-500"
                      dateTime={featured.date}
                    >
                      {featured.formattedDate}
                    </time>
                    <span className="font-mono text-sm font-medium text-[#E8714C] transition-transform duration-200 group-hover:translate-x-1">
                      Read &rarr;
                    </span>
                  </div>
                </Link>
              )}

              {/* Recent posts grid */}
              {recent.length > 0 && (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {recent.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              )}

              {/* Mobile archive link */}
              <div className="mt-10 border-t border-white/[0.06] pt-6 lg:hidden">
                <Link
                  href="/blog/archive"
                  className="font-mono text-sm font-medium text-[#E8714C] transition-colors hover:text-[#F08A66]"
                >
                  View all posts &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={`${v2.section} py-32`}>
          <p className={`${v2.body} text-center text-lg`}>
            First post coming soon.
          </p>
        </section>
      )}
    </main>
  );
}
