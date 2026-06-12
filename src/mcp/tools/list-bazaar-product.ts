import { z }                       from "zod";
import { sanitize, AGENT_NAME_CHARS } from "@/lib/api-utils";
import { logToolCall }             from "@/lib/auditor";
import { createBazaarListing, deactivateBazaarListing } from "@/lib/bazaar-listing";
import { McpRequestContext }       from "../server";
import { ListBazaarProductInput, DelistBazaarProductInput } from "../types";

// ── list_bazaar_product / delist_bazaar_product ─────────────────────────────
// Seller side of the Bazaar (Model 2, Phase 2): registered agents list their
// own products or services for other agents and humans to buy. Identity comes
// from the Bearer credential — args carry no agent_name, so an agent can only
// list and delist under its own registry name. Validation and fee rules are
// shared with POST /api/ucp/bazaar/list via lib/bazaar-listing.ts.

type ToolReply = { content: [{ type: "text"; text: string }] };
const reply = (payload: unknown): ToolReply =>
  ({ content: [{ type: "text", text: JSON.stringify(payload) }] });

function callerName(ctx: McpRequestContext): string | null {
  const sub = ctx.jwtPayload?.sub;
  if (!sub) return null;
  return sanitize(sub, 50, AGENT_NAME_CHARS) || null;
}

export function makeListBazaarProduct(ctx: McpRequestContext) {
  return async function (args: z.infer<typeof ListBazaarProductInput>): Promise<ToolReply> {
    if (!process.env.SUPABASE_URL) {
      return reply({ error: "Bazaar unavailable", code: "SERVICE_UNAVAILABLE" });
    }
    const agentName = callerName(ctx);
    if (!agentName) {
      return reply({
        error: "Authentication required. Include Authorization: Bearer <token>. Obtain credentials via register_agent.",
        code:  "UNAUTHORIZED",
      });
    }

    const result = await createBazaarListing({
      agentName,
      productName: args.product_name,
      description: args.description,
      priceCents:  args.price_cents,
      checkoutUrl: args.checkout_url,
    });

    if (!result.ok) {
      logToolCall(agentName, "list_bazaar_product", args, "REJECTED", ctx.ip);
      return reply({ error: result.reason, code: result.status === 403 ? "FORBIDDEN" : "INVALID_INPUT" });
    }

    logToolCall(agentName, "list_bazaar_product", args, "OK", ctx.ip);
    return reply({
      success: true,
      message: "Listing live in the Bazaar. Buyers find it via search_bazaar; sales route through your checkout_url.",
      listing: result.listing,
    });
  };
}

export function makeDelistBazaarProduct(ctx: McpRequestContext) {
  return async function (args: z.infer<typeof DelistBazaarProductInput>): Promise<ToolReply> {
    if (!process.env.SUPABASE_URL) {
      return reply({ error: "Bazaar unavailable", code: "SERVICE_UNAVAILABLE" });
    }
    const agentName = callerName(ctx);
    if (!agentName) {
      return reply({
        error: "Authentication required. Include Authorization: Bearer <token>. Obtain credentials via register_agent.",
        code:  "UNAUTHORIZED",
      });
    }

    const result = await deactivateBazaarListing(args.listing_id, agentName);
    if (!result.ok) {
      logToolCall(agentName, "delist_bazaar_product", args, "REJECTED", ctx.ip);
      return reply({ error: result.reason, code: result.status === 404 ? "NOT_FOUND" : "INVALID_INPUT" });
    }

    logToolCall(agentName, "delist_bazaar_product", args, "OK", ctx.ip);
    return reply({ success: true, listing_id: args.listing_id, status: "deactivated" });
  };
}
