export const runtime = "edge";

// ── GET /api/admin/sales — unified revenue & purchase reporting ────────────
// Two data planes, merged in one response:
//   1. sales_ledger (Supabase) — every rail: Stripe, Coinbase CDP/Commerce,
//      x402, manual. Summaries by period, source, product + provisioning
//      issues (paid but not delivered).
//   2. Stripe live API — MTD revenue, 30-day sparkline, recent charges.
//      Kept for back-compat with the admin Sales tab and as an independent
//      check on the ledger (reconciliation diffs the two).

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

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

interface LedgerRow {
  id:                  number;
  occurred_at:         string;
  source:              string;
  event_type:          string;
  product_slug:        string | null;
  product_name:        string | null;
  customer_email:      string | null;
  agent_name:          string | null;
  gross_cents:         number;
  fee_cents:           number;
  net_cents:           number;
  external_id:         string;
  provisioning_status: string;
  provisioning_detail: string | null;
}

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

// ── Ledger aggregation ──────────────────────────────────────────────────────

interface Bucket { gross_cents: number; net_cents: number; count: number }

function add(map: Record<string, Bucket>, key: string, row: LedgerRow) {
  const b = (map[key] ??= { gross_cents: 0, net_cents: 0, count: 0 });
  b.gross_cents += row.gross_cents;
  b.net_cents   += row.net_cents;
  b.count       += 1;
}

async function getLedgerReport() {
  if (!supabaseReady()) return null;

  // Last 90 days of line items is plenty for the dashboard; totals are
  // computed over the same window plus an all-time aggregate query.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    sbUrl(
      `sales_ledger?occurred_at=gte.${encodeURIComponent(since)}` +
      `&select=id,occurred_at,source,event_type,product_slug,product_name,customer_email,agent_name,gross_cents,fee_cents,net_cents,external_id,provisioning_status,provisioning_detail` +
      `&order=occurred_at.desc&limit=500`
    ),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return null; // table missing or supabase down — report stripe-only

  const rows = await res.json() as LedgerRow[];

  const now        = Date.now();
  const dayMs      = 24 * 60 * 60 * 1000;
  const todayStart = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const monthStart = startOfMonth() * 1000;

  const periods = { today: { gross_cents: 0, net_cents: 0, count: 0 },
                    last_7d: { gross_cents: 0, net_cents: 0, count: 0 },
                    mtd: { gross_cents: 0, net_cents: 0, count: 0 },
                    last_90d: { gross_cents: 0, net_cents: 0, count: 0 } };
  const bySource:  Record<string, Bucket> = {};
  const byProduct: Record<string, Bucket> = {};
  const byType:    Record<string, Bucket> = {};

  for (const r of rows) {
    if (r.event_type === "refund") continue; // refunds excluded from revenue buckets
    const t = new Date(r.occurred_at).getTime();
    if (t >= todayStart)      { periods.today.gross_cents += r.gross_cents;   periods.today.net_cents += r.net_cents;   periods.today.count++; }
    if (t >= now - 7 * dayMs) { periods.last_7d.gross_cents += r.gross_cents; periods.last_7d.net_cents += r.net_cents; periods.last_7d.count++; }
    if (t >= monthStart)      { periods.mtd.gross_cents += r.gross_cents;     periods.mtd.net_cents += r.net_cents;     periods.mtd.count++; }
    periods.last_90d.gross_cents += r.gross_cents;
    periods.last_90d.net_cents   += r.net_cents;
    periods.last_90d.count++;

    add(bySource,  r.source, r);
    add(byType,    r.event_type, r);
    add(byProduct, r.product_name ?? r.product_slug ?? "(unknown)", r);
  }

  // Provisioning issues: paid but delivery pending >10 min or failed.
  const staleMs = 10 * 60 * 1000;
  const issues = rows
    .filter((r) =>
      r.provisioning_status === "failed" ||
      (r.provisioning_status === "pending" && now - new Date(r.occurred_at).getTime() > staleMs)
    )
    .slice(0, 50)
    .map((r) => ({
      ledger_id:    r.id,
      external_id:  r.external_id,
      occurred_at:  r.occurred_at,
      source:       r.source,
      event_type:   r.event_type,
      product:      r.product_name ?? r.product_slug ?? "—",
      customer:     r.customer_email ? maskEmail(r.customer_email) : (r.agent_name ?? "—"),
      gross_cents:  r.gross_cents,
      status:       r.provisioning_status,
      detail:       r.provisioning_detail,
    }));

  const recent = rows.slice(0, 50).map((r) => ({
    ledger_id:    r.id,
    occurred_at:  r.occurred_at,
    source:       r.source,
    event_type:   r.event_type,
    product:      r.product_name ?? r.product_slug ?? "—",
    customer:     r.customer_email ? maskEmail(r.customer_email) : (r.agent_name ?? "—"),
    gross_cents:  r.gross_cents,
    net_cents:    r.net_cents,
    provisioning: r.provisioning_status,
  }));

  return {
    periods,
    by_source:           Object.entries(bySource).map(([source, b])  => ({ source,  ...b })).sort((a, z) => z.gross_cents - a.gross_cents),
    by_event_type:       Object.entries(byType).map(([type, b])      => ({ type,    ...b })).sort((a, z) => z.gross_cents - a.gross_cents),
    by_product:          Object.entries(byProduct).map(([product, b]) => ({ product, ...b })).sort((a, z) => z.gross_cents - a.gross_cents).slice(0, 20),
    provisioning_issues: issues,
    recent,
    window_days:         90,
  };
}

// ── Stripe live plane (back-compat) ─────────────────────────────────────────

async function getStripeReport() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  const [recentRes, mtdRes] = await Promise.all([
    fetch("https://api.stripe.com/v1/charges?limit=50&expand[]=data.billing_details", {
      headers: { Authorization: `Bearer ${stripeKey}` },
    }),
    fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${startOfMonth()}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    ),
  ]).catch(() => [null, null]);

  if (!recentRes?.ok || !mtdRes?.ok) return null;

  const [recentData, mtdData] = await Promise.all([
    recentRes.json() as Promise<StripeList>,
    mtdRes.json()    as Promise<StripeList>,
  ]);

  const revenue_mtd_cents = mtdData.data
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount, 0);

  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const byDay: Record<string, number> = {};
  for (const c of recentData.data) {
    if (c.status === "succeeded" && c.created >= thirtyDaysAgo) {
      const day = dayBucket(c.created);
      byDay[day] = (byDay[day] ?? 0) + c.amount;
    }
  }

  const sparkline: { date: string; amount_cents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d    = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    sparkline.push({ date, amount_cents: byDay[date] ?? 0 });
  }

  const purchases = recentData.data.map((c) => ({
    id:            c.id,
    amount_cents:  c.amount,
    status:        c.status,
    product_name:  c.metadata?.product_name ?? c.metadata?.name ?? "—",
    email_masked:  maskEmail(c.billing_details?.email ?? null),
    created_at:    new Date(c.created * 1000).toISOString(),
  }));

  return { revenue_mtd_cents, sparkline, purchases };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!(await checkAuth(req))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const [stripe, ledger] = await Promise.all([getStripeReport(), getLedgerReport()]);

  if (!stripe && !ledger) {
    return Response.json({ ok: false, reason: "Stripe and ledger both unavailable" }, { status: 503 });
  }

  return Response.json({
    ok: true,
    // Back-compat fields consumed by the admin Sales tab
    revenue_mtd_cents: stripe?.revenue_mtd_cents ?? ledger?.periods.mtd.gross_cents ?? 0,
    sparkline:         stripe?.sparkline ?? [],
    purchases:         stripe?.purchases ?? [],
    // Unified ledger plane (null until db/sales-ledger.sql has been run)
    ledger,
  });
}
