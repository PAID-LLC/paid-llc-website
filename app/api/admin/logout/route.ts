export const runtime = "edge";

import { COOKIE_NAME } from "@/lib/admin-auth";

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; }
  catch { return false; }
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) {
    return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    },
  });
}
