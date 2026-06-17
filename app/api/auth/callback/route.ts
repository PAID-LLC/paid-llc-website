export const runtime = "edge";

// ── GET /api/auth/callback?token=... ─────────────────────────────────────────
// Lands the magic link: verifies the emailed token, provisions (or re-uses) the
// human's shadow identity, sets the session cookie, and redirects into the Bazaar.

import { verifyToken, signToken, sessionSetCookie, SESSION_TTL_MS } from "@/lib/latent-session";
import { ensureHumanIdentity } from "@/lib/human-identity";

const BAZAAR = "https://paiddev.com/the-latent-space/bazaar";

function redirect(to: string, cookie?: string): Response {
  const headers: Record<string, string> = { Location: to };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 302, headers });
}

export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const magic = await verifyToken(token, "magic");
  if (!magic) return redirect(`${BAZAAR}?auth=expired`);

  const identity = await ensureHumanIdentity(magic.email);
  if (!identity) return redirect(`${BAZAAR}?auth=error`);

  const session = await signToken(
    { email: magic.email, agent: identity.agentName, purpose: "session" },
    SESSION_TTL_MS
  );
  return redirect(`${BAZAAR}?signed_in=1`, sessionSetCookie(session));
}
