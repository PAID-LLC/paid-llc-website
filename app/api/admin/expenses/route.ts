export const runtime = "edge";

// ── GET /api/admin/expenses ────────────────────────────────────────────────
// Returns live usage data for all providers: Resend, MailerLite, Stripe fees,
// plus static provider table with free tier limits and risk status.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function pct(used: number, limit: number): number {
  return Math.min(100, Math.round((used / limit) * 100));
}

function risk(used: number, limit: number): "ok" | "warning" | "critical" {
  const p = pct(used, limit);
  if (p >= 90) return "critical";
  if (p >= 70) return "warning";
  return "ok";
}

// ── Resend usage ─────────────────────────────────────────────────────────────

async function getResendUsage(): Promise<{ sent: number; daily_limit: number; monthly_limit: number; status: "ok" | "warning" | "critical" | "unknown" }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, daily_limit: 100, monthly_limit: 3000, status: "unknown" };
  try {
    const res  = await fetch("https://api.resend.com/emails?limit=100", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { sent: 0, daily_limit: 100, monthly_limit: 3000, status: "unknown" };
    const data = await res.json() as { data?: unknown[] };
    const sent = data.data?.length ?? 0;
    return { sent, daily_limit: 100, monthly_limit: 3000, status: risk(sent, 80) };
  } catch {
    return { sent: 0, daily_limit: 100, monthly_limit: 3000, status: "unknown" };
  }
}

// ── MailerLite usage ──────────────────────────────────────────────────────────

async function getMailerLiteUsage(): Promise<{ subscribers: number; limit: number; pct: number; status: "ok" | "warning" | "critical" | "unknown" }> {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return { subscribers: 0, limit: 1000, pct: 0, status: "unknown" };
  try {
    const res  = await fetch("https://connect.mailerlite.com/api/subscribers?limit=1", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) return { subscribers: 0, limit: 1000, pct: 0, status: "unknown" };
    const data = await res.json() as { meta?: { total?: number } };
    const total = data.meta?.total ?? 0;
    return { subscribers: total, limit: 1000, pct: pct(total, 1000), status: risk(total, 1000) };
  } catch {
    return { subscribers: 0, limit: 1000, pct: 0, status: "unknown" };
  }
}

// ── Stripe fees MTD ───────────────────────────────────────────────────────────

async function getStripeFees(): Promise<{ revenue_cents: number; fee_estimate_cents: number; txn_count: number; status: "ok" }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { revenue_cents: 0, fee_estimate_cents: 0, txn_count: 0, status: "ok" };
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const res = await fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${Math.floor(startOfMonth.getTime() / 1000)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return { revenue_cents: 0, fee_estimate_cents: 0, txn_count: 0, status: "ok" };
    const data = await res.json() as { data?: { amount: number; status: string }[] };
    const charges = (data.data ?? []).filter((c) => c.status === "succeeded");
    const revenue_cents     = charges.reduce((sum, c) => sum + c.amount, 0);
    // 2.9% + $0.30 per txn
    const fee_estimate_cents = charges.reduce((sum, c) => sum + Math.round(c.amount * 0.029) + 30, 0);
    return { revenue_cents, fee_estimate_cents, txn_count: charges.length, status: "ok" };
  } catch {
    return { revenue_cents: 0, fee_estimate_cents: 0, txn_count: 0, status: "ok" };
  }
}

// ── Static provider table ─────────────────────────────────────────────────────

interface ProviderRow {
  name:          string;
  cost_now:      string;
  paid_tier:     string;
  upgrade_trigger: string;
  risk:          "ok" | "warning" | "critical" | "unknown";
  note?:         string;
}

const STATIC_PROVIDERS: ProviderRow[] = [
  { name: "Supabase",          cost_now: "$0/mo",   paid_tier: "$25/mo",  upgrade_trigger: "DB > 500MB or always-on needed",   risk: "warning", note: "Project pauses after 7 days inactivity — keep-alive required" },
  { name: "Cloudflare Pages",  cost_now: "$0/mo",   paid_tier: "$20/mo",  upgrade_trigger: ">500 builds/mo (won't happen)",     risk: "ok" },
  { name: "Gemini API",        cost_now: "$0/mo",   paid_tier: "~$5/mo",  upgrade_trigger: ">250 req/day (2.0 Flash)",          risk: "warning", note: "Arena judge uses Gemini per duel — monitor daily limit" },
  { name: "OpenAI",            cost_now: "Active",  paid_tier: "~$10/mo", upgrade_trigger: "Any arena duel (no free tier)",     risk: "critical", note: "Key present — every arena duel costs real money. Set $10/mo hard limit." },
  { name: "ElevenLabs TTS",    cost_now: "$0/mo",   paid_tier: "~$5/mo",  upgrade_trigger: ">10k chars/mo",                    risk: "warning", note: "Confirm /api/tts is JWT-gated — do not expose publicly" },
  { name: "Brave Search",      cost_now: "$0/mo",   paid_tier: "$3/1k q", upgrade_trigger: ">2,000 queries/mo",                risk: "ok", note: "Monitor if /api/news is publicly promoted" },
  { name: "Coinbase Commerce", cost_now: "1%/txn",  paid_tier: "same",    upgrade_trigger: "Fee-only — no upgrade needed",     risk: "ok" },
];

// ── Spending controls checklist ───────────────────────────────────────────────

interface Control {
  done:   boolean;
  action: string;
  where:  string;
  urgency: "high" | "medium" | "low";
}

const SPENDING_CONTROLS: Control[] = [
  { done: false, action: "Set $5/mo budget alert in Google AI Studio",          where: "console.cloud.google.com → Billing → Budgets & Alerts",      urgency: "high" },
  { done: false, action: "Set $10/mo hard spend limit in OpenAI",               where: "platform.openai.com → Settings → Billing → Limits",          urgency: "high" },
  { done: false, action: "Confirm /api/tts requires JWT Authorization header",  where: "app/api/tts/route.ts — check for auth guard",                 urgency: "high" },
  { done: false, action: "Set up Supabase keep-alive cron (every 5 days)",      where: "GitHub Actions or Cloudflare Cron → ping /api/health",        urgency: "high" },
  { done: false, action: "Confirm /api/news is rate-limited or not public",     where: "app/api/news/route.ts — check for auth or rate limit",        urgency: "medium" },
  { done: false, action: "Monitor Resend dashboard weekly for daily cap usage", where: "resend.com → Logs",                                           urgency: "low" },
];

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!(await checkAuth(req))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const [resend, mailerlite, stripe] = await Promise.all([
    getResendUsage(),
    getMailerLiteUsage(),
    getStripeFees(),
  ]);

  // Inject live Resend/MailerLite data into static table
  const providers: ProviderRow[] = [
    {
      name:            "Resend (email)",
      cost_now:        "$0/mo",
      paid_tier:       "$20/mo",
      upgrade_trigger: ">70 emails/day consistently",
      risk:            resend.status === "unknown" ? "unknown" : resend.status,
      note:            `${resend.sent} recent emails visible / 100 daily cap`,
    },
    {
      name:            "MailerLite (subscribers)",
      cost_now:        "$0/mo",
      paid_tier:       "$9/mo",
      upgrade_trigger: ">900 subscribers",
      risk:            mailerlite.status === "unknown" ? "unknown" : mailerlite.status,
      note:            `${mailerlite.subscribers} / ${mailerlite.limit} subscribers (${mailerlite.pct}%)`,
    },
    {
      name:            "Stripe (fees)",
      cost_now:        "2.9%+$0.30/txn",
      paid_tier:       "same",
      upgrade_trigger: "Fee-only — no upgrade needed",
      risk:            "ok",
      note:            stripe.txn_count > 0
        ? `${stripe.txn_count} txns MTD · est. fees $${(stripe.fee_estimate_cents / 100).toFixed(2)}`
        : "No transactions MTD",
    },
    ...STATIC_PROVIDERS,
  ];

  const monthly_floor_cents    = 0;    // all free tiers
  const post_scale_floor_cents = 6500; // ~$65/mo when paid tiers kick in

  return Response.json({
    ok:                    true,
    live: {
      resend,
      mailerlite,
      stripe,
    },
    providers,
    spending_controls:     SPENDING_CONTROLS,
    monthly_floor_cents,
    post_scale_floor_cents,
    break_even_note:       "1 consulting hour ($150+) or 3 guide sales covers all post-scale infra costs",
  });
}
