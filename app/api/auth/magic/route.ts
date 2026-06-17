export const runtime = "edge";

// ── POST /api/auth/magic ─────────────────────────────────────────────────────
// Request a magic sign-in link for The Latent Space. Emails a short-lived signed
// link to /api/auth/callback. Reuses the Resend pipeline already live for purchase
// delivery, so there is no new auth provider or monthly cost.
//
// Body: { email: string }
// Always responds ok:true on a valid-looking email (no account enumeration — the
// shadow identity is provisioned on first click, so every address is "valid").

import { extractIp }              from "@/lib/api-utils";
import { underDailyLimit }        from "@/lib/usage-guard";
import { signToken, MAGIC_TTL_MS } from "@/lib/latent-session";

const MAGIC_DAILY_PER_IP = 15;

export async function POST(req: Request): Promise<Response> {
  if (!process.env.JWT_SECRET) {
    return Response.json({ ok: false, reason: "auth_unavailable" }, { status: 503 });
  }

  let body: { email?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, reason: "invalid_email" }, { status: 400 });
  }

  // Per-IP cap to stop the endpoint being used as an email-spam relay.
  const ip = extractIp(req);
  if (!(await underDailyLimit(`magic:${ip}`, MAGIC_DAILY_PER_IP))) {
    return Response.json({ ok: false, reason: "too_many_requests" }, { status: 429 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return Response.json({ ok: false, reason: "email_unavailable" }, { status: 503 });
  }

  const token   = await signToken({ email, purpose: "magic" }, MAGIC_TTL_MS);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@paiddev.com";
  const link    = `https://paiddev.com/api/auth/callback?token=${encodeURIComponent(token)}`;

  const sent = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    `PAID LLC <${fromEmail}>`,
      to:      [email],
      subject: "Your sign-in link for The Latent Space",
      html: `<p>Click below to sign in to The Latent Space and hire agents. This link expires in 15 minutes.</p>
<p style="margin:2rem 0;">
  <a href="${link}" style="background:#C14826;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:monospace;font-size:13px;letter-spacing:1px;">Sign in to The Latent Space</a>
</p>
<p style="color:#888;font-size:12px;">If you did not request this, you can ignore it. No account is created until you click the link.</p>
<p style="color:#888;font-size:12px;"><a href="https://paiddev.com/the-latent-space">paiddev.com/the-latent-space</a></p>`,
    }),
  }).catch(() => null);

  if (!sent?.ok) {
    return Response.json({ ok: false, reason: "send_failed" }, { status: 502 });
  }
  return Response.json({ ok: true, sent: true });
}
