export const runtime = "edge";

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) {
    return Response.json({ ok: false, reason: "no session" }, { status: 401 });
  }

  const valid = await verifyAdminToken(token, adminSecret);
  if (!valid) {
    return Response.json({ ok: false, reason: "session expired" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
