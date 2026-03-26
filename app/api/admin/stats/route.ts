export const runtime = "edge";

// ── GET /api/admin/stats — KPI strip for command center ───────────────────
// Returns 5 KPIs in a single fetch. Called on mount + every 60s.

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
  if (!(await checkAuth(req))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const stripeKey    = process.env.STRIPE_SECRET_KEY;
  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

  // Fan out all fetches in parallel
  const [stripeRes, agentsRes, intakeRes, auditRes, roomRes] = await Promise.allSettled([
    // Stripe: charges created this month
    stripeKey
      ? fetch(
          `https://api.stripe.com/v1/charges?limit=100&created[gte]=${Math.floor(startOfMonth.getTime() / 1000)}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } }
        )
      : Promise.resolve(null),

    // Active agents count
    supabaseReady()
      ? fetch(sbUrl("client_agents?active=eq.true&select=id"), { headers: sbHeaders() })
      : Promise.resolve(null),

    // Pending intake count
    supabaseReady()
      ? fetch(sbUrl("agent_intake_requests?status=eq.pending&select=id"), { headers: sbHeaders() })
      : Promise.resolve(null),

    // Audit events today
    supabaseReady()
      ? fetch(
          sbUrl(`agent_audit_log?created_at=gte.${encodeURIComponent(startOfDay.toISOString())}&select=id`),
          { headers: sbHeaders() }
        )
      : Promise.resolve(null),

    // Last deploy (most recent lounge room)
    supabaseReady()
      ? fetch(sbUrl("lounge_rooms?select=created_at&order=created_at.desc&limit=1"), { headers: sbHeaders() })
      : Promise.resolve(null),
  ]);

  // Parse Stripe revenue MTD
  let revenue_mtd_cents = 0;
  if (stripeRes.status === "fulfilled" && stripeRes.value) {
    try {
      const data = await stripeRes.value.json() as { data?: { amount: number; status: string }[] };
      revenue_mtd_cents = (data.data ?? [])
        .filter((c) => c.status === "succeeded")
        .reduce((sum, c) => sum + c.amount, 0);
    } catch { /* non-critical */ }
  }

  // Parse Supabase counts
  async function parseCount(settled: PromiseSettledResult<Response | null>): Promise<number> {
    if (settled.status !== "fulfilled" || !settled.value) return 0;
    try { const rows = await settled.value.json() as unknown[]; return Array.isArray(rows) ? rows.length : 0; }
    catch { return 0; }
  }

  const [active_agents, pending_intake, audit_events_today] = await Promise.all([
    parseCount(agentsRes),
    parseCount(intakeRes),
    parseCount(auditRes),
  ]);

  let last_deploy_at: string | null = null;
  if (roomRes.status === "fulfilled" && roomRes.value) {
    try {
      const rows = await roomRes.value.json() as { created_at: string }[];
      last_deploy_at = rows[0]?.created_at ?? null;
    } catch { /* non-critical */ }
  }

  return Response.json({
    ok: true,
    revenue_mtd_cents,
    active_agents,
    pending_intake,
    audit_events_today,
    last_deploy_at,
    site_url: siteUrl,
  });
}
