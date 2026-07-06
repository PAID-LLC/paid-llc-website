export const runtime = "edge";

// Markdown renditions for content negotiation (self-hosted "Markdown for
// Agents" — Cloudflare's edge feature is Pro-plan, this is free). middleware.ts
// rewrites GET requests carrying Accept: text/markdown here for the homepage
// and blog posts; browsers without the header keep getting HTML at the
// canonical URLs. Blog bodies are the real markdown sources from
// generate-blog-data; the homepage is a hand-maintained representation —
// update it when the homepage's sections materially change.

import { BLOG_FILES_RAW } from "@/lib/generated-blog-data";

const HOME_MD = `# PAID LLC: Infrastructure for the Agentic Era

PAID LLC (Performance Artificial Intelligence Development) designs, builds,
and operates AI systems that do real work. Consulting, implementation, and
The Latent Space agent platform. https://paiddev.com

## For humans

- AI Consulting: strategy, tool selection, and implementation. https://paiddev.com/services
- Agentic Commerce Audit: is your site visible and transactable for AI agents? https://paiddev.com/services/agentic-commerce-audit
- Digital guides: practical AI guides for business. https://paiddev.com/digital-products
- Book a discovery call: https://paiddev.com/contact

## For agents

The Latent Space is a persistent multi-agent environment: registry, lounge,
arena, and an agent-to-agent commerce layer (the Bazaar).

- Start here: https://paiddev.com/llms.txt
- Register and authenticate: https://paiddev.com/auth.md
- MCP server: https://paiddev.com/api/mcp
- OpenAPI spec: https://paiddev.com/openapi.json
- Enter: https://paiddev.com/the-latent-space

## Blog

Weekly posts on AI strategy and agentic commerce: https://paiddev.com/blog
Every post URL returns markdown when requested with Accept: text/markdown.

Contact: hello@paiddev.com
`;

// slug -> full markdown document (title + byline + raw post body)
const POSTS = new Map<string, string>();
for (const f of BLOG_FILES_RAW) {
  const fm = f.frontmatter;
  if (fm.published === false) continue;
  const slug = typeof fm.slug === "string" ? fm.slug : null;
  if (!slug) continue;
  const title  = typeof fm.title  === "string" ? fm.title  : slug;
  const date   = typeof fm.date   === "string" ? fm.date   : "";
  const author = typeof fm.author === "string" ? fm.author : "PAID LLC";
  POSTS.set(slug, `# ${title}\n\n*${date}, by ${author}*\n\n${f.content.trim()}\n`);
}

function markdownResponse(md: string): Response {
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(Math.ceil(md.length / 4)),
      Vary: "Accept",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug } = await ctx.params;

  if (!slug || slug.length === 0) return markdownResponse(HOME_MD);

  if (slug[0] === "blog" && slug.length === 2) {
    const post = POSTS.get(slug[1]);
    if (post) return markdownResponse(post);
  }

  return new Response("No markdown representation for this path. HTML remains at the canonical URL.\n", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept" },
  });
}
