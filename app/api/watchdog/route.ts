export const runtime = "edge";

// ── GET /api/watchdog — self-check + email alert ────────────────────────────
// Called every 30 min by .github/workflows/watchdog.yml (the workflow's own
// curl failure doubles as the site-down alert: GitHub emails the repo owner
// when a scheduled workflow fails).
//
// This endpoint checks what an external pinger cannot see:
//   - Supabase reachable
//   - webhook failures in the last 24h (signature rejects = possible attack
//     or broken secret; we'd otherwise never notice)
//   - paid-but-not-delivered sales (provisioning failed)
// When something is wrong it emails Travis via Resend, max 4 alerts/day
// (usage_counters cooldown) so a persistent failure cannot flood the inbox.
//
// Unauthenticated by design: it only reveals ok/issues booleans and can only
// email the fixed admin address. The alert cap bounds abuse.

import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";
import { underDailyLimit } from "@/lib/usage-guard";

const ALERT_TO = "travis@paiddev.com";

async function count(path: string): Promise<number | null> {
  const res = await fetch(sbUrl(path), {
    headers: { ...sbHeaders(), Prefer: "count=exact" },
    method: "HEAD",
  }).catch(() => null);
  if (!res?.ok) return null;
  const range = res.headers.get("content-range"); // e.g. "0-9/42"
  const total = range?.split("/")[1];
  return total ? parseInt(total, 10) : null;
}

export async function GET() {
  const issues: string[] = [];

  if (!supabaseReady()) {
    issues.push("Supabase env vars missing on the worker");
  } else {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [webhookFails, provFails] = await Promise.all([
      count(`webhook_failures?created_at=gte.${encodeURIComponent(since)}&select=id`),
      count(`sales_ledger?provisioning_status=eq.failed&select=id`),
    ]);

    if (webhookFails === null) issues.push("Supabase unreachable (webhook_failures query failed)");
    else if (webhookFails > 10) issues.push(`${webhookFails} webhook signature failures in 24h — possible broken secret or probe`);

    if (provFails !== null && provFails > 0) {
      issues.push(`${provFails} sale(s) paid but NOT delivered — admin > Sales > Provisioning Issues`);
    }
  }

  if (issues.length === 0) {
    return Response.json({ ok: true, status: "healthy" });
  }

  // Email alert, capped at 4/day
  let alerted = false;
  const key = process.env.RESEND_API_KEY;
  if (key && (await underDailyLimit("watchdog_alerts", 4))) {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    "PAID LLC Watchdog <notifications@paiddev.com>",
        to:      [ALERT_TO],
        subject: `Watchdog: ${issues.length} issue(s) on paiddev.com`,
        text: [
          "The watchdog found issues:",
          "",
          ...issues.map((i) => `- ${i}`),
          "",
          "Dashboard: https://paiddev.com/admin",
          "(Max 4 of these per day. Resolves automatically when checks pass.)",
        ].join("\n"),
      }),
    }).catch(() => null);
    alerted = !!res?.ok;
  }

  return Response.json({ ok: false, status: "issues", issue_count: issues.length, alerted });
}
