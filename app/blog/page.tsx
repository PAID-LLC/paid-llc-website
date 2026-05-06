import { getAllPosts, CATEGORIES } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import Link from "next/link";
import Image from "next/image";
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
  const rest = posts.slice(1);

  return (
    <main>
      {/* Hero */}
      <section className="bg-ash py-24">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">
            Perspectives
          </p>
          <h1 className="font-display font-bold text-5xl lg:text-6xl text-secondary leading-tight mb-6">
            The PAID LLC Blog
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-2xl">
            AI strategy, agentic commerce, building in public, and the decisions
            behind PAID LLC.
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

      {/* Featured Post */}
      {featured && (
        <section className="py-16 border-b border-ash bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone mb-8">
              Featured
            </p>
            <Link
              href={`/blog/${featured.slug}`}
              className="group block lg:grid lg:grid-cols-2 lg:gap-16 items-center"
            >
              {featured.featured_image && (
                <div className="aspect-[4/3] bg-ash rounded-xl overflow-hidden mb-8 lg:mb-0">
                  <Image
                    src={featured.featured_image}
                    alt={featured.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div
                className={
                  featured.featured_image ? "" : "lg:col-span-2 max-w-3xl"
                }
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-primary font-semibold uppercase tracking-widest">
                    {featured.category}
                  </span>
                  <span className="text-stone text-xs">·</span>
                  <span className="text-stone text-xs">
                    {featured.readTime} min read
                  </span>
                </div>
                <h2 className="font-display font-bold text-3xl lg:text-4xl text-secondary leading-tight mb-4 group-hover:text-primary transition-colors duration-200">
                  {featured.title}
                </h2>
                <p className="text-stone text-lg leading-relaxed mb-6">
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
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Post Grid */}
      {rest.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </section>
      )}

      {posts.length === 0 && (
        <section className="py-32 bg-white">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-stone text-xl">First post coming soon.</p>
          </div>
        </section>
      )}
    </main>
  );
}
