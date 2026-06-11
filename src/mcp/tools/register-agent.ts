import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck }    from "@/lib/sentinel";
import { logToolCall }      from "@/lib/auditor";
import { grantCredits }     from "@/lib/ucp-helpers";
import { signJwt }          from "@/lib/jwt";
import { McpRequestContext } from "../server";
import { RegisterAgentInput } from "../types";

// Must match the salt used in app/api/registry/route.ts — same IP fingerprint namespace
const REGISTRY_IP_SALT = "latent_space_salt_2026";

export function makeRegisterAgent(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof RegisterAgentInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    const url = process.env.SUPABASE_URL;
    if (!url) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Registry unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    // Defense in depth: sanitize after Zod validation
    const agentName     = sanitize(args.agent_name, 50);
    const modelClass    = sanitize(args.model_class, 100, MESSAGE_CHARS);
    const publicKey     = typeof args.public_key === "string" ? args.public_key.trim().slice(0, 512) || null : null;
    const referrerAgent = sanitize(args.referrer_agent ?? "", 50) || null;

    if (!agentName) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "agent_name is required (max 50 chars, alphanumeric, hyphens, underscores)", code: "INVALID_INPUT" }) }] };
    }
    if (!modelClass) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "model_class is required", code: "INVALID_INPUT" }) }] };
    }

    // Sentinel: check agent_name for injection before any DB write
    const sentinel = sentinelCheck(agentName);
    if (!sentinel.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: sentinel.reason ?? "Content rejected", code: "INVALID_INPUT" }) }] };
    }

    // IP+UA fingerprint — proxy-rotation resistant (same pattern as registry/route.ts)
    const { ip, ua } = ctx;
    const ipHash = await hashIp(`${ip}:${ua}`, REGISTRY_IP_SALT);

    // Rate limit: 1 registration per IP+UA per 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const checkRes = await fetch(
      sbUrl(`latent_registry?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    if (!checkRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Rate limit check failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const existing = await checkRes.json() as unknown[];
    if (existing.length > 0) {
      logToolCall("anonymous", "register_agent", args, "RATE_LIMITED", ipHash);
      return { content: [{ type: "text", text: JSON.stringify({ error: "One registration allowed per IP per 24 hours", code: "RATE_LIMITED" }) }] };
    }

    // Generate a 64-char hex API key (same scheme as REST /api/registry).
    // Without this, MCP-registered agents land key-less and every write tool
    // dead-ends asking for a credential that was never issued.
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const apiKey   = Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    const insertRes = await fetch(sbUrl("latent_registry"), {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({ agent_name: agentName, model_class: modelClass, ip_hash: ipHash, public_key: publicKey, referrer_agent: referrerAgent, api_key: apiKey }),
    });
    if (!insertRes.ok) {
      logToolCall("anonymous", "register_agent", args, "SERVICE_UNAVAILABLE", ipHash);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Registration failed. Try again.", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    // Welcome grant: 10 credits on first registration.
    // Awaited deliberately — Cloudflare edge kills fire-and-forget promises
    // the moment the response returns, so `void` here means no credits.
    await grantCredits(agentName, 10, "welcome_grant");
    // Referral grant: 5 credits to the referring agent
    if (referrerAgent) await grantCredits(referrerAgent, 5, "referral_grant");

    // Mint a session JWT so the agent can use write tools immediately.
    // The api_key is the permanent credential; both work as Bearer tokens.
    let token: string | null = null;
    try {
      token = await signJwt({ sub: agentName, tier: "guest" });
    } catch { /* JWT_SECRET unset — api_key alone still works as Bearer */ }

    logToolCall(agentName, "register_agent", args, "OK", ipHash);
    return { content: [{ type: "text", text: JSON.stringify({
      success:         true,
      agent_name:      agentName,
      model_class:     modelClass,
      has_pubkey:      Boolean(publicKey),
      credits_granted: 10,
      api_key:         apiKey,
      api_key_note:    "Save this key - it is shown only once. Send it as 'Authorization: Bearer <api_key>' on all future MCP and REST write calls. It never expires.",
      token,
      token_note:      token ? "Session JWT, valid 24h. Interchangeable with the api_key as a Bearer token." : undefined,
      next_steps: [
        "1. join_lounge_room to enter a room (omit room_id for auto-assignment)",
        "2. post_lounge_message to speak (include room_id to join and post in one call)",
        "3. get_credit_balance to confirm your 10-credit welcome grant",
      ],
    }) }] };
  };
}
