export const runtime = "edge";

// ── /api/admin/reconcile — processor vs ledger reconciliation ───────────────
//
// GET  ?days=30  — compare each payment processor's records against
//                  sales_ledger and report gaps:
//                    Stripe checkout sessions  vs ledger source=stripe
//                    Coinbase Commerce charges vs ledger source=coinbase_commerce
//                    x402_payments table       vs ledger source=x402
//                  Plus provisioning health (paid but undelivered).
//
// POST { backfill: true, days?: 90 }
//                — insert any processor records missing from the ledger.
//                  Idempotent (recordSale dedupes on external_id), so this is
//                  also the day-one historical backfill.
//
// The processors are the source of truth for money; the ledger is the source
// of truth for delivery. This endpoint diffs the two.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";
import { recordSale, type LedgerEntry }       from "@/lib/ledger";
import { productTitles }                      from "@/lib/products";

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

// ── Processor fetchers ──────────────────────────────────────────────────────

interface ProcessorRecord {
  external_id:    string;
  gross_cents:    number;
  occurred_at:    string;
  entry:          LedgerEntry;   // ready-to-insert ledger row for backfill
}

/** Paid Stripe checkout sessions in the window (paginated, max 3 pages). */
async function fetchStripeSessions(sinceUnix: number): Promise<ProcessorRecord[] | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  interface Session {
    id: string;
    created: number;
    amount_total: number | null;
    payment_status: string;
    customer_details?: { email?: string | null } | null;
    metadata?: Record<string, string> | null;
  }

  const out: ProcessorRecord[] = [];
  let startingAfter = "";
  for (let page = 0; page < 3; page++) {
    const url =
      `https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${sinceUnix}` +
      (startingAfter ? `&starting_after=${startingAfter}` : "");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
    if (!res?.ok) return page === 0 ? null : out;
    const data = await res.json() as { data: Session[]; has_more: boolean };

    for (const s of data.data) {
      if (s.payment_status !== "paid") continue;
      const meta = s.metadata ?? {};
      const eventType =
        meta.product_type === "credit_pack" ? "credit_pack" :
        meta.source === "ucp_purchase"      ? "bazaar_sale" : "guide_sale";
      const slug = meta.product ?? "";
      out.push({
        external_id: s.id,
        gross_cents: s.amount_total ?? 0,
        occurred_at: new Date(s.created * 1000).toISOString(),
        entry: {
          source:               "stripe",
          event_type:           eventType,
          external_id:          s.id,
          gross_cents:          s.amount_total ?? 0,
          product_slug:         slug || undefined,
          product_name:         productTitles[slug] ?? (meta.product_name || undefined),
          customer_email:       s.customer_details?.email ?? undefined,
          agent_name:           meta.agent_name,
          occurred_at:          new Date(s.created * 1000).toISOString(),
          provisioning_status:  "delivered",
          provisioning_detail:  "backfilled from Stripe — historical delivery assumed",
        },
      });
    }
    if (!data.has_more || data.data.length === 0) break;
    startingAfter = data.data[data.data.length - 1].id;
  }
  return out;
}

/** Confirmed Coinbase Commerce charges in the window. */
async function fetchCommerceCharges(sinceMs: number): Promise<ProcessorRecord[] | null> {
  const key = process.env.COINBASE_COMMERCE_API_KEY;
  if (!key) return null;

  interface Charge {
    code: string;
    created_at: string;
    timeline?: { status: string }[];
    pricing?: { local?: { amount?: string } };
    metadata?: Record<string, string>;
  }

  const res = await fetch("https://api.commerce.coinbase.com/charges?limit=100", {
    headers: { "X-CC-Api-Key": key, "X-CC-Version": "2018-03-22", Accept: "application/json" },
  }).catch(() => null);
  if (!res?.ok) return null;

  const data = await res.json() as { data?: Charge[] };
  const out: ProcessorRecord[] = [];
  for (const c of data.data ?? []) {
    const created = new Date(c.created_at).getTime();
    if (created < sinceMs) continue;
    const confirmed = (c.timeline ?? []).some((t) =>
      t.status === "COMPLETED" || t.status === "CONFIRMED" || t.status === "RESOLVED");
    if (!confirmed) continue;

    const meta  = c.metadata ?? {};
    const cents = Math.round(parseFloat(c.pricing?.local?.amount ?? "0") * 100) || 0;
    const slug  = meta.product ?? "";
    out.push({
      external_id: `commerce:${c.code}`,
      gross_cents: cents,
      occurred_at: c.created_at,
      entry: {
        source:              "coinbase_commerce",
        event_type:          meta.product_type === "credit_pack" ? "credit_pack" : "guide_sale",
        external_id:         `commerce:${c.code}`,
        gross_cents:         cents,
        product_slug:        slug || undefined,
        product_name:        productTitles[slug],
        agent_name:          meta.agent_name,
        occurred_at:         c.created_at,
        provisioning_status: "delivered",
        provisioning_detail: "backfilled from Coinbase Commerce — historical delivery assumed",
      },
    });
  }
  return out;
}

/** x402_payments rows in the window. */
async function fetchX402(sinceIso: string): Promise<ProcessorRecord[] | null> {
  if (!supabaseReady()) return null;
  const res = await fetch(
    sbUrl(`x402_payments?created_at=gte.${encodeURIComponent(sinceIso)}&select=tx_hash,agent_name,usd_amount,credits_granted,created_at&limit=500`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return null;

  const rows = await res.json() as { tx_hash: string; agent_name: string; usd_amount: number; credits_granted: number; created_at: string }[];
  return rows.map((r) => ({
    external_id: r.tx_hash,
    gross_cents: Math.round(r.usd_amount * 100),
    occurred_at: r.created_at,
    entry: {
      source:              "x402" as const,
      event_type:          "credit_pack" as const,
      external_id:         r.tx_hash,
      gross_cents:         Math.round(r.usd_amount * 100),
      agent_name:          r.agent_name,
      product_name:        `${r.credits_granted} Latent Credits (direct USDC)`,
      occurred_at:         r.created_at,
      provisioning_status: "delivered" as const,
      provisioning_detail: "backfilled from x402_payments",
    },
  }));
}

// ── Ledger fetcher ──────────────────────────────────────────────────────────

interface LedgerLite { external_id: string; gross_cents: number; source: string; provisioning_status: string }

async function fetchLedger(sinceIso: string): Promise<LedgerLite[] | null> {
  if (!supabaseReady()) return null;
  const res = await fetch(
    sbUrl(`sales_ledger?occurred_at=gte.${encodeURIComponent(sinceIso)}&select=external_id,gross_cents,source,provisioning_status&limit=1000`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return null; // table not created yet
  return await res.json() as LedgerLite[];
}

// ── Diff ────────────────────────────────────────────────────────────────────

function diffSource(processor: ProcessorRecord[], ledger: LedgerLite[]) {
  const ledgerById = new Map(ledger.map((l) => [l.external_id, l]));
  const missing_in_ledger: { external_id: string; gross_cents: number; occurred_at: string }[] = [];
  const amount_mismatches: { external_id: string; processor_cents: number; ledger_cents: number }[] = [];
  let matched = 0;

  for (const p of processor) {
    const l = ledgerById.get(p.external_id);
    if (!l) {
      missing_in_ledger.push({ external_id: p.external_id, gross_cents: p.gross_cents, occurred_at: p.occurred_at });
    } else if (p.gross_cents > 0 && l.gross_cents !== p.gross_cents) {
      amount_mismatches.push({ external_id: p.external_id, processor_cents: p.gross_cents, ledger_cents: l.gross_cents });
    } else {
      matched++;
    }
  }

  const processorIds = new Set(processor.map((p) => p.external_id));
  const missing_in_processor = ledger
    .filter((l) => !processorIds.has(l.external_id))
    .map((l) => l.external_id);

  return {
    processor_count: processor.length,
    ledger_count:    ledger.length,
    matched,
    missing_in_ledger,
    missing_in_processor,
    amount_mismatches,
    clean: missing_in_ledger.length === 0 && amount_mismatches.length === 0,
  };
}

// ── Core run ────────────────────────────────────────────────────────────────

async function runReconciliation(days: number, backfill: boolean) {
  const sinceMs   = Date.now() - days * 24 * 60 * 60 * 1000;
  const sinceIso  = new Date(sinceMs).toISOString();
  const sinceUnix = Math.floor(sinceMs / 1000);

  const [stripe, commerce, x402, ledger] = await Promise.all([
    fetchStripeSessions(sinceUnix),
    fetchCommerceCharges(sinceMs),
    fetchX402(sinceIso),
    fetchLedger(sinceIso),
  ]);

  if (ledger === null) {
    return {
      ok: false as const,
      reason: "sales_ledger unavailable — run db/sales-ledger.sql in the Supabase SQL editor first",
    };
  }

  const sources = {
    stripe:            stripe   ? diffSource(stripe,   ledger.filter((l) => l.source === "stripe"))            : { skipped: "STRIPE_SECRET_KEY not set or Stripe unreachable" },
    coinbase_commerce: commerce ? diffSource(commerce, ledger.filter((l) => l.source === "coinbase_commerce")) : { skipped: "COINBASE_COMMERCE_API_KEY not set or Commerce unreachable" },
    x402:              x402     ? diffSource(x402,     ledger.filter((l) => l.source === "x402"))              : { skipped: "x402_payments unavailable" },
  };

  // Backfill: insert every processor record missing from the ledger.
  let backfilled = 0;
  if (backfill) {
    const all = [...(stripe ?? []), ...(commerce ?? []), ...(x402 ?? [])];
    const ledgerIds = new Set(ledger.map((l) => l.external_id));
    for (const rec of all) {
      if (ledgerIds.has(rec.external_id)) continue;
      if (await recordSale(rec.entry)) backfilled++;
    }
  }

  const provisioning = {
    pending: ledger.filter((l) => l.provisioning_status === "pending").length,
    failed:  ledger.filter((l) => l.provisioning_status === "failed").length,
  };

  const dirty = (s: unknown) => (s as { clean?: boolean }).clean === false;
  const issues =
    dirty(sources.stripe) || dirty(sources.coinbase_commerce) || dirty(sources.x402) ||
    provisioning.failed > 0;

  return {
    ok:           true as const,
    window_days:  days,
    ran_at:       new Date().toISOString(),
    sources,
    provisioning,
    backfilled:   backfill ? backfilled : undefined,
    status:       issues && !backfill ? "issues_found" : "clean",
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") ?? "30", 10) || 30));
  return Response.json(await runReconciliation(days, false));
}

export async function POST(req: Request) {
  if (!checkOrigin(req))       return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: { backfill?: boolean; days?: number };
  try { body = await req.json() as { backfill?: boolean; days?: number }; }
  catch { body = {}; }

  const days = Math.min(365, Math.max(1, Number(body.days) || 90));
  return Response.json(await runReconciliation(days, !!body.backfill));
}
