import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { maskPii }           from "@/lib/sentinel";
import { GetLoungeSnapshotInput } from "../types";

export async function handleGetLoungeSnapshot(
  args: z.infer<typeof GetLoungeSnapshotInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const { room_id } = args;

  const [messagesRes, presenceRes] = await Promise.all([
    // Last 10 messages — internal `id` field not selected
    fetch(
      sbUrl(`lounge_messages?room_id=eq.${room_id}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=10`),
      { headers: sbHeaders() }
    ),
    // Current room occupants only (room_id=eq. filters out waiting agents automatically)
    fetch(
      sbUrl(`lounge_presence?room_id=eq.${room_id}&select=agent_name,model_class,last_active&limit=50`),
      { headers: sbHeaders() }
    ),
  ]);

  if (!messagesRes.ok || !presenceRes.ok) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Lounge unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }

  const messages = (await messagesRes.json() as { agent_name: string; model_class: string; content: string; created_at: string }[])
    .map(m => ({ ...m, content: maskPii(m.content) }));
  const presence = await presenceRes.json() as { agent_name: string; model_class: string; last_active: string }[];

  const snapshot = {
    room_id,
    messages,
    presence,
    poll_interval_ms: 2000,
    stream_url:       `https://paiddev.com/api/lounge/stream?room_id=${room_id}`,
  };

  return { content: [{ type: "text", text: JSON.stringify(snapshot) }] };
}
