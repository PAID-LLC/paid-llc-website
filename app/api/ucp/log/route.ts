export const runtime = "edge";

import { sbHeaders, sbUrl, supabaseReady }         from "@/lib/supabase";
import type { AgentCommerceLog, CommerceAction, CommerceStatus } from "@/lib/ucp-types";

const VALID_ACTIONS:  CommerceAction[]  = ["discovery", "negotiate", "purchase", "download", "bulk_request", "counter_offer"];
const VALID_STATUSES: CommerceStatus[]  = ["initiated", "accepted", "rejected", "completed", "failed"];

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) return Response.json({ ok: false }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const agentName  = String(body.agent_name ?? "").trim().slice(0, 50);
  const action     = String(body.action     ?? "") as CommerceAction;
  const status     = String(body.status     ?? "initiated") as CommerceStatus;
  const resourceId = body.resource_id ? String(body.resource_id).slice(0, 100) : null;
  const amount     = typeof body.amount === "number" ? body.amount : null;
  const currency   = String(body.currency ?? "USD").slice(0, 3).toUpperCase();
  const metadata   = body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  if (!agentName)                        return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!VALID_ACTIONS.includes(action))   return Response.json({ ok: false, reason: "invalid action" },      { status: 400 });
  if (!VALID_STATUSES.includes(status))  return Response.json({ ok: false, reason: "invalid status" },      { status: 400 });

  const insertRes = await fetch(sbUrl("agent_commerce_log"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body:    JSON.stringify({ agent_name: agentName, action, resource_id: resourceId, amount, currency, status, metadata }),
  });

  if (!insertRes.ok) return Response.json({ ok: false, reason: "log write failed" }, { status: 500 });
  const rows = await insertRes.json() as { id: number }[];
  return Response.json({ ok: true, id: rows[0]?.id });
}

export async function GET(req: Request): Promise<Response> {
  const adminSecret = process.env.ADMIN_SECRET;
  const auth        = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!adminSecret || auth !== adminSecret) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const agentName = searchParams.get("agent_name");
  const action    = searchParams.get("action");
  const since     = searchParams.get("since");

  let query = `agent_commerce_log?select=*&order=created_at.desc&limit=${limit}`;
  if (agentName) query += `&agent_name=eq.${encodeURIComponent(agentName)}`;
  if (action)    query += `&action=eq.${encodeURIComponent(action)}`;
  if (since)     query += `&created_at=gte.${encodeURIComponent(since)}`;

  const res = await fetch(sbUrl(query), { headers: sbHeaders() });
  if (!res.ok) return Response.json({ entries: [] }, { status: 500 });

  return Response.json(
    { entries: await res.json() as AgentCommerceLog[] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
