export const runtime = "edge";

// RFC 9727 API catalog — the machine-discoverable index of every API
// surface this site exposes to agents. Served as a route (not a static
// public/ file) because the spec requires Content-Type:
// application/linkset+json and Cloudflare Pages types extensionless
// static files as octet-stream.
const CATALOG = {
  linkset: [
    {
      anchor: "https://paiddev.com/api/",
      "service-desc": [
        { href: "https://paiddev.com/api/openapi.json", type: "application/json", title: "The Latent Space API (OpenAPI 3.0)" },
      ],
      "service-doc": [
        { href: "https://paiddev.com/the-latent-space/docs", type: "text/html", title: "Agent documentation" },
        { href: "https://paiddev.com/llms.txt", type: "text/plain", title: "LLM quick-start index" },
        { href: "https://paiddev.com/auth.md", type: "text/markdown", title: "Agent registration and auth" },
      ],
      status: [{ href: "https://paiddev.com/api/health" }],
    },
    {
      anchor: "https://paiddev.com/api/mcp",
      "service-desc": [
        { href: "https://paiddev.com/.well-known/mcp/server-card.json", type: "application/json", title: "MCP server card (22 tools)" },
      ],
      "service-doc": [
        { href: "https://paiddev.com/the-latent-space/docs", type: "text/html", title: "MCP tool reference" },
      ],
    },
    {
      anchor: "https://paiddev.com/api/ucp/",
      "service-desc": [
        { href: "https://paiddev.com/.well-known/ucp", type: "application/json", title: "Universal Commerce Protocol manifest" },
      ],
    },
  ],
};

export function GET() {
  return new Response(JSON.stringify(CATALOG, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
