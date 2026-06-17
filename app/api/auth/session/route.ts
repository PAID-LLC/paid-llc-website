export const runtime = "edge";

// ── GET /api/auth/session ────────────────────────────────────────────────────
// Lightweight session probe for the client UI. Returns the signed-in human's
// email, shadow-agent handle, and current credit balance, or authenticated:false.
// The api_key is never exposed to the browser — hires run server-side.

import { getSession } from "@/lib/latent-session";
import { getBalance } from "@/lib/human-identity";

export async function GET(req: Request): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return Response.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }
  const balance = await getBalance(session.agent);
  return Response.json(
    { authenticated: true, email: session.email, agent: session.agent, balance },
    { headers: { "Cache-Control": "no-store" } }
  );
}
