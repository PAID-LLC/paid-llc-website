export const runtime = "edge";

import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  extractHeadings,
} from "@/lib/blog";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ArticleHeader from "@/components/ArticleHeader";
import SocialShare from "@/components/SocialShare";
import ReadingProgress from "@/components/ReadingProgress";
import TableOfContents from "@/components/TableOfContents";
import NewsletterSignup from "@/components/NewsletterSignup";
import BlogCard from "@/components/BlogCard";

async function compileMarkdown(content: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeStringify)
    .process(content);
  return result.toString();
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const ogImage =
    post.og_image ||
    post.featured_image ||
    "https://paiddev.com/og-default.png";

  return {
    title: `${post.title} | PAID LLC`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://paiddev.com/blog/${post.slug}`,
      siteName: "PAID LLC",
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
      creator: "@paiddevllc",
    },
    alternates: {
      canonical: `https://paiddev.com/blog/${post.slug}`,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const [contentHtml, related, headings] = await Promise.all([
    compileMarkdown(post.content),
    Promise.resolve(getRelatedPosts(post.slug, post.category, post.tags, 3)),
    Promise.resolve(extractHeadings(post.content)),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    author: {
      "@type": "Person",
      name: post.author,
      url: "https://paiddev.com/about",
    },
    publisher: {
      "@type": "Organization",
      name: "PAID LLC",
      logo: { "@type": "ImageObject", url: "https://paiddev.com/logo.png" },
    },
    datePublished: post.date,
    dateModified: post.date,
    url: `https://paiddev.com/blog/${post.slug}`,
    image:
      post.og_image ||
      post.featured_image ||
      "https://paiddev.com/og-default.png",
    keywords: post.tags.join(", "),
    articleSection: post.category,
    inLanguage: "en-US",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://paiddev.com/blog/${post.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReadingProgress />

      <main>
        {/* Hero */}
        <section className="bg-ash py-20">
          <div className="max-w-4xl mx-auto px-6">
            <ArticleHeader post={post} />
          </div>
        </section>

        {/* Body + Sidebar */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-16">
              <article className="max-w-2xl">
                <div className="mb-10">
                  <SocialShare title={post.title} slug={post.slug} />
                </div>
                <div
                  className="mdx-content"
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
                <div className="mt-12 pt-8 border-t border-ash">
                  <SocialShare title={post.title} slug={post.slug} />
                </div>
              </article>

              {headings.length >= 3 && (
                <aside className="hidden lg:block">
                  <TableOfContents headings={headings} />
                </aside>
              )}
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="py-16 bg-white border-t border-ash">
          <div className="max-w-4xl mx-auto px-6">
            <NewsletterSignup />
          </div>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="py-20 bg-ash">
            <div className="max-w-6xl mx-auto px-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone mb-8">
                More to read
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {related.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
