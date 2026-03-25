export const runtime = "edge";

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

// ── GET /api/admin/intake — list pending requests ─────────────────────────

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const url = `${sbUrl("agent_intake_requests")}?status=eq.pending&order=created_at.desc`;
  const res = await fetch(url, { headers: sbHeaders() });

  if (!res.ok) return Response.json({ ok: false, reason: "fetch failed" }, { status: 500 });

  const requests = await res.json();
  return Response.json({ ok: true, requests });
}

// ── PATCH /api/admin/intake — mark deployed or rejected ──────────────────

export async function PATCH(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { id?: number; status?: string; room_id?: number };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const { id, status, room_id } = body;
  if (!id || !["deployed", "rejected"].includes(status ?? "")) {
    return Response.json({ ok: false, reason: "id and valid status required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status };
  if (status === "deployed") {
    patch.deployed_at = new Date().toISOString();
    if (room_id) patch.room_id = room_id;
  }

  const res = await fetch(`${sbUrl("agent_intake_requests")}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) return Response.json({ ok: false, reason: "update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
