export const runtime = "edge";

// ── My 3 Sons: lead capture endpoint ─────────────────────────────────────────
// GET: fetch existing leads (ordered newest first, max 50)
// POST: insert a new lead captured by Gemini function call

import { sbHeaders, sbUrl } from "@/lib/supabase";
import type { M3SLead } from "@/lib/my3sons-types";

const TABLE = "my3sons_leads";

function validateToken(req: Request): boolean {
  const token = req.headers.get("x-access-token") ?? "";
  const expected = process.env.MY3SONS_ACCESS_TOKEN ?? "";
  return expected.length > 0 && token === expected;
}

// ── GET: fetch leads ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!validateToken(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    sbUrl(`${TABLE}?order=created_at.desc&limit=50`),
    { headers: sbHeaders() }
  );

  if (!res.ok) {
    return Response.json({ error: "Failed to fetch leads" }, { status: 502 });
  }

  const leads = await res.json() as M3SLead[];
  return Response.json({ leads });
}

// ── POST: insert lead ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!validateToken(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    phone?: string;
    city?: string;
    service_type?: string;
    notes?: string;
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = {
    name:         body.name         ?? null,
    phone:        body.phone        ?? null,
    city:         body.city         ?? null,
    service_type: body.service_type ?? null,
    notes:        body.notes        ?? null,
    status:       "new",
  };

  const headers = { ...sbHeaders(), Prefer: "return=representation" };

  const res = await fetch(sbUrl(TABLE), {
    method:  "POST",
    headers,
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Lead insert error:", err);
    return Response.json({ error: "Failed to save lead" }, { status: 502 });
  }

  const rows = await res.json() as M3SLead[];
  return Response.json({ lead: rows[0] }, { status: 201 });
}
