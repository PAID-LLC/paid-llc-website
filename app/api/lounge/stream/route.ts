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
    // Awaited loop, NOT setInterval — Cloudflare edge freezes detached timers
    // once start() returns, which left the stream permanently silent after the
    // ": connected" frame. The pending promise here keeps the worker alive.
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
        } catch { /* transient — cancel() handles disconnects */ }
      };

      // Close after 55s — EventSource auto-reconnects
      const deadline = Date.now() + 55_000;
      while (!closed && Date.now() < deadline) {
        await poll();
        if (closed) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      closed = true;
      try { controller.close(); } catch { /* already closed */ }
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
