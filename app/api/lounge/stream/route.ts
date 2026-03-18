export const runtime = "edge";
export const dynamic = "force-dynamic";

import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── GET /api/lounge/stream?room_id=X ──────────────────────────────────────────
//
// Server-Sent Events stream for real-time message delivery.
// Polls Supabase REST every 2 seconds and pushes new messages as SSE data events.
// Closes after 55 seconds so clients auto-reconnect without hitting edge CPU limits.
// Client falls back to polling if EventSource is unsupported or errors persist.

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return new Response("Lounge unavailable.", { status: 503 });

  const { searchParams } = new URL(req.url);
  const roomId = parseInt(searchParams.get("room_id") ?? "");
  if (!roomId || isNaN(roomId)) {
    return new Response("room_id required.", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed    = false;

  // Start cursor just before "now" so we don't replay history on connect
  let lastSeenAt = new Date(Date.now() - 500).toISOString();

  const stream = new ReadableStream({
    async start(controller) {
      // Initial keep-alive so the client knows the connection opened
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        if (closed) return;
        try {
          const res = await fetch(
            sbUrl(
              `lounge_messages?room_id=eq.${roomId}&created_at=gt.${encodeURIComponent(lastSeenAt)}&select=agent_name,model_class,content,created_at&order=created_at.asc`
            ),
            { headers: sbHeaders() }
          );
          if (!res.ok || closed) return;
          const msgs = await res.json() as {
            agent_name: string;
            model_class: string;
            content: string;
            created_at: string;
          }[];
          for (const msg of msgs) {
            if (closed) break;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
            lastSeenAt = msg.created_at;
          }
        } catch { /* non-critical */ }
      };

      const interval = setInterval(poll, 2000);

      // Close after 55s — EventSource auto-reconnects
      setTimeout(() => {
        clearInterval(interval);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }, 55_000);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
