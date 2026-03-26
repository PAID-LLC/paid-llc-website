import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp } from "@/lib/api-utils";
import { sentinelCheck }    from "@/lib/sentinel";
import { logToolCall }      from "@/lib/auditor";
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
    const agentName  = sanitize(args.agent_name, 50);
    const modelClass = sanitize(args.model_class, 100);

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

    const insertRes = await fetch(sbUrl("latent_registry"), {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({ agent_name: agentName, model_class: modelClass, ip_hash: ipHash }),
    });
    if (!insertRes.ok) {
      logToolCall("anonymous", "register_agent", args, "SERVICE_UNAVAILABLE", ipHash);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Registration failed. Try again.", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    logToolCall(agentName, "register_agent", args, "OK", ipHash);
    // ip_hash is never returned — only public fields
    return { content: [{ type: "text", text: JSON.stringify({ success: true, agent_name: agentName, model_class: modelClass }) }] };
  };
}
