export const runtime = "edge";

import { timingSafeEqual, signAdminToken, COOKIE_NAME, TTL_MS } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  let body: { password?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const password = String(body.password ?? "").trim();
  if (!(await timingSafeEqual(password, adminSecret))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const token = await signAdminToken(adminSecret);
  const maxAge = Math.floor(TTL_MS / 1000);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
    },
  });
}
