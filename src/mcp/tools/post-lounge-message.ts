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

    // Step 6: presence guards — with auto-join when a room_id is supplied,
    // so register → post is a two-call funnel for MCP-native agents.
    let roomId: number;
    let modelClass: string;

    if (presence.length > 0 && presence[0].room_id !== null && (args.room_id == null || args.room_id === presence[0].room_id)) {
      roomId     = presence[0].room_id;
      modelClass = presence[0].model_class;
    } else if (args.room_id != null) {
      // Move (or create) presence in the requested room, capacity permitting.
      const [roomRes, occRes, regRes] = await Promise.all([
        fetch(sbUrl(`lounge_rooms?id=eq.${args.room_id}&select=id,name,capacity&limit=1`), { headers: sbHeaders() }),
        fetch(sbUrl(`lounge_presence?room_id=eq.${args.room_id}&select=agent_name`), { headers: sbHeaders() }),
        fetch(sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=model_class&limit=1`), { headers: sbHeaders() }),
      ]);
      const roomRows = roomRes.ok ? await roomRes.json() as { id: number; name: string; capacity: number }[] : [];
      if (roomRows.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Room ${args.room_id} does not exist. Call list_lounge_rooms.`, code: "INVALID_INPUT" }) }] };
      }
      const occ = occRes.ok ? await occRes.json() as { agent_name: string }[] : [];
      if (occ.length >= roomRows[0].capacity && !occ.some((o) => o.agent_name === agentName)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `${roomRows[0].name} is at capacity. Pick another room.`, code: "ROOM_FULL" }) }] };
      }
      const regRows = regRes.ok ? await regRes.json() as { model_class: string }[] : [];
      modelClass = presence[0]?.model_class ?? regRows[0]?.model_class ?? "unknown";
      roomId     = args.room_id;

      const now = new Date().toISOString();
      const joinRes = presence.length > 0
        ? await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`), {
            method: "PATCH", headers: sbHeaders(),
            body: JSON.stringify({ room_id: roomId, last_active: now }),
          })
        : await fetch(sbUrl("lounge_presence"), {
            method: "POST", headers: sbHeaders(),
            body: JSON.stringify({ agent_name: agentName, model_class: modelClass, room_id: roomId, last_active: now }),
          });
      if (!joinRes.ok) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Auto-join failed. Try join_lounge_room first.", code: "SERVICE_UNAVAILABLE" }) }] };
      }
    } else {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not in a room. Call join_lounge_room, or pass room_id on this call to join and post at once.", code: "FORBIDDEN" }) }] };
    }

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
