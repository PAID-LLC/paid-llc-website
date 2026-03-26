export const runtime = "edge";

// ── GET /api/admin/sales — revenue & purchase history ─────────────────────
// Uses Stripe REST API directly (no npm package — edge-compatible).

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

interface StripeCharge {
  id:       string;
  amount:   number;
  status:   string;
  created:  number;
  metadata: Record<string, string>;
  billing_details: { email: string | null };
}

interface StripeList { data: StripeCharge[]; has_more: boolean; }

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "—";
  return `${local.slice(0, 1)}***@${domain}`;
}

function startOfMonth(): number {
  const d = new Date();
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000);
}

function dayBucket(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(req: Request) {
  if (!(await checkAuth(req))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({ ok: false, reason: "Stripe not configured" }, { status: 503 });
  }

  // Fetch last 50 charges and current-month charges (for MTD) in parallel
  const [recentRes, mtdRes] = await Promise.all([
    fetch("https://api.stripe.com/v1/charges?limit=50&expand[]=data.billing_details", {
      headers: { Authorization: `Bearer ${stripeKey}` },
    }),
    fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${startOfMonth()}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    ),
  ]);

  if (!recentRes.ok || !mtdRes.ok) {
    return Response.json({ ok: false, reason: "Stripe fetch failed" }, { status: 502 });
  }

  const [recentData, mtdData] = await Promise.all([
    recentRes.json() as Promise<StripeList>,
    mtdRes.json()    as Promise<StripeList>,
  ]);

  // MTD revenue (succeeded only)
  const revenue_mtd_cents = mtdData.data
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount, 0);

  // 30-day sparkline — group by day
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const byDay: Record<string, number> = {};
  for (const c of recentData.data) {
    if (c.status === "succeeded" && c.created >= thirtyDaysAgo) {
      const day = dayBucket(c.created);
      byDay[day] = (byDay[day] ?? 0) + c.amount;
    }
  }

  // Build ordered sparkline array (last 30 days)
  const sparkline: { date: string; amount_cents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d    = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    sparkline.push({ date, amount_cents: byDay[date] ?? 0 });
  }

  // Recent purchases table — mask email, include product name from metadata
  const purchases = recentData.data.map((c) => ({
    id:            c.id,
    amount_cents:  c.amount,
    status:        c.status,
    product_name:  c.metadata?.product_name ?? c.metadata?.name ?? "—",
    email_masked:  maskEmail(c.billing_details?.email ?? null),
    created_at:    new Date(c.created * 1000).toISOString(),
  }));

  return Response.json({
    ok:               true,
    revenue_mtd_cents,
    sparkline,
    purchases,
  });
}
