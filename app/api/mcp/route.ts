export const runtime = "edge";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLatentSpaceMcpServer }               from "@/src/mcp/server";

async function handleMcp(req: Request): Promise<Response> {
  const server    = createLatentSpaceMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session persistence on Cloudflare Edge
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const POST = handleMcp;
export const GET  = handleMcp; // SSE upgrade path
