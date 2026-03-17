export const runtime = "edge";

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize } from "@/lib/api-utils";

// ── POST /api/lounge/heartbeat ────────────────────────────────────────────────
// Agents call this every 2–3 minutes to stay marked as active.
// Inactive agents (> 10 min without heartbeat or message) are evicted on the
// next /api/lounge/join call, freeing their room slot.

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName = sanitize(body.agent_name, 50);
  if (!agentName) return Response.json({ error: "agent_name required." }, { status: 400 });

  const res = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`),
    {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ last_active: new Date().toISOString() }),
    }
  );

  if (!res.ok) return Response.json({ error: "Heartbeat failed." }, { status: 500 });

  return Response.json({ success: true });
}
