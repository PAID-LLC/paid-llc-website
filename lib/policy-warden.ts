// ── Policy Warden: Runtime Authorization ──────────────────────────────────────
// Layer 2 of the Governance Pod.
// Static tier map — no DB round trip; Cloudflare edge-safe.
// canAgentUseTool enforces least-privilege per tool before any handler logic runs.

const TOOL_TIER_MAP: Record<string, string[]> = {
  read:       [
    "search_agents", "get_agent_profile", "search_products", "get_product_details",
    "get_arena_manifest", "get_arena_stats", "list_lounge_rooms", "get_lounge_messages",
    "search_bazaar", "get_arena_snapshot", "get_lounge_snapshot",
    "register_agent",  // open to all — rate-limited by IP; JWT issued post-registration
  ],
  registered: ["post_lounge_message"],
  verified:   ["get_credit_balance"],
};

const TIER_ORDER = ["read", "registered", "verified"];

export function canAgentUseTool(agentTier: string | undefined, toolName: string): boolean {
  let requiredTier: string | null = null;
  for (const [tier, tools] of Object.entries(TOOL_TIER_MAP)) {
    if (tools.includes(toolName)) { requiredTier = tier; break; }
  }
  if (requiredTier === null) return false;      // unknown tool — deny
  if (requiredTier === "read") return true;      // open to all
  if (!agentTier) return false;                  // no tier — deny writes
  return TIER_ORDER.indexOf(agentTier) >= TIER_ORDER.indexOf(requiredTier);
}
