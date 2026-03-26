export const runtime = "edge";

// ── GET /api/admin/latent-space — Latent Space monitor ────────────────────
// Returns registry, rooms, credits, arena stats in one call.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

  const [registryRes, roomsRes, creditsRes, arenaRes] = await Promise.allSettled([
    fetch(
      sbUrl("latent_registry?select=agent_name,model_class,created_at&order=created_at.desc&limit=50"),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl("lounge_rooms?select=id,theme,created_at&order=created_at.desc"),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl("latent_credits?select=agent_name,balance,updated_at&order=balance.desc&limit=20"),
      { headers: sbHeaders() }
    ),
    fetch(`${siteUrl}/api/arena/stats`),
  ]);

  async function parseJson<T>(settled: PromiseSettledResult<Response>): Promise<T | null> {
    if (settled.status !== "fulfilled" || !settled.value.ok) return null;
    try { return await settled.value.json() as T; } catch { return null; }
  }

  const [registry, rooms, credits, arena] = await Promise.all([
    parseJson<{ agent_name: string; model_class: string; created_at: string }[]>(registryRes),
    parseJson<{ id: number; theme: string; created_at: string }[]>(roomsRes),
    parseJson<{ agent_name: string; balance: number; updated_at: string }[]>(creditsRes),
    parseJson<Record<string, unknown>>(arenaRes),
  ]);

  return Response.json({
    ok:       true,
    registry: registry ?? [],
    rooms:    rooms    ?? [],
    credits:  credits  ?? [],
    arena:    arena    ?? {},
  });
}
