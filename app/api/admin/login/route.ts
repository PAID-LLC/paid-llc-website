export const runtime = "edge";

import { timingSafeEqual, signAdminToken, COOKIE_NAME, TTL_MS } from "@/lib/admin-auth";

// Minimum response time on any login attempt (ms). Raises the cost of brute force.
const MIN_RESPONSE_MS = 500;
// Additional delay added only on failure to further slow sequential attacks.
const FAIL_EXTRA_MS   = 1500;

export async function POST(req: Request) {
  const start = Date.now();

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  let body: { password?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const password = String(body.password ?? "").trim();
  const match    = await timingSafeEqual(password, adminSecret);

  if (!match) {
    // Pad to MIN_RESPONSE_MS + FAIL_EXTRA_MS before responding to slow brute force
    const elapsed = Date.now() - start;
    const wait    = Math.max(0, MIN_RESPONSE_MS + FAIL_EXTRA_MS - elapsed);
    await new Promise((r) => setTimeout(r, wait));
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // Pad successful logins to MIN_RESPONSE_MS to prevent timing-based enumeration
  const elapsed = Date.now() - start;
  if (elapsed < MIN_RESPONSE_MS) await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));

  const token  = await signAdminToken(adminSecret);
  const maxAge = Math.floor(TTL_MS / 1000);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
    },
  });
}
