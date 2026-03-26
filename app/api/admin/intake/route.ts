export const runtime = "edge";

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; }
  catch { return false; }
}

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

// ── GET /api/admin/intake — list requests ─────────────────────────────────
// ?status=pending|deployed|rejected|all  (default: pending)

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "pending";
  const validStatuses = ["pending", "deployed", "rejected", "all"];
  const status = validStatuses.includes(statusParam) ? statusParam : "pending";

  const filter = status === "all" ? "" : `status=eq.${status}&`;
  const url = `${sbUrl("agent_intake_requests")}?${filter}order=created_at.desc&limit=100`;
  const res = await fetch(url, { headers: sbHeaders() });

  if (!res.ok) return Response.json({ ok: false, reason: "fetch failed" }, { status: 500 });

  const requests = await res.json();
  return Response.json({ ok: true, requests });
}

// ── DELETE /api/admin/intake — bulk reject ────────────────────────────────
// Body: { ids: number[] }

export async function DELETE(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { ids?: number[] };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const ids = body.ids ?? [];
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "number")) {
    return Response.json({ ok: false, reason: "ids must be a non-empty array of numbers" }, { status: 400 });
  }
  if (ids.length > 50) {
    return Response.json({ ok: false, reason: "max 50 ids per bulk operation" }, { status: 400 });
  }

  // Reject all in parallel
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`${sbUrl("agent_intake_requests")}?id=eq.${id}`, {
        method:  "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body:    JSON.stringify({ status: "rejected" }),
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length;
  return Response.json({ ok: true, rejected: ids.length - failed, failed });
}

// ── PATCH /api/admin/intake — mark deployed or rejected ──────────────────

export async function PATCH(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
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
