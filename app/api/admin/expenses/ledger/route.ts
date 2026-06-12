export const runtime = "edge";

// ── /api/admin/expenses/ledger — expense entries + tax set-aside estimate ───
// GET   — entries, YTD totals, monthly recurring floor, and a quarterly tax
//         set-aside ESTIMATE computed from sales_ledger income minus expenses.
//         Rough planning math, clearly labeled — not tax advice; confirm with
//         a tax professional before filing.
// POST  — add an expense { vendor, amount_usd | amount_cents, category?,
//         description?, cadence?, occurred_at? }
// PATCH — { id, active?, amount_cents?, description? } (cancel a subscription
//         by setting active:false)
//
// Schema: db/expenses-ledger.sql.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; }
}

interface ExpenseRow {
  id: number; occurred_at: string; vendor: string; category: string;
  description: string | null; amount_cents: number; cadence: string; active: boolean;
}

/** Months a monthly subscription was active this calendar year (1-based, inclusive). */
function monthsActiveThisYear(startIso: string, now: Date): number {
  const start = new Date(startIso);
  const jan1  = new Date(now.getFullYear(), 0, 1);
  const from  = start > jan1 ? start : jan1;
  if (from > now) return 0;
  return (now.getMonth() - from.getMonth()) + 1;
}

export async function GET(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const now  = new Date();
  const yStart = `${now.getFullYear()}-01-01`;

  const [expRes, revRes] = await Promise.all([
    fetch(sbUrl("expenses?select=*&order=occurred_at.desc&limit=500"), { headers: sbHeaders() }).catch(() => null),
    fetch(
      sbUrl(`sales_ledger?occurred_at=gte.${yStart}&select=gross_cents,fee_cents,event_type`),
      { headers: sbHeaders() }
    ).catch(() => null),
  ]);

  if (!expRes?.ok) {
    return Response.json({
      ok: false,
      reason: "expenses table missing — run db/expenses-ledger.sql in the Supabase SQL editor",
    }, { status: 503 });
  }

  const rows = await expRes.json() as ExpenseRow[];
  const sales = revRes?.ok
    ? await revRes.json() as { gross_cents: number; fee_cents: number; event_type: string }[]
    : [];

  // ── YTD expenses ──
  let ytd = 0;
  let monthlyFloor = 0;
  for (const r of rows) {
    if (r.cadence === "one_time") {
      if (r.occurred_at >= yStart) ytd += r.amount_cents;
    } else if (r.cadence === "monthly") {
      if (r.active) {
        monthlyFloor += r.amount_cents;
        ytd += r.amount_cents * monthsActiveThisYear(r.occurred_at, now);
      }
    } else if (r.cadence === "annual") {
      if (r.active && new Date(r.occurred_at).getMonth() <= now.getMonth()) ytd += r.amount_cents;
    }
  }

  // ── YTD income (refunds subtract; gross minus processor fees = what lands) ──
  const revenue   = sales.reduce((s, r) => s + (r.event_type === "refund" ? -r.gross_cents : r.gross_cents), 0);
  const procFees  = sales.reduce((s, r) => s + r.fee_cents, 0);
  // Processor fees are deductible too — count them with expenses.
  const totalExpenses = ytd + procFees;
  const net = Math.max(0, revenue - totalExpenses);

  // ── Tax set-aside ESTIMATE (planning math, not advice) ──
  // Self-employment: 15.3% on 92.35% of net. Federal income: ~10% effective
  // at this income level after the SE deduction. MN: 5.35% first bracket.
  const seTax  = Math.round(net * 0.9235 * 0.153);
  const fedEst = Math.round(net * 0.10);
  const mnEst  = Math.round(net * 0.0535);
  const setAside = seTax + fedEst + mnEst;

  return Response.json({
    ok: true,
    entries: rows,
    summary: {
      ytd_revenue_cents:    revenue,
      ytd_expenses_cents:   totalExpenses,
      processor_fees_cents: procFees,
      ytd_net_cents:        net,
      monthly_floor_cents:  monthlyFloor,
    },
    tax_estimate: {
      self_employment_cents: seTax,
      federal_income_cents:  fedEst,
      mn_state_cents:        mnEst,
      set_aside_cents:       setAside,
      set_aside_pct:         net > 0 ? Math.round((setAside / net) * 100) : 30,
      note: "Planning estimate only (SE 15.3% on 92.35% of net, ~10% federal, 5.35% MN first bracket). Quarterly due dates: Apr 15, Jun 15, Sep 15, Jan 15. Confirm with a tax professional.",
    },
  });
}

export async function POST(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req))       return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const vendor = String(body.vendor ?? "").trim().slice(0, 100);
  const cents  = body.amount_cents !== undefined
    ? Math.round(Number(body.amount_cents))
    : Math.round(Number(body.amount_usd) * 100);
  if (!vendor)                      return Response.json({ ok: false, reason: "vendor required" }, { status: 400 });
  if (!Number.isFinite(cents) || cents < 0) return Response.json({ ok: false, reason: "valid amount required" }, { status: 400 });

  const res = await fetch(sbUrl("expenses"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      vendor,
      amount_cents: cents,
      category:     String(body.category ?? "software"),
      description:  body.description ? String(body.description).slice(0, 300) : null,
      cadence:      ["one_time", "monthly", "annual"].includes(String(body.cadence)) ? String(body.cadence) : "one_time",
      ...(body.occurred_at ? { occurred_at: String(body.occurred_at).slice(0, 10) } : {}),
    }),
  }).catch(() => null);

  if (!res?.ok) return Response.json({ ok: false, reason: "insert failed (check category value)" }, { status: 502 });
  const rows = await res.json() as ExpenseRow[];
  return Response.json({ ok: true, expense: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req))       return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const id = Number(body.id);
  if (!id) return Response.json({ ok: false, reason: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.active       !== undefined) update.active       = !!body.active;
  if (body.amount_cents !== undefined) update.amount_cents = Math.max(0, Math.round(Number(body.amount_cents)));
  if (body.description  !== undefined) update.description  = body.description ? String(body.description).slice(0, 300) : null;
  if (Object.keys(update).length === 0) return Response.json({ ok: false, reason: "nothing to update" }, { status: 400 });

  const res = await fetch(sbUrl(`expenses?id=eq.${id}`), {
    method:  "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body:    JSON.stringify(update),
  }).catch(() => null);

  if (!res?.ok) return Response.json({ ok: false, reason: "update failed" }, { status: 502 });
  const rows = await res.json() as ExpenseRow[];
  if (rows.length === 0) return Response.json({ ok: false, reason: "not found" }, { status: 404 });
  return Response.json({ ok: true, expense: rows[0] });
}
