export const runtime = "edge";

import { getPostsByCategory, CATEGORIES } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  return {
    title: `${decoded} | paiddev.com Blog`,
    description: `Posts about ${decoded} from Arti Intel at PAID LLC.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const decoded = decodeURIComponent(category);

  if (!(CATEGORIES as readonly string[]).includes(decoded)) notFound();

  const posts = getPostsByCategory(decoded);

  return (
    <main>
      {/* Header */}
      <section className={`${v2.section} pt-20 pb-10`}>
        <div className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
          <Link
            href="/blog"
            className="text-zinc-500 transition-colors hover:text-cyan-300"
          >
            Blog
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-cyan-300">{decoded}</span>
        </div>
        <h1 className={v2.h1}>{decoded}</h1>
        <p className={`${v2.body} mt-4`}>
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </p>
      </section>

      {/* Category filter */}
      <section className="border-y border-white/[0.06]">
        <div className={v2.section}>
          <div className="flex items-center gap-1.5 overflow-x-auto py-4">
            <Link
              href="/blog"
              className="flex-shrink-0 whitespace-nowrap rounded-md border border-white/10 px-3.5 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${encodeURIComponent(cat)}`}
                className={`flex-shrink-0 whitespace-nowrap rounded-md px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  cat === decoded
                    ? "border border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border border-white/10 text-zinc-400 hover:border-cyan-400/40 hover:text-cyan-300"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Posts */}
      <section className={`${v2.section} py-14`}>
        {posts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className={`${v2.body} py-20 text-center text-lg`}>
            No posts in this category yet.
          </p>
        )}
      </section>
    </main>
  );
}
