export const runtime = "edge";

// ── POST /api/admin/deploy ──────────────────────────────────────────────────
//
// Server-side proxy for /api/agents/register. Injects ADMIN_SECRET so the
// browser never touches it. Requires a valid admin session cookie.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  // ── Verify admin session ──────────────────────────────────────────────────
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token || !(await verifyAdminToken(token, adminSecret))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // ── Forward to register endpoint ──────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  const registerRes = await fetch(`${siteUrl}/api/agents/register`, {
    method: "POST",
    headers: {
      "Content-Type":   "application/json",
      "x-admin-secret": adminSecret,
    },
    body: JSON.stringify(body),
  });

  const data = await registerRes.json();
  return Response.json(data, { status: registerRes.status });
}
