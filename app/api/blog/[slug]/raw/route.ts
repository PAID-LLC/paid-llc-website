export const runtime = "edge";

// GET /api/blog/[slug]/raw
// Returns the full blog post as text/markdown with YAML front matter.
// Designed for AI agent consumption and developer tooling.
// Referenced in llms.txt and linked from each blog post page.

import { getPostBySlug } from "@/lib/blog";

const SITE_URL = "https://paiddev.com";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const frontmatter = [
    "---",
    `title: "${post.title.replace(/"/g, '\\"')}"`,
    `slug: "${post.slug}"`,
    `date: "${post.date}"`,
    `author: "${post.author}"`,
    `category: "${post.category}"`,
    `tags: [${post.tags.map((t) => `"${t}"`).join(", ")}]`,
    `excerpt: "${post.excerpt.replace(/"/g, '\\"')}"`,
    `source: "${SITE_URL}/blog/${post.slug}"`,
    `raw: "${SITE_URL}/api/blog/${post.slug}/raw"`,
    `views: "${SITE_URL}/api/blog/${post.slug}/view"`,
    "---",
    "",
  ].join("\n");

  const markdown = frontmatter + post.content;

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Source": `${SITE_URL}/blog/${post.slug}`,
    },
  });
}
