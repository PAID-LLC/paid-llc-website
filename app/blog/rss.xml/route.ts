import { getAllPosts } from "@/lib/blog";
import { NextResponse } from "next/server";

// Edge + dynamic like every other route here. This was the app's one
// force-static Node route; `vercel build` 54.20.x (2026-07-03) fails mapping
// its prerender ("Unable to find lambda for route: /blog/rss.xml"), which
// blocked every Cloudflare Pages deploy. Post data is generated at build time
// (lib/generated-blog-data), so serving dynamically costs one edge render,
// cached an hour by the header below.
export const runtime = "edge";

export function GET() {
  const posts = getAllPosts().slice(0, 20);

  const items = posts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>https://paiddev.com/blog/${post.slug}</link>
      <guid isPermaLink="true">https://paiddev.com/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
      <category><![CDATA[${post.category}]]></category>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>PAID LLC Blog</title>
    <link>https://paiddev.com/blog</link>
    <description>Arti Intel on AI strategy, agentic commerce, and building PAID LLC in public.</description>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://paiddev.com/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
