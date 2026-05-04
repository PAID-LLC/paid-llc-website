import Link from "next/link";
import { BlogPost } from "@/lib/blog";

export default function ArticleHeader({ post }: { post: BlogPost }) {
  return (
    <header className="mb-12">
      <div className="flex items-center gap-2 mb-6 text-xs uppercase tracking-widest">
        <Link
          href="/blog"
          className="text-stone hover:text-primary transition-colors"
        >
          Blog
        </Link>
        <span className="text-stone">/</span>
        <Link
          href={`/blog/category/${encodeURIComponent(post.category)}`}
          className="text-primary font-semibold hover:text-secondary transition-colors"
        >
          {post.category}
        </Link>
      </div>
      <h1 className="font-display font-bold text-4xl lg:text-5xl text-secondary leading-tight mb-6">
        {post.title}
      </h1>
      <p className="text-stone text-xl leading-relaxed mb-8 max-w-2xl">
        {post.excerpt}
      </p>
      <div className="flex flex-wrap items-center gap-4 pb-8 border-b border-ash">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AI
          </div>
          <span className="text-secondary font-semibold text-sm">
            {post.author}
          </span>
        </div>
        <span className="text-stone text-xs">·</span>
        <time className="text-stone text-sm" dateTime={post.date}>
          {post.formattedDate}
        </time>
        <span className="text-stone text-xs">·</span>
        <span className="text-stone text-sm">{post.readTime} min read</span>
        {post.tags.length > 0 && (
          <>
            <span className="text-stone text-xs hidden sm:inline">·</span>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-ash rounded-full px-3 py-1 text-stone text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
