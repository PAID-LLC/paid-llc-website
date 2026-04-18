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
  { name: "Supabase",          cost_now: "$0/mo",    paid_tier: "$25/mo",  upgrade_trigger: "DB > 500MB or always-on needed",   risk: "warning", note: "Pauses after 7 days inactivity — keep-alive cron required (UptimeRobot recommended)" },
  { name: "Cloudflare Pages",  cost_now: "$0/mo",    paid_tier: "$20/mo",  upgrade_trigger: ">500 builds/mo (won't happen)",     risk: "ok" },
  { name: "Gemini API",        cost_now: "$0/mo",    paid_tier: "~$5/mo",  upgrade_trigger: ">250 req/day (2.0 Flash)",          risk: "warning", note: "$20/mo hard cap set via Openclaw — arena judge uses 1 req/duel" },
  { name: "ElevenLabs TTS",    cost_now: "$6/mo",    paid_tier: "included",upgrade_trigger: "Subscription active — no upgrade needed", risk: "warning", note: "Subscription active — confirm /api/tts is JWT-gated before promoting publicly" },
  { name: "Google One",        cost_now: "$9.99/mo", paid_tier: "same",    upgrade_trigger: "Storage upgrade if needed",         risk: "ok", note: "Includes AI Studio API key access; $20/mo API spend cap set" },
  { name: "Google Workspace",  cost_now: "$14/mo",   paid_tier: "same",    upgrade_trigger: "Add users when hiring",                risk: "ok", note: "Business email — paiddev.com domain" },
  { name: "Simple Mobile",     cost_now: "$20/mo",   paid_tier: "same",    upgrade_trigger: "Upgrade plan if data needs grow",        risk: "ok", note: "Business phone for client calls" },
  { name: "Brave Search",      cost_now: "$0/mo",    paid_tier: "$3/1k q", upgrade_trigger: ">2,000 queries/mo",                 risk: "ok", note: "Monitor if /api/news is publicly promoted" },
  { name: "Coinbase Commerce", cost_now: "1%/txn",   paid_tier: "same",    upgrade_trigger: "Fee-only — no upgrade needed",      risk: "ok", note: "Account live, no transactions yet" },
  { name: "OpenAI",            cost_now: "Not set up", paid_tier: "~$10/mo", upgrade_trigger: "Do not add unless arena volume justifies it", risk: "ok", note: "No key configured — arena judge code supports it but it is disabled" },
];

// ── Spending controls checklist ───────────────────────────────────────────────

interface Control {
  done:   boolean;
  action: string;
  where:  string;
  urgency: "high" | "medium" | "low";
}

const SPENDING_CONTROLS: Control[] = [
  { done: true,  action: "Supabase keep-alive — GitHub Actions cron pings /api/health every 4 days", where: ".github/workflows/keep-alive.yml — deployed",                              urgency: "high" },
  { done: true,  action: "TTS auth gate — origin check limits /api/tts to paiddev.com only",         where: "app/api/tts/route.ts — origin check in place",                             urgency: "high" },
  { done: true,  action: "Google AI Studio — $20/mo spend cap",                                      where: "Set via Openclaw API key — already configured",                            urgency: "high" },
  { done: false, action: "Confirm /api/news is rate-limited or not public",                          where: "app/api/news/route.ts — check for auth or rate limit",                     urgency: "medium" },
  { done: false, action: "Monitor Resend dashboard weekly for daily cap usage",                      where: "resend.com → Logs",                                                        urgency: "low" },
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

  const monthly_floor_cents    = 6667; // Claude ~$16.67 + ElevenLabs $6 + Google One $9.99 + Workspace $14 + Simple Mobile $20 = ~$66.67/mo
  const post_scale_floor_cents = 9167; // + Supabase Pro $25/mo if needed

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
    break_even_note:       "Committed expenses: ~$66.67/mo (Claude + ElevenLabs + Google One + Workspace + Simple Mobile). Break-even: 1 consulting hour covers all monthly costs.",
  });
}
