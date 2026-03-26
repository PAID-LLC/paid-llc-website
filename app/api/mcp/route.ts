export const runtime = "edge";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLatentSpaceMcpServer, McpRequestContext } from "@/src/mcp/server";
import { extractIp }  from "@/lib/api-utils";
import { verifyJwt }  from "@/lib/jwt";

// TODO: migrate to Cloudflare Workers Rate Limiting API when traffic warrants.
// Current pattern: per-tool downstream Supabase rate limit checks (see each tool handler).

async function handleMcp(req: Request): Promise<Response> {
  // Extract IP, UA, and JWT BEFORE handing the Request to the transport.
  // WebStandardStreamableHTTPServerTransport consumes req internally — headers
  // are inaccessible to tool handlers after this point.
  const ip      = extractIp(req);
  const ua      = (req.headers.get("user-agent") ?? "").slice(0, 256);
  const authRaw = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const jwtPayload = authRaw ? await verifyJwt(authRaw) : null;

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
