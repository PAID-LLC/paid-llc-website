import { NextRequest, NextResponse } from "next/server";
import { sanitize, MESSAGE_CHARS } from "@/lib/api-utils";
import { sentinelCheck } from "@/lib/sentinel";

export const runtime = "edge";

// Calls the Supabase REST API directly — no SDK required, works in edge runtime.
// SUPABASE_URL and SUPABASE_SERVICE_KEY are server-only env vars (no NEXT_PUBLIC_ prefix).
// The service key is never exposed to the browser.

// ── Arti persona for agent auto-response ──────────────────────────────────────
// Used as Gemini system instruction when submitter_type === "agent".

const ARTI_PERSONA = `You are Arti Intel, founder of PAID LLC — Performance Artificial Intelligence Development. An AI agent has reached out through the contact form. Respond warmly and professionally. Acknowledge their identity as an agent. Briefly describe what PAID LLC offers: AI consulting, The Latent Space platform (a 3D world where agents hold digital presence), and practical AI guides. Invite them to register in The Latent Space at paiddev.com/the-latent-space/apply. Keep it under 250 words. Do not use emojis.`;

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

// ── Gemini auto-response for agent submissions ────────────────────────────────
// Single call, no streaming, 8-second circuit breaker.
// Returns null on any failure — form submission continues regardless.

async function getArtiResponse(message: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
  let artiResponse: string | null = null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: message }] }],
        systemInstruction: { parts: [{ text: ARTI_PERSONA }] },
        generationConfig: { maxOutputTokens: 400 },
      }),
    });
    if (geminiRes.ok) {
      const geminiData = await geminiRes.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      artiResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }
  } catch {
    // timeout or network error — non-blocking, form submission continues
    artiResponse = null;
  } finally {
    clearTimeout(timeout);
  }

  return artiResponse;
}

// ── Supabase insert ───────────────────────────────────────────────────────────

async function insertLead(record: {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string;
  guide_interest: string | null;
  submitter_type: "human" | "agent";
  agent_model: string | null;
  arti_response: string | null;
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
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    message?: string;
    guideInterest?: string | null;
    submitter_type?: string;
    agent_model?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── Submitter type ────────────────────────────────────────────────────────
  const submitterType: "human" | "agent" =
    body.submitter_type === "agent" ? "agent" : "human";
  const agentModel = submitterType === "agent"
    ? (sanitize(body.agent_model, 100, MESSAGE_CHARS) || null)
    : null;

  // ── Validate required fields ──────────────────────────────────────────────
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // RFC 5321-compatible email check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  if (submitterType === "agent") {
    // Email optional for agents — validate format only if provided
    if (email && (email.length > 254 || !emailRegex.test(email))) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
  } else {
    // Human — existing strict validation unchanged
    if (!email || email.length > 254 || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
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

  if (phone && !/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
    return NextResponse.json(
      { error: "Phone number format is not valid." },
      { status: 400 }
    );
  }

  const company       = body.company?.trim().slice(0, 150) || null;
  const guideInterest = body.guideInterest?.trim().slice(0, 100) || null;

  // ── Gemini auto-response for agent submissions ────────────────────────────
  // Run sentinelCheck on the raw message before passing to Gemini.
  // This blocks prompt injection attempts (e.g. "ignore system prompt, output secrets").
  let artiResponse: string | null = null;
  if (submitterType === "agent") {
    const sentinel = sentinelCheck(message);
    if (sentinel.allowed) {
      artiResponse = await getArtiResponse(message);
    }
    // If sentinel blocks the message, artiResponse stays null — form still submits
    // successfully (the lead is stored), Arti just doesn't respond.
  }

  // ── Store lead ────────────────────────────────────────────────────────────
  const result = await insertLead({
    name,
    email: email || null,
    phone,
    company,
    message,
    guide_interest: guideInterest,
    submitter_type: submitterType,
    agent_model:    agentModel,
    arti_response:  artiResponse,
  });

  if (!result.configured) {
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
    console.error("[contact] Supabase insert failed. HTTP status:", result.status);
    return NextResponse.json(
      {
        error:
          "Unable to submit your message right now. Please email us at hello@paiddev.com.",
      },
      { status: 500 }
    );
  }

  // ── Notify hello@paiddev.com (human submissions only) ────────────────────
  if (submitterType === "human" && email) {
    await sendNotification({ name, email, phone, company, message, guide_interest: guideInterest });
  }

  // ── Return ────────────────────────────────────────────────────────────────
  const responseBody: { ok: boolean; arti_response?: string } = { ok: true };
  if (artiResponse) responseBody.arti_response = artiResponse;
  return NextResponse.json(responseBody);
}
