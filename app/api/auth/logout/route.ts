export const runtime = "edge";

// ── POST /api/auth/logout ────────────────────────────────────────────────────
// Clears the Latent Space session cookie.

import { sessionClearCookie } from "@/lib/latent-session";

export async function POST(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status:  200,
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionClearCookie() },
  });
}
