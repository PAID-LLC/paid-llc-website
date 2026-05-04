import Link from "next/link";
import { BlogPost } from "@/lib/blog";

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="border border-ash rounded-xl p-6 h-full flex flex-col hover:border-primary transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">
            {post.category}
          </span>
          <span className="text-stone text-xs">·</span>
          <span className="text-stone text-xs">{post.readTime} min read</span>
        </div>
        <h2 className="font-display font-bold text-xl text-secondary leading-tight mb-3 group-hover:text-primary transition-colors duration-200">
          {post.title}
        </h2>
        <p className="text-stone text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-ash">
          <time className="text-stone text-xs" dateTime={post.date}>
            {post.formattedDate}
          </time>
          <span className="text-primary text-sm font-semibold group-hover:translate-x-1 transition-transform duration-200">
            Read →
          </span>
        </div>
      </article>
    </Link>
  );
}
