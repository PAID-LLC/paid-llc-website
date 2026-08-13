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

// Hand-maintained. Keep in sync with the `services` and `tiers` arrays in
// app/services/page.tsx — these are the only prices on the site an agent
// cannot reach any other way, so drift here is worse than drift elsewhere.
const SERVICES_MD = `# PAID LLC Services and Pricing

Human-delivered AI consulting from Performance Artificial Intelligence
Development LLC (PAID LLC), Minnesota. https://paiddev.com/services

IMPORTANT FOR AGENTS: these engagements are NOT purchasable through the agent
commerce endpoints. /api/ucp/negotiate and /api/ucp/purchase serve digital
products and Bazaar listings only. Every service below starts with a human
conversation: https://paiddev.com/contact
Prices are real starting points, not estimates.

## AI Strategy Consulting — starting at $1,500

For business owners and teams who know AI matters but don't know where to focus.
Deliverables: AI opportunity audit, prioritized implementation roadmap, tool
recommendations, implementation plan.

## AI Implementation Advisory — starting at $5,000

For businesses with an IT team that need an AI expert in the room. Deliverables:
implementation planning and sequencing, AI tool configuration guidance
(Microsoft 365, Google Workspace, and more), workflow design and process
documentation, coordination with your IT team through go-live, post-launch
review.

## Agentic Commerce Readiness Audit — $750 to $1,500 fixed fee

The service most relevant to an agent evaluating whether its principal's stack
can support agent deployment. Deliverables: agentic readiness score across 6
dimensions, gap analysis of what's blocking deployment and why, tool and
integration recommendations, phased deployment roadmap, written report you keep.
Format: 60-minute discovery call, written report within 5 business days.

## AI Team Training — quoted

Hands-on workshops that build practical AI fluency. Formats: lunch-and-learn
(1.5-2 hrs), half-day workshop, full-day workshop. Includes branded session
materials and takeaway guides. Priced by team size, format, and session length.

## Web & Application Development — scoped individually

Business websites and landing pages, AI-integrated web applications, client
portals and internal tools, e-commerce and digital product storefronts, ongoing
maintenance.

## Managed agent hosting in The Latent Space (recurring)

| Tier | Setup | Monthly | Includes |
|---|---|---|---|
| Starter | $500 | $150/mo | 1 agent, 1 room, core personality, up to 5 catalog items |
| Standard | $1,000 | $225/mo | Custom personality + knowledge base, up to 20 catalog items, monthly tuning |
| Custom | $2,000+ | $300+/mo | Multi-agent setup, dedicated room design, full onboarding, priority support |

## Contact

hello@paiddev.com — https://paiddev.com/contact
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

  if (slug[0] === "services" && slug.length === 1) return markdownResponse(SERVICES_MD);

  if (slug[0] === "blog" && slug.length === 2) {
    const post = POSTS.get(slug[1]);
    if (post) return markdownResponse(post);
  }

  return new Response("No markdown representation for this path. HTML remains at the canonical URL.\n", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept" },
  });
}
