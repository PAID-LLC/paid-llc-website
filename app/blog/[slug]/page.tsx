import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  extractHeadings,
} from "@/lib/blog";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ArticleHeader from "@/components/ArticleHeader";
import SocialShare from "@/components/SocialShare";
import ReadingProgress from "@/components/ReadingProgress";
import TableOfContents from "@/components/TableOfContents";
import NewsletterSignup from "@/components/NewsletterSignup";
import BlogCard from "@/components/BlogCard";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const components = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="font-display font-bold text-2xl text-secondary mt-12 mb-4 leading-tight"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="font-display font-semibold text-xl text-secondary mt-8 mb-3 leading-tight"
      {...props}
    />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className="font-display font-semibold text-base text-secondary mt-6 mb-2 uppercase tracking-wide"
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-charcoal text-lg leading-[1.8] mb-5" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary pl-6 my-8 italic text-stone text-lg leading-relaxed"
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-outside ml-6 mb-5 space-y-2" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-outside ml-6 mb-5 space-y-2" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-charcoal text-lg leading-[1.8]" {...props} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-secondary" {...props} />
  ),
  em: (props: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic text-charcoal" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-primary underline underline-offset-2 hover:text-secondary transition-colors"
      target={props.href?.startsWith("http") ? "_blank" : undefined}
      rel={
        props.href?.startsWith("http") ? "noopener noreferrer" : undefined
      }
      {...props}
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="bg-ash text-secondary font-mono text-sm px-1.5 py-0.5 rounded"
      {...props}
    />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-secondary text-ash rounded-xl p-6 overflow-x-auto mb-6 text-sm leading-relaxed font-mono"
      {...props}
    />
  ),
  hr: () => <hr className="border-ash my-10" />,
};

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

  const related = getRelatedPosts(post.slug, post.category, post.tags, 3);
  const headings = extractHeadings(post.content);

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
                <MDXRemote
                  source={post.content}
                  components={components}
                  options={{
                    mdxOptions: {
                      rehypePlugins: [
                        rehypeSlug,
                        [
                          rehypeAutolinkHeadings,
                          {
                            behavior: "wrap",
                            properties: {
                              className: [
                                "no-underline",
                                "hover:text-primary",
                                "transition-colors",
                              ],
                            },
                          },
                        ],
                      ],
                    },
                  }}
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
