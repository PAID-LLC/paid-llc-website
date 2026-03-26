export const runtime = "edge";

// ── POST /api/admin/agent-ops/report — generate PAID LLC Pulse Report ─────
// ── GET  /api/admin/agent-ops/report — return last saved report ───────────
//
// POST body: { deliver?: boolean }  — if true, emails report via Resend

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  // Accept cron secret header as bypass (used by /api/admin/agent-ops/cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return true;

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function checkOrigin(req: Request): boolean {
  const origin  = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; }
}

// ── GET — return last saved report ────────────────────────────────────────

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const res = await fetch(
    sbUrl("admin_reports?select=id,generated_at,period_start,period_end,summary_md,delivered_to,delivered_at&order=generated_at.desc&limit=5"),
    { headers: sbHeaders() }
  );
  if (!res.ok) return Response.json({ ok: false, reason: "fetch failed" }, { status: 500 });

  const reports = await res.json();
  return Response.json({ ok: true, reports });
}

// ── POST — generate report, optionally deliver ────────────────────────────

export async function POST(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let deliver = false;
  try { const body = await req.json(); deliver = !!body.deliver; } catch { /* deliver stays false */ }

  const now          = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const siteUrl      = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  const stripeKey    = process.env.STRIPE_SECRET_KEY;

  // Aggregate all data in parallel
  const [
    stripeRes, newAgentsRes, auditTodayRes, auditForbiddenRes,
    auditRateLimitedRes, intakePendingRes, arenaRes,
    prevMonthStripeRes,
  ] = await Promise.allSettled([
    stripeKey
      ? fetch(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${Math.floor(startOfMonth.getTime() / 1000)}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        })
      : Promise.resolve(null),
    fetch(sbUrl(`latent_registry?created_at=gte.${encodeURIComponent(sevenDaysAgo.toISOString())}&select=id`), { headers: sbHeaders() }),
    fetch(sbUrl(`agent_audit_log?created_at=gte.${encodeURIComponent(startOfDay.toISOString())}&select=id`), { headers: sbHeaders() }),
    fetch(sbUrl(`agent_audit_log?result_code=eq.FORBIDDEN&created_at=gte.${encodeURIComponent(sevenDaysAgo.toISOString())}&select=id`), { headers: sbHeaders() }),
    fetch(sbUrl(`agent_audit_log?result_code=eq.RATE_LIMITED&created_at=gte.${encodeURIComponent(sevenDaysAgo.toISOString())}&select=id`), { headers: sbHeaders() }),
    fetch(sbUrl("agent_intake_requests?status=eq.pending&select=id"), { headers: sbHeaders() }),
    fetch(`${siteUrl}/api/arena/stats`),
    // Previous month revenue for delta
    stripeKey
      ? fetch(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000)}&created[lte]=${Math.floor(startOfMonth.getTime() / 1000)}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        })
      : Promise.resolve(null),
  ]);

  async function countRows(settled: PromiseSettledResult<Response | null>): Promise<number> {
    if (settled.status !== "fulfilled" || !settled.value) return 0;
    try { const r = await settled.value.json() as unknown[]; return Array.isArray(r) ? r.length : 0; }
    catch { return 0; }
  }

  async function parseStripeRevenue(settled: PromiseSettledResult<Response | null>): Promise<number> {
    if (settled.status !== "fulfilled" || !settled.value) return 0;
    try {
      const d = await settled.value.json() as { data?: { amount: number; status: string }[] };
      return (d.data ?? []).filter((c) => c.status === "succeeded").reduce((s, c) => s + c.amount, 0);
    } catch { return 0; }
  }

  const [
    revenue_mtd_cents, new_agents_week, audit_today,
    forbidden_week, rate_limited_week, pending_intake,
    prev_revenue_cents,
  ] = await Promise.all([
    parseStripeRevenue(stripeRes),
    countRows(newAgentsRes),
    countRows(auditTodayRes),
    countRows(auditForbiddenRes),
    countRows(auditRateLimitedRes),
    countRows(intakePendingRes),
    parseStripeRevenue(prevMonthStripeRes),
  ]);

  let arena: Record<string, unknown> = {};
  if (arenaRes.status === "fulfilled" && arenaRes.value) {
    try { arena = await arenaRes.value.json() as Record<string, unknown>; } catch { /* ok */ }
  }

  const revenueDeltaPct = prev_revenue_cents > 0
    ? Math.round(((revenue_mtd_cents - prev_revenue_cents) / prev_revenue_cents) * 100)
    : null;

  const deltaStr = revenueDeltaPct !== null
    ? (revenueDeltaPct >= 0 ? `+${revenueDeltaPct}%` : `${revenueDeltaPct}%`)
    : "N/A";

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Action items — auto-populated
  const actionItems: string[] = [];
  if (forbidden_week > 0)  actionItems.push(`${forbidden_week} FORBIDDEN event(s) this week — review audit log`);
  if (pending_intake >= 3) actionItems.push(`${pending_intake} intake requests pending — review and act`);

  const report_json = {
    generated_at:       now.toISOString(),
    revenue_mtd_cents,
    revenue_delta_pct:  revenueDeltaPct,
    new_agents_week,
    audit_today,
    forbidden_week,
    rate_limited_week,
    pending_intake,
    arena,
    action_items:       actionItems,
  };

  const weekLabel = sevenDaysAgo.toISOString().slice(0, 10);

  const summary_md = `# PAID LLC Pulse — Week of ${weekLabel}

## Revenue
- MTD: ${fmt(revenue_mtd_cents)}  |  vs last month: ${deltaStr}

## The Latent Space
- New registrations this week: ${new_agents_week}
- Arena duels: ${arena.total_duels ?? "—"}
- Top agent: ${(arena.top_agent as string) ?? "—"}

## Site Activity
- MCP tool calls today: ${audit_today}
- FORBIDDEN events (7d): ${forbidden_week}${forbidden_week > 0 ? "  ← investigate" : ""}
- RATE_LIMITED events (7d): ${rate_limited_week}

## Intake
- Pending requests: ${pending_intake}

## Action Items
${actionItems.length > 0 ? actionItems.map((i) => `- ${i}`).join("\n") : "- None"}
`;

  // Save to admin_reports
  const saveRes = await fetch(sbUrl("admin_reports"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body:    JSON.stringify({
      period_start: sevenDaysAgo.toISOString(),
      period_end:   now.toISOString(),
      report_json,
      summary_md,
    }),
  });

  if (!saveRes.ok) {
    return Response.json({ ok: false, reason: "failed to save report" }, { status: 500 });
  }

  const saved = await saveRes.json() as { id: number }[];
  const report_id = saved[0]?.id;

  // Optionally deliver via Resend
  let delivered_to: string | null = null;
  if (deliver) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const resendKey  = process.env.RESEND_API_KEY;
    const fromEmail  = process.env.RESEND_FROM_EMAIL ?? "noreply@paiddev.com";

    if (adminEmail && resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          from:    `PAID LLC <${fromEmail}>`,
          to:      [adminEmail],
          subject: `PAID LLC Pulse — Week of ${weekLabel}`,
          text:    summary_md,
        }),
      });

      if (emailRes.ok) {
        delivered_to = adminEmail;
        // Update delivered_to in saved report
        if (report_id) {
          void fetch(`${sbUrl("admin_reports")}?id=eq.${report_id}`, {
            method:  "PATCH",
            headers: { ...sbHeaders(), Prefer: "return=minimal" },
            body:    JSON.stringify({ delivered_to: adminEmail, delivered_at: new Date().toISOString() }),
          });
        }
      }
    }
  }

  return Response.json({ ok: true, report_id, delivered_to, summary_md });
}
