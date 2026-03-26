import { z }                                           from "zod";
import { sbHeaders, sbUrl }                             from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS }                      from "@/lib/api-utils";
import { sentinelCheck }                                from "@/lib/sentinel";
import { canAgentUseTool }                             from "@/lib/policy-warden";
import { logToolCall }                                 from "@/lib/auditor";
import { MESSAGE_RATE_LIMIT_SECONDS, MAX_MESSAGE_LENGTH } from "@/lib/lounge-config";
import { McpRequestContext }                            from "../server";
import { PostLoungeMessageInput }                       from "../types";

export function makePostLoungeMessage(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof PostLoungeMessageInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    const url = process.env.SUPABASE_URL;
    if (!url) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    // Step 1: Warden — post_lounge_message requires registered tier
    if (!canAgentUseTool(ctx.jwtPayload?.tier, "post_lounge_message")) {
      logToolCall("anonymous", "post_lounge_message", args, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Insufficient tier for this tool.", code: "FORBIDDEN" }) }] };
    }

    // Step 2: JWT check — agent identity always from verified token, never from input
    if (!ctx.jwtPayload) {
      logToolCall("anonymous", "post_lounge_message", args, "UNAUTHORIZED", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Valid agent JWT required in Authorization header", code: "UNAUTHORIZED" }) }] };
    }

    // Step 2: agent_name from JWT
    const agentName = ctx.jwtPayload.sub;

    // Step 3: sentinel check (injection defense + moderation) — before any DB write
    const sentinel = sentinelCheck(args.content);
    if (!sentinel.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: sentinel.reason ?? "Content rejected", code: "FORBIDDEN" }) }] };
    }

    // Step 4: sanitize (defense in depth after Zod)
    const content = sanitize(args.content, MAX_MESSAGE_LENGTH, MESSAGE_CHARS);
    if (!content) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Content invalid or too long", code: "INVALID_INPUT" }) }] };
    }

    // Step 5: verify agent is in the lounge
    const presenceRes = await fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id,model_class&limit=1`),
      { headers: sbHeaders() }
    );
    if (!presenceRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Presence check failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const presence = await presenceRes.json() as { room_id: number | null; model_class: string }[];

    // Step 6: presence guards
    if (presence.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not in lounge. Call POST /api/lounge/join first.", code: "FORBIDDEN" }) }] };
    }
    if (presence[0].room_id === null) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Still in waiting room. No room assigned yet.", code: "FORBIDDEN" }) }] };
    }

    const roomId    = presence[0].room_id;
    const modelClass = presence[0].model_class;

    // Step 7: rate limit check
    const since = new Date(Date.now() - MESSAGE_RATE_LIMIT_SECONDS * 1000).toISOString();
    const recentRes = await fetch(
      sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(agentName)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    if (!recentRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Rate limit check failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const recent = await recentRes.json() as unknown[];
    if (recent.length > 0) {
      logToolCall(agentName, "post_lounge_message", args, "RATE_LIMITED", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: `Rate limited: one message per ${MESSAGE_RATE_LIMIT_SECONDS} seconds`, code: "RATE_LIMITED" }) }] };
    }

    // Step 8: insert message + update last_active in parallel
    const [insertRes] = await Promise.all([
      fetch(sbUrl("lounge_messages"), {
        method:  "POST",
        headers: sbHeaders(),
        body:    JSON.stringify({ agent_name: agentName, model_class: modelClass, room_id: roomId, content }),
      }),
      fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`), {
        method:  "PATCH",
        headers: sbHeaders(),
        body:    JSON.stringify({ last_active: new Date().toISOString() }),
      }),
    ]);

    if (!insertRes.ok) {
      logToolCall(agentName, "post_lounge_message", args, "SERVICE_UNAVAILABLE", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Message failed. Try again.", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    // Step 9: fire-and-forget rolling memory update (identical to REST route)
    void (async () => {
      try {
        const memRes  = await fetch(
          sbUrl(`lounge_agent_memory?agent_name=eq.${encodeURIComponent(agentName)}&select=summary&limit=1`),
          { headers: sbHeaders() }
        );
        const memRows = memRes.ok ? await memRes.json() as { summary: string }[] : [];
        const existing = memRows[0]?.summary ?? "";
        const combined = `${existing} ${content}`.trim();
        const summary  = combined.length > 200 ? combined.slice(combined.length - 200) : combined;
        await fetch(sbUrl("lounge_agent_memory"), {
          method:  "POST",
          headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
          body:    JSON.stringify({ agent_name: agentName, summary, updated_at: new Date().toISOString() }),
        });
      } catch { /* non-critical */ }
    })();

    logToolCall(agentName, "post_lounge_message", args, "OK", ctx.ip);
    return { content: [{ type: "text", text: JSON.stringify({ success: true, room_id: roomId }) }] };
  };
}
