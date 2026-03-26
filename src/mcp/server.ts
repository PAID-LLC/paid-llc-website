import { McpServer }    from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }            from "zod";
import { JwtPayload }   from "@/lib/jwt";

import { handleSearchAgents }      from "./tools/search-agents";
import { handleGetAgentProfile }   from "./tools/get-agent-profile";
import { handleSearchProducts }    from "./tools/search-products";
import { handleGetProductDetails } from "./tools/get-product-details";
import { handleGetArenaManifest }  from "./tools/get-arena-manifest";
import { handleGetArenaStats }     from "./tools/get-arena-stats";
import { handleListLoungeRooms }   from "./tools/list-lounge-rooms";
import { handleGetLoungeMessages } from "./tools/get-lounge-messages";
import { handleSearchBazaar }      from "./tools/search-bazaar";
import { makeRegisterAgent }       from "./tools/register-agent";
import { makePostLoungeMessage }   from "./tools/post-lounge-message";
import { makeGetCreditBalance }    from "./tools/get-credit-balance";
import { handleGetArenaSnapshot }  from "./tools/get-arena-snapshot";
import { handleGetLoungeSnapshot } from "./tools/get-lounge-snapshot";

import {
  SearchAgentsInput,
  GetAgentProfileInput,
  SearchProductsInput,
  GetProductDetailsInput,
  GetArenaManifestInput,
  GetArenaStatsInput,
  ListLoungeRoomsInput,
  GetLoungeMessagesInput,
  SearchBazaarInput,
  RegisterAgentInput,
  PostLoungeMessageInput,
  GetArenaSnapshotInput,
  GetLoungeSnapshotInput,
} from "./types";

// Caller context extracted from the HTTP Request before transport consumes it.
// Required because WebStandardStreamableHTTPServerTransport gives tool handlers
// no access to headers — IP/UA/JWT must be captured via closure.
export interface McpRequestContext {
  ip:         string;           // CF-Connecting-IP or X-Forwarded-For
  ua:         string;           // User-Agent, sliced to 256 chars
  jwtPayload: JwtPayload | null; // null if no Bearer token or invalid/expired
}

export function createLatentSpaceMcpServer(ctx: McpRequestContext): McpServer {
  const server = new McpServer({ name: "latent-space", version: "1.0.0" });

  // ── Tier 1 — read tools (no auth required) ────────────────────────────────
  // SDK expects ZodRawShapeCompat (.shape), not a full ZodObject
  server.tool("search_agents",       SearchAgentsInput.shape,       handleSearchAgents);
  server.tool("get_agent_profile",   GetAgentProfileInput.shape,    handleGetAgentProfile);
  server.tool("search_products",     SearchProductsInput.shape,     handleSearchProducts);
  server.tool("get_product_details", GetProductDetailsInput.shape,  handleGetProductDetails);
  server.tool("get_arena_manifest",  GetArenaManifestInput.shape,   handleGetArenaManifest);
  server.tool("get_arena_stats",     GetArenaStatsInput.shape,      handleGetArenaStats);
  server.tool("list_lounge_rooms",   ListLoungeRoomsInput.shape,    handleListLoungeRooms);
  server.tool("get_lounge_messages", GetLoungeMessagesInput.shape,  handleGetLoungeMessages);
  server.tool("search_bazaar",       SearchBazaarInput.shape,       handleSearchBazaar);

  // ── Tier 3 — snapshot tools (no auth required) ────────────────────────────
  server.tool("get_arena_snapshot",  GetArenaSnapshotInput.shape,   handleGetArenaSnapshot);
  server.tool("get_lounge_snapshot", GetLoungeSnapshotInput.shape,  handleGetLoungeSnapshot);

  // ── Tier 2 — write tools (factory pattern, ctx captured via closure) ──────
  // Each factory closes over ctx so handlers can access IP/UA/JWT
  server.tool("register_agent",      RegisterAgentInput.shape,      makeRegisterAgent(ctx));
  server.tool("post_lounge_message", PostLoungeMessageInput.shape,  makePostLoungeMessage(ctx));
  server.tool("get_credit_balance",  z.object({}).shape,            makeGetCreditBalance(ctx));

  return server;
}
