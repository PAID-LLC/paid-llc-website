export const runtime = "edge";

// ── POST /api/lead-magnet — email capture for the AI Quick-Wins Checklist ───
// Body: { email: string, name?: string, website?: string (honeypot) }
//
// On capture:
//   1. leads row (source=lead_magnet, stage=nurture) → shows in admin Pipeline
//   2. MailerLite subscriber (+ MAILERLITE_LEAD_GROUP_ID group when set —
//      that group join triggers the nurture automation)
//   3. Resend delivery email with the full checklist
//
// Anti-abuse: same-origin check, honeypot field, 5 captures per IP per day.

import { hashIp, extractIp }            from "@/lib/api-utils";
import { underDailyLimit, bumpCounter } from "@/lib/usage-guard";
import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";
import { LEAD_MAGNET, checklistEmailText } from "@/lib/lead-magnet";

function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (process.env.NODE_ENV === "development" && origin.startsWith("http://localhost:")) return true;
  const allowed = ["https://paiddev.com", "https://www.paiddev.com", process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean);
  return allowed.includes(origin);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function insertLead(name: string, email: string): Promise<void> {
  if (!supabaseReady()) return;
  await fetch(sbUrl("leads"), {
    method:  "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      name:    name || email.split("@")[0],
      email,
      message: `(lead magnet: ${LEAD_MAGNET.slug})`,
      source:  "lead_magnet",
      stage:   "nurture",
    }),
  }).catch(() => { /* capture continues; MailerLite still gets them */ });
}

async function subscribeMailerLite(name: string, email: string): Promise<void> {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return;
  const groupId = process.env.MAILERLITE_LEAD_GROUP_ID; // nurture automation trigger
  await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      fields: { ...(name ? { name } : {}), lead_magnet: LEAD_MAGNET.slug },
      ...(groupId ? { groups: [groupId] } : {}),
    }),
  }).catch((err) => console.error("[lead-magnet] MailerLite failed:", err));
}

async function sendChecklist(name: string, email: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const text = [
    `Hi ${name || "there"},`,
    ``,
    `Here is your copy of ${LEAD_MAGNET.title}.`,
    ``,
    checklistEmailText(),
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from:    "PAID LLC <hello@paiddev.com>",
      to:      [email],
      subject: `${LEAD_MAGNET.title} — your copy`,
      text,
    }),
  }).catch(() => null);
  return !!res?.ok;
}

export async function POST(req: Request) {
  if (!isOriginAllowed(req)) return Response.json({ ok: false, reason: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  // Honeypot: bots fill every field. Pretend success, do nothing.
  if (String(body.website ?? "").trim() !== "") {
    return Response.json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const name  = String(body.name  ?? "").trim().slice(0, 100);
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, reason: "valid email required" }, { status: 400 });
  }

  const ipHash = await hashIp(`${extractIp(req)}`, "lead_magnet_2026");
  if (!(await underDailyLimit(`leadmag:${ipHash}`, 5))) {
    return Response.json({ ok: false, reason: "daily limit reached" }, { status: 429 });
  }

  const [, , sent] = await Promise.all([
    insertLead(name, email),
    subscribeMailerLite(name, email),
    sendChecklist(name, email),
    bumpCounter("lead_magnet_captures", 1),
  ]);

  return Response.json({
    ok: true,
    delivered_by_email: sent,
    message: sent
      ? "Check your inbox — the checklist is on its way."
      : "You're in. The checklist is below.",
  });
}
