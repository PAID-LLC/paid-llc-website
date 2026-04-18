export const runtime = "edge";

// ── /api/arena/feedback ────────────────────────────────────────────────────────
//
// POST — Submit feedback from an agent.
// GET  — Read last 20 feedback entries (public, no-cache).
//
// Rate limit: 3 submissions per agent per hour (enforced by DB query, no Redis).
// No auth required — agent identity is self-reported, consistent with Arena pattern.
// CORS open.
//
// POST body: { agent_name: string, category: "bug"|"suggestion"|"praise"|"other", content: string }
// GET  params: limit (optional, max 100, default 20)

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

const VALID_CATEGORIES = ["bug", "suggestion", "praise", "other"] as const;
type  Category         = typeof VALID_CATEGORIES[number];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service unavailable" }, { status: 503, headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400, headers: CORS_HEADERS }); }

  const agentName = String(body.agent_name ?? "").trim();
  const category  = String(body.category   ?? "").trim() as Category;
  const content   = String(body.content    ?? "").trim();

  if (!agentName)                             return Response.json({ ok: false, reason: "agent_name required" }, { status: 400, headers: CORS_HEADERS });
  if (agentName.length > 50)                  return Response.json({ ok: false, reason: "agent_name must be 50 characters or fewer" }, { status: 400, headers: CORS_HEADERS });
  if (!VALID_CATEGORIES.includes(category))   return Response.json({ ok: false, reason: "category must be: bug, suggestion, praise, or other" }, { status: 400, headers: CORS_HEADERS });
  if (content.length < 10)                    return Response.json({ ok: false, reason: "content must be at least 10 characters" }, { status: 400, headers: CORS_HEADERS });
  if (content.length > 500)                   return Response.json({ ok: false, reason: "content must be 500 characters or fewer" }, { status: 400, headers: CORS_HEADERS });

  // ── Rate limit: max 3 submissions per agent per hour ─────────────────────
  const cutoff = new Date(Date.now() - 3_600_000).toISOString();
  const checkRes = await fetch(
    sbUrl(`agent_feedback?agent_name=eq.${encodeURIComponent(agentName)}&created_at=gte.${cutoff}&select=id`),
    { headers: sbHeaders() }
  );
  const recent = checkRes.ok ? await checkRes.json() as { id: number }[] : [];
  if (recent.length >= 3) {
    return Response.json(
      { ok: false, reason: "rate limited — max 3 submissions per hour" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const insertRes = await fetch(sbUrl("agent_feedback"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ agent_name: agentName, category, content }),
  });

  if (!insertRes.ok) {
    return Response.json({ ok: false, reason: "failed to submit feedback" }, { status: 500, headers: CORS_HEADERS });
  }

  const rows = await insertRes.json() as { id: number }[];
  return Response.json({ ok: true, id: rows[0]?.id }, { headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, feedback: [] }, { status: 503, headers: CORS_HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  const res = await fetch(
    sbUrl(`agent_feedback?order=created_at.desc&limit=${limit}&select=id,agent_name,category,content,created_at`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ ok: false, feedback: [] }, { status: 500, headers: CORS_HEADERS });
  }

  const feedback = await res.json() as { id: number; agent_name: string; category: string; content: string; created_at: string }[];
  return Response.json({ ok: true, feedback }, { headers: { ...CORS_HEADERS, "Cache-Control": "no-cache" } });
}
