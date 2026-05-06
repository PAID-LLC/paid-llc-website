export const runtime = "edge";

import { getPostsByCategory, CATEGORIES } from "@/lib/blog";
import BlogCard from "@/components/BlogCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return CATEGORIES.map((category) => ({
    category: encodeURIComponent(category),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  return {
    title: `${decoded} | PAID LLC Blog`,
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
      <section className="bg-ash py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-6 text-xs uppercase tracking-widest">
            <Link
              href="/blog"
              className="text-stone hover:text-primary transition-colors"
            >
              Blog
            </Link>
            <span className="text-stone">/</span>
            <span className="text-primary font-semibold">{decoded}</span>
          </div>
          <h1 className="font-display font-bold text-5xl text-secondary leading-tight mb-4">
            {decoded}
          </h1>
          <p className="text-stone text-xl">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </p>
        </div>
      </section>

      <section className="border-b border-ash bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none">
            <Link
              href="/blog"
              className="whitespace-nowrap border border-ash text-stone rounded-full px-4 py-2 text-sm hover:border-primary hover:text-primary transition-colors flex-shrink-0"
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${encodeURIComponent(cat)}`}
                className={`whitespace-nowrap border rounded-full px-4 py-2 text-sm transition-colors flex-shrink-0 ${
                  cat === decoded
                    ? "border-primary text-primary font-semibold"
                    : "border-ash text-stone hover:border-primary hover:text-primary"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          {posts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-stone text-lg text-center py-20">
              No posts in this category yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
