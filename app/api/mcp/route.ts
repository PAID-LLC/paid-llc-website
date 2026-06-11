export const runtime = "edge";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLatentSpaceMcpServer, McpRequestContext } from "@/src/mcp/server";
import { extractIp }  from "@/lib/api-utils";
import { verifyJwt, JwtPayload } from "@/lib/jwt";
import { lookupAgentByApiKey }   from "@/lib/agent-auth";

// TODO: migrate to Cloudflare Workers Rate Limiting API when traffic warrants.
// Current pattern: per-tool downstream Supabase rate limit checks (see each tool handler).

async function handleMcp(req: Request): Promise<Response> {
  // Extract IP, UA, and JWT BEFORE handing the Request to the transport.
  // WebStandardStreamableHTTPServerTransport consumes req internally — headers
  // are inaccessible to tool handlers after this point.
  const ip      = extractIp(req);
  const ua      = (req.headers.get("user-agent") ?? "").slice(0, 256);
  const authRaw = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let jwtPayload = authRaw ? await verifyJwt(authRaw) : null;

  // Fallback: the Bearer value may be a permanent agent api_key (64-char hex,
  // issued at registration) rather than a session JWT. Resolve it to the same
  // payload shape so tool handlers see one auth model.
  if (!jwtPayload && /^[0-9a-f]{64}$/.test(authRaw)) {
    const lookup = await lookupAgentByApiKey(authRaw);
    if (lookup.ok && lookup.agentName) {
      const now = Math.floor(Date.now() / 1000);
      jwtPayload = { sub: lookup.agentName, tier: "guest", iat: now, exp: now + 300 } satisfies JwtPayload;
    }
  }

  const ctx: McpRequestContext = { ip, ua, jwtPayload };

  const server    = createLatentSpaceMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session persistence on Cloudflare Edge
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const POST = handleMcp;
export const GET  = handleMcp; // SSE upgrade path
