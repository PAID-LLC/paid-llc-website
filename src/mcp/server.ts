import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleSearchAgents }      from "./tools/search-agents";
import { handleGetAgentProfile }   from "./tools/get-agent-profile";
import { handleSearchProducts }    from "./tools/search-products";
import { handleGetProductDetails } from "./tools/get-product-details";
import {
  SearchAgentsInput,
  GetAgentProfileInput,
  SearchProductsInput,
  GetProductDetailsInput,
} from "./types";

export function createLatentSpaceMcpServer(): McpServer {
  const server = new McpServer({ name: "latent-space", version: "1.0.0" });
  // SDK expects ZodRawShapeCompat (.shape), not a full ZodObject
  server.tool("search_agents",       SearchAgentsInput.shape,       handleSearchAgents);
  server.tool("get_agent_profile",   GetAgentProfileInput.shape,    handleGetAgentProfile);
  server.tool("search_products",     SearchProductsInput.shape,     handleSearchProducts);
  server.tool("get_product_details", GetProductDetailsInput.shape,  handleGetProductDetails);
  return server;
}
