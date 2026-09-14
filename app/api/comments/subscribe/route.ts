export const runtime = "edge";

// ── POST /api/comments/subscribe ─────────────────────────────────────────────
// Daily digest signup. Same shape as /api/blog/subscribe, with two additions
// that a page carrying a public form on every edition needs:
//
//   - a honeypot field, because a form this visible gets scripted
//   - a per-IP daily cap, so a script cannot pump a thousand addresses into the
//     MailerLite list and burn the account's quota
//
// The list has its OWN MailerLite group. Dropping these subscribers into the
// lead-magnet group would fire the guide nurture sequence at people who signed
// up for a comment digest, which is the kind of thing that earns a spam report.

import { underDailyLimit } from "@/lib/usage-guard";
import { extractIp, hashIp } from "@/lib/api-utils";

const ALLOWED_ORIGINS = ["https://paiddev.com", "https://www.paiddev.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PER_IP_DAILY = 5;
const IP_SALT = "comments_subscribe_2026";

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return ALLOWED_ORIGINS.includes(origin) || (!!siteUrl && origin === siteUrl);
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return Response.json({ ok: false, reason: "Forbidden." }, { status: 403 });
  }

  try {
    const { email, website } = (await req.json()) as { email?: string; website?: string };

    // Honeypot: a person never sees this field. Accept silently so a bot gets
    // no signal about which of its attempts worked.
    if (website) return Response.json({ ok: true });

    if (!email || typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email.trim())) {
      return Response.json({ ok: false, reason: "That does not look like an email address." }, { status: 400 });
    }

    const ipHash = await hashIp(extractIp(req), IP_SALT);
    if (!(await underDailyLimit(`comments_sub:${ipHash}`, PER_IP_DAILY))) {
      return Response.json(
        { ok: false, reason: "Too many signups from here today." },
        { status: 429 }
      );
    }

    const key = process.env.MAILERLITE_API_KEY;
    if (!key) {
      return Response.json({ ok: false, reason: "Signup is not configured yet." }, { status: 500 });
    }

    const groupId = process.env.MAILERLITE_COMMENTS_GROUP_ID;
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Accept: "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        fields: { source: "comment_section" },
        ...(groupId ? { groups: [groupId] } : {}),
      }),
    });

    // 409 means already subscribed, which from the reader's side is a success.
    if (!res.ok && res.status !== 409) {
      console.error("[comments][subscribe] MailerLite", res.status, await res.text().catch(() => ""));
      return Response.json({ ok: false, reason: "Signup failed, try again." }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, reason: "Server error." }, { status: 500 });
  }
}
