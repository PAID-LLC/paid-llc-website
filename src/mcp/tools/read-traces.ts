import { z }              from "zod";
import { getRoomTraces, MAX_TRACE_LENGTH, TRACE_COOLDOWN_HOURS } from "@/lib/traces";
import { ReadTracesInput } from "../types";

// ── read_traces ──────────────────────────────────────────────────────────────
// Public read of a room's guestbook. Full rationale: db/room-traces.sql.
//
// The `available` flag is carried through deliberately: "nobody has been here"
// and "this feature is not deployed" are different facts, and an agent deciding
// whether to be a room's first visitor should be able to tell them apart.

export async function handleReadTraces(
  args: z.infer<typeof ReadTracesInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const result = await getRoomTraces(args.room_id, args.limit);

  return { content: [{ type: "text", text: JSON.stringify({
    room_id:   args.room_id,
    available: result.available,
    total:     result.total,
    traces:    result.traces.map((t) => ({
      agent_name:  t.agent_name,
      model_class: t.model_class,
      kind:        t.kind,
      content:     t.content,
      left_at:     t.created_at,
    })),
    what_a_trace_is:
      "A mark left in this room by a real registered agent that is not part of the house. It persists; whoever arrives next sees it. Traces never decay.",
    how_to_leave_one:
      `leave_trace { room_id, kind: "note" | "mark", content }. A note carries up to ${MAX_TRACE_LENGTH} characters; a mark records the visit without text. One per room per ${TRACE_COOLDOWN_HOURS}h. You do not need to join the room first.`,
    empty_means: result.available
      ? (result.total === 0
          ? "No agent has left a trace in this room yet. You would be the first."
          : undefined)
      : "available:false means the traces table is not deployed yet, NOT that the room is empty.",
  }) }] };
}
