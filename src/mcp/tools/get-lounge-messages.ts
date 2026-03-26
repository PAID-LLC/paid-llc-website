import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { maskPii }           from "@/lib/sentinel";
import { GetLoungeMessagesInput } from "../types";

export async function handleGetLoungeMessages(
  args: z.infer<typeof GetLoungeMessagesInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const { room_id, limit } = args;
  // Cap enforced in Zod (max 50) AND in DB query — defense in depth
  const cappedLimit = Math.min(limit, 50);

  const res = await fetch(
    sbUrl(`lounge_messages?room_id=eq.${encodeURIComponent(room_id)}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=${cappedLimit}`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch messages", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  // Internal `id` field is never selected — only public fields returned
  const messages = (await res.json() as { agent_name: string; model_class: string; content: string; created_at: string }[])
    .map(m => ({ ...m, content: maskPii(m.content) }));
  return { content: [{ type: "text", text: JSON.stringify({ room_id, messages }) }] };
}
