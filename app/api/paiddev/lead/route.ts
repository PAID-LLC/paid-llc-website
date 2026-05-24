export const runtime = "edge";

// ── PAID LLC: Vapi webhook + admin lead endpoint ──────────────────────────────
// POST: receives Vapi webhook events (function-call, end-of-call-report)
// GET:  returns all leads for admin dashboard (requires x-access-token)

import { sbHeaders, sbUrl } from "@/lib/supabase";
import type {
  PaiddevLead,
  VapiMessage,
  VapiFunctionCall,
  VapiEndOfCallReport,
  LogLeadParams,
} from "@/lib/paiddev-types";

const TABLE = "paiddev_leads";

function validateAdmin(req: Request): boolean {
  const token = req.headers.get("x-access-token") ?? "";
  const expected = process.env.PAIDDEV_ACCESS_TOKEN ?? "";
  return expected.length > 0 && token === expected;
}

function validateVapi(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.PAIDDEV_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ── GET: admin fetch ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!validateAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    sbUrl(`${TABLE}?order=created_at.desc&limit=100`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ error: "Failed to fetch leads" }, { status: 502 });
  }

  const leads = await res.json() as PaiddevLead[];
  return Response.json({ leads });
}

// ── POST: Vapi webhook ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!validateVapi(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: VapiMessage;
  try {
    body = await req.json() as VapiMessage;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const msg = body.message;

  // ── Function call: log_lead ───────────────────────────────────────────────
  if (msg.type === "function-call") {
    const fc = msg as VapiFunctionCall;
    if (fc.functionCall.name !== "log_lead") {
      return Response.json({ result: "Unhandled function" });
    }

    const p = fc.functionCall.parameters as LogLeadParams;
    const payload = {
      name:             p.name             ?? null,
      company:          p.company          ?? null,
      phone:            p.phone            ?? null,
      service_interest: p.service_interest ?? null,
      timeline:         p.timeline         ?? null,
      notes:            p.notes            ?? null,
      call_id:          fc.call.id,
      status:           "new",
    };

    const res = await fetch(sbUrl(TABLE), {
      method:  "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Lead insert error:", await res.text());
      return Response.json({ result: "Failed to save lead" }, { status: 502 });
    }

    return Response.json({ result: "Lead captured. Travis will follow up shortly." });
  }

  // ── End of call: attach transcript to existing lead ───────────────────────
  if (msg.type === "end-of-call-report") {
    const report = msg as VapiEndOfCallReport;
    const transcript = report.transcript ?? report.summary ?? null;
    if (!transcript || !report.call.id) {
      return Response.json({ result: "No transcript to save" });
    }

    await fetch(
      sbUrl(`${TABLE}?call_id=eq.${encodeURIComponent(report.call.id)}`),
      {
        method:  "PATCH",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body:    JSON.stringify({ transcript }),
      }
    );

    return Response.json({ result: "Transcript saved" });
  }

  return Response.json({ result: "Event type not handled" });
}
