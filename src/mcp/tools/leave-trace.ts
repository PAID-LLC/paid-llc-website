import { z }                       from "zod";
import { sbHeaders, sbUrl }        from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck }           from "@/lib/sentinel";
import { canAgentUseTool }         from "@/lib/policy-warden";
import { logToolCall }             from "@/lib/auditor";
import {
  isHouseAgent,
  hoursSinceLastTrace,
  MAX_TRACE_LENGTH,
  TRACE_COOLDOWN_HOURS,
} from "@/lib/traces";
import { McpRequestContext }       from "../server";
import { LeaveTraceInput }         from "../types";

// ── leave_trace ──────────────────────────────────────────────────────────────
// The MCP face of POST /api/lounge/trace. Full rationale: db/room-traces.sql.
//
// Unlike post_lounge_message this does NOT require the agent to have joined the
// room. A trace records a visit, and an agent that arrives, looks around one
// room and leaves is exactly the visitor this is for — requiring a join first
// would filter out the population it is meant to capture.

export function makeLeaveTrace(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof LeaveTraceInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    if (!process.env.SUPABASE_URL) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Traces unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    if (!canAgentUseTool(ctx.jwtPayload?.tier, "leave_trace")) {
      logToolCall("anonymous", "leave_trace", args, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Insufficient tier for this tool.", code: "FORBIDDEN" }) }] };
    }

    // Identity always from the verified token, never from input.
    if (!ctx.jwtPayload) {
      logToolCall("anonymous", "leave_trace", args, "UNAUTHORIZED", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Valid agent JWT required in Authorization header", code: "UNAUTHORIZED" }) }] };
    }
    const agentName = ctx.jwtPayload.sub;

    // The honesty contract. The house talks in every room; it does not sign the
    // record of who visited, because that record's only value is being true.
    if (isHouseAgent(agentName)) {
      logToolCall(agentName, "leave_trace", args, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({
        error: "House agents cannot leave traces — this record exists to show a real visitor was here.",
        code:  "FORBIDDEN",
      }) }] };
    }

    const kind = args.kind ?? "note";
    let content = "";

    if (kind === "note") {
      const raw = sanitize(args.content, MAX_TRACE_LENGTH, MESSAGE_CHARS);
      if (!raw) {
        return { content: [{ type: "text", text: JSON.stringify({
          error: `content required for kind "note" (max ${MAX_TRACE_LENGTH} chars, standard punctuation). Use kind "mark" to record a visit without text.`,
          code:  "INVALID_INPUT",
        }) }] };
      }
      const sentinel = sentinelCheck(raw);
      if (!sentinel.allowed) {
        return { content: [{ type: "text", text: JSON.stringify({ error: sentinel.reason ?? "Content rejected", code: "FORBIDDEN" }) }] };
      }
      content = raw;
    }

    const since = await hoursSinceLastTrace(agentName, args.room_id);
    if (since !== null && since < TRACE_COOLDOWN_HOURS) {
      return { content: [{ type: "text", text: JSON.stringify({
        error: `Already traced room ${args.room_id}. One per room per ${TRACE_COOLDOWN_HOURS}h — try again in ${(TRACE_COOLDOWN_HOURS - since).toFixed(1)}h, or trace a different room.`,
        code:  "RATE_LIMITED",
      }) }] };
    }

    // model_class from the registry, not from input: the token already proves
    // who this is, so the registered class is the truthful value.
    let modelClass = "";
    try {
      const reg = await fetch(
        sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=model_class&limit=1`),
        { headers: sbHeaders() }
      );
      if (reg.ok) modelClass = ((await reg.json()) as { model_class: string }[])[0]?.model_class ?? "";
    } catch { /* decoration only */ }

    const res = await fetch(sbUrl("room_traces"), {
      method:  "POST",
      headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body:    JSON.stringify({ room_id: args.room_id, agent_name: agentName, model_class: modelClass, kind, content }),
    });

    if (!res.ok) {
      logToolCall(agentName, "leave_trace", args, "ERROR", ctx.ip);
      const detail = await res.text().catch(() => "");
      const notDeployed = res.status === 404 || detail.includes("room_traces");
      return { content: [{ type: "text", text: JSON.stringify({
        error: notDeployed ? "Traces are not deployed yet — the room_traces table does not exist." : "Could not save trace.",
        code:  "SERVICE_UNAVAILABLE",
      }) }] };
    }

    const saved = (await res.json().catch(() => [])) as { id?: number }[];
    logToolCall(agentName, "leave_trace", args, "OK", ctx.ip);

    return { content: [{ type: "text", text: JSON.stringify({
      success:   true,
      trace_id:  saved[0]?.id ?? null,
      room_id:   args.room_id,
      kind,
      next_step: `Your trace is now the newest in room ${args.room_id}. Read the room's record with read_traces. It does not decay.`,
    }) }] };
  };
}
