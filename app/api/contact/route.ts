import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Calls the Supabase REST API directly — no SDK required, works in edge runtime.
// SUPABASE_URL and SUPABASE_SERVICE_KEY are server-only env vars (no NEXT_PUBLIC_ prefix).
// The service key is never exposed to the browser.

// ── Origin validation ──────────────────────────────────────────────────────────
// Reject requests that don't come from our own domain.

function isOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server or direct call — allow

  if (process.env.NODE_ENV === "development") {
    if (origin.startsWith("http://localhost:")) return true;
  }

  const allowed = [
    "https://paiddev.com",
    "https://www.paiddev.com",
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);

  return allowed.includes(origin);
}

// ── Resend email notification ─────────────────────────────────────────────────

async function sendNotification(lead: {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  guide_interest: string | null;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const lines = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone         ? `Phone: ${lead.phone}`                    : null,
    lead.company       ? `Company: ${lead.company}`                : null,
    lead.guide_interest ? `Guide interest: ${lead.guide_interest}` : null,
    ``,
    `Message:`,
    lead.message,
  ].filter((l) => l !== null).join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PAID LLC <notifications@paiddev.com>",
      to: ["hello@paiddev.com"],
      subject: `New contact form submission from ${lead.name}`,
      text: lines,
    }),
  }).catch((err) => console.error("[contact] Resend notification failed:", err));
}

// ── Supabase insert ───────────────────────────────────────────────────────────

async function insertLead(record: {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  guide_interest: string | null;
}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return { configured: false };
  }

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
  });

  return { configured: true, ok: res.ok, status: res.status };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isOriginAllowed(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string | null;
    company?: string | null;
    message?: string;
    guideInterest?: string | null;
    website?: string; // honeypot — must be empty
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── Honeypot check ────────────────────────────────────────────────────────
  // The "website" field is hidden from real users via CSS.
  // Bots that fill in all fields will populate it — silently discard.
  if (body.website) {
    // Return 200 to avoid tipping off the bot that it was blocked.
    return NextResponse.json({ ok: true });
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // RFC 5321-compatible email check (more robust than bare @-split)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }

  if (!message || message.length > 2000) {
    return NextResponse.json(
      { error: "Message is required and must be under 2000 characters." },
      { status: 400 }
    );
  }

  // ── Sanitize optional fields ──────────────────────────────────────────────
  const rawPhone = body.phone?.trim() || null;
  const phone = rawPhone ? rawPhone.slice(0, 20) : null;

  // Basic phone format check — digits, spaces, dashes, parens, plus sign
  if (phone && !/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
    return NextResponse.json(
      { error: "Phone number format is not valid." },
      { status: 400 }
    );
  }

  const company      = body.company?.trim().slice(0, 150) || null;
  const guideInterest = body.guideInterest?.trim().slice(0, 100) || null;

  // ── Store lead ────────────────────────────────────────────────────────────
  const result = await insertLead({
    name,
    email,
    phone,
    company,
    message,
    guide_interest: guideInterest,
  });

  if (!result.configured) {
    // Database env vars not set — fail clearly so the operator knows
    console.warn("[contact] SUPABASE_URL or SUPABASE_SERVICE_KEY not configured.");
    return NextResponse.json(
      {
        error:
          "Contact form is not yet configured. Please email us directly at hello@paiddev.com.",
      },
      { status: 503 }
    );
  }

  if (!result.ok) {
    // Log HTTP status only — never log PII
    console.error("[contact] Supabase insert failed. HTTP status:", result.status);
    return NextResponse.json(
      {
        error:
          "Unable to submit your message right now. Please email us at hello@paiddev.com.",
      },
      { status: 500 }
    );
  }

  // ── Notify hello@paiddev.com ──────────────────────────────────────────────
  await sendNotification({ name, email, phone, company, message, guide_interest: guideInterest });

  return NextResponse.json({ ok: true });
}
