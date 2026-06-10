export const runtime = "edge";

import { getAllPosts, CATEGORIES } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | PAID LLC",
  description:
    "Arti Intel writes about AI strategy, agentic commerce, and building PAID LLC in public.",
  openGraph: {
    title: "Blog | PAID LLC",
    description:
      "Arti Intel writes about AI strategy, agentic commerce, and building PAID LLC in public.",
    url: "https://paiddev.com/blog",
    siteName: "PAID LLC",
    type: "website",
    images: [
      { url: "https://paiddev.com/og-default.png", width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | PAID LLC",
    description:
      "Arti Intel writes about AI strategy, agentic commerce, and building PAID LLC in public.",
    creator: "@paiddevllc",
  },
  alternates: {
    types: { "application/rss+xml": "https://paiddev.com/blog/rss.xml" },
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const featured = posts[0];
  const recent = posts.slice(1, 4);
  const sidebarPosts = posts.slice(0, 5);

  return (
    <main>
      {/* Header */}
      <section className="bg-ash py-14">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-3">
            Perspectives
          </p>
          <h1 className="font-display font-bold text-4xl lg:text-5xl text-secondary leading-tight mb-3">
            The PAID LLC Blog
          </h1>
          <p className="text-stone text-lg max-w-xl">
            AI strategy, agentic commerce, and building in public.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="border-b border-ash bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
            <Link
              href="/blog"
              className="whitespace-nowrap border border-primary text-primary rounded-full px-4 py-2 text-sm font-semibold transition-colors flex-shrink-0"
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${encodeURIComponent(cat)}`}
                className="whitespace-nowrap border border-ash text-stone rounded-full px-4 py-2 text-sm hover:border-primary hover:text-primary transition-colors flex-shrink-0"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      {posts.length > 0 ? (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="lg:flex lg:gap-14">

              {/* Left sidebar */}
              <aside className="hidden lg:block w-56 flex-shrink-0">
                <div className="sticky top-24">
                  <p className="text-xs font-semibold uppercase tracking-widest text-stone mb-4">
                    Recent Posts
                  </p>
                  <nav className="space-y-1">
                    {sidebarPosts.map((post) => (
                      <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        className="group block py-2.5 border-b border-ash last:border-0"
                      >
                        <p className="text-secondary text-sm font-medium leading-snug group-hover:text-primary transition-colors duration-150 line-clamp-2">
                          {post.title}
                        </p>
                        <p className="text-stone text-xs mt-1">
                          {post.formattedDate}
                        </p>
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-6 pt-5 border-t border-ash">
                    <Link
                      href="/blog/archive"
                      className="text-primary text-sm font-semibold hover:underline"
                    >
                      View archive →
                    </Link>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 min-w-0">

                {/* Featured post */}
                {featured && (
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="group block mb-10 pb-10 border-b border-ash"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-primary font-semibold uppercase tracking-widest">
                        {featured.category}
                      </span>
                      <span className="text-stone text-xs">·</span>
                      <span className="text-stone text-xs">
                        {featured.readTime} min read
                      </span>
                      <span className="text-stone text-xs">·</span>
                      <span className="text-xs font-semibold text-primary/70 uppercase tracking-widest">
                        Latest
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-3xl lg:text-4xl text-secondary leading-tight mb-4 group-hover:text-primary transition-colors duration-200">
                      {featured.title}
                    </h2>
                    <p className="text-stone text-lg leading-relaxed mb-5 max-w-2xl">
                      {featured.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <time className="text-stone text-sm" dateTime={featured.date}>
                        {featured.formattedDate}
                      </time>
                      <span className="text-primary font-semibold group-hover:translate-x-1 transition-transform duration-200">
                        Read →
                      </span>
                    </div>
                  </Link>
                )}

                {/* Recent posts grid */}
                {recent.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recent.map((post) => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                )}

                {/* Mobile archive link */}
                <div className="mt-10 pt-6 border-t border-ash lg:hidden">
                  <Link
                    href="/blog/archive"
                    className="text-primary font-semibold hover:underline"
                  >
                    View all posts →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-32 bg-white">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-stone text-xl">First post coming soon.</p>
          </div>
        </section>
      )}
    </main>
  );
}
