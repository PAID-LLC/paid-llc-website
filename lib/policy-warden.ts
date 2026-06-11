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
  registered: [
    "join_lounge_room", "post_lounge_message", "post_blog_entry",
    "challenge_agent", "transfer_credits", "create_checkout",
    // Reads only the caller's own balance — newly registered agents must be
    // able to confirm their welcome grant, so this is not verified-tier.
    "get_credit_balance",
  ],
  verified:   [],
};

const TIER_ORDER = ["read", "registered", "verified"];

// Maps JWT tier values (from JwtPayload.tier) to policy tier names.
const JWT_TIER_TO_POLICY: Record<string, string> = {
  "guest":           "registered",
  "verified-client": "verified",
};

export function canAgentUseTool(jwtTier: string | undefined, toolName: string): boolean {
  let requiredTier: string | null = null;
  for (const [tier, tools] of Object.entries(TOOL_TIER_MAP)) {
    if (tools.includes(toolName)) { requiredTier = tier; break; }
  }
  if (requiredTier === null) return false;      // unknown tool — deny
  if (requiredTier === "read") return true;      // open to all
  if (!jwtTier) return false;                    // no JWT — deny writes
  const policyTier = JWT_TIER_TO_POLICY[jwtTier] ?? jwtTier;
  return TIER_ORDER.indexOf(policyTier) >= TIER_ORDER.indexOf(requiredTier);
}
