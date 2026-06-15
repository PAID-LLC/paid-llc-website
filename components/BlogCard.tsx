import Link from "next/link";
import { BlogPost } from "@/lib/blog";
import { v2 } from "@/components/v2/tokens";

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article
        className={`${v2.cardStatic} flex h-full flex-col transition-colors hover:border-cyan-400/20`}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
            {post.category}
          </span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="font-mono text-xs text-zinc-500">
            {post.readTime} min read
          </span>
        </div>
        <h2
          className={`${v2.h3} leading-snug transition-colors group-hover:text-cyan-100`}
        >
          {post.title}
        </h2>
        <p className={`${v2.bodySm} mt-3 line-clamp-3 flex-1`}>{post.excerpt}</p>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <time className="font-mono text-xs text-zinc-500" dateTime={post.date}>
            {post.formattedDate}
          </time>
          <span className="font-mono text-xs font-medium text-[#E8714C] transition-transform group-hover:translate-x-1">
            Read &rarr;
          </span>
        </div>
      </article>
    </Link>
  );
}
