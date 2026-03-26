export const runtime = "edge";

// ── POST /api/admin/agent-ops/cron — scheduled Pulse Report trigger ────────
// Called by an external scheduler (cron-job.org or Cloudflare Worker cron).
// Auth: CRON_SECRET header (set in Cloudflare Pages env vars).
// Generates and delivers the weekly Pulse Report automatically.

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, reason: "cron not configured" }, { status: 503 });
  }

  const provided = req.headers.get("x-cron-secret");
  if (!provided || provided !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

  // Call the report endpoint internally with deliver=true
  // Uses ADMIN_SECRET to simulate a valid admin session is NOT needed here —
  // the report endpoint has its own internal path for cron; we pass cron auth
  // via a dedicated header so the report route can distinguish cron vs. browser.
  const reportRes = await fetch(`${siteUrl}/api/admin/agent-ops/report`, {
    method:  "POST",
    headers: {
      "Content-Type":   "application/json",
      "x-cron-secret":  cronSecret,       // report route will check this as bypass
      // Note: admin_session cookie won't be present — report route accepts cron header
    },
    body: JSON.stringify({ deliver: true }),
  });

  const data = await reportRes.json();
  return Response.json({ ok: reportRes.ok, ...data });
}
