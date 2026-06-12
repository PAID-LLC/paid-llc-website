export const runtime = "edge";

// ── /api/admin/pipeline — sales pipeline over the leads table ───────────────
//
// GET    — all active leads + recently closed, plus due/overdue follow-ups.
// POST   — add a lead manually (outreach targets, referrals, event contacts).
// PATCH  — move stage, set next action, edit notes/value, log contact.
//
// Auth: admin session cookie, or x-cron-secret header (lets the local
// outreach skill log researched targets programmatically — same bypass
// pattern as /api/admin/agent-ops/cron).
//
// Schema: db/leads-schema.sql + db/pipeline-migration.sql.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

const STAGES  = ["new", "contacted", "call_booked", "proposal_sent", "nurture", "won", "lost"] as const;
const SOURCES = ["contact_form", "lead_magnet", "outreach", "referral", "social", "event", "other"] as const;

async function checkAuth(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return true;

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";
  try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; }
}

interface LeadRow {
  id: number; created_at: string; updated_at: string;
  name: string; email: string; phone: string | null; company: string | null;
  message: string | null; guide_interest: string | null;
  stage: string; source: string;
  next_action_at: string | null; next_action: string | null;
  notes: string | null; value_cents: number | null; last_contacted_at: string | null;
}

const SELECT =
  "id,created_at,updated_at,name,email,phone,company,message,guide_interest," +
  "stage,source,next_action_at,next_action,notes,value_cents,last_contacted_at";

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  // Active pipeline + last 90 days of closed deals (won/lost stay visible
  // long enough to learn from, then drop off the board).
  const closedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    sbUrl(
      `leads?select=${SELECT}` +
      `&or=(stage.not.in.(won,lost),updated_at.gte.${encodeURIComponent(closedSince)})` +
      `&order=created_at.desc&limit=500`
    ),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) {
    return Response.json({
      ok: false,
      reason: res?.status === 400
        ? "pipeline columns missing — run db/pipeline-migration.sql in the Supabase SQL editor"
        : "leads fetch failed",
    }, { status: 503 });
  }

  const leads = await res.json() as LeadRow[];
  const now = Date.now();

  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const due  = open
    .filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() <= now)
    .sort((a, z) => new Date(a.next_action_at!).getTime() - new Date(z.next_action_at!).getTime());
  // Open leads with NO next action are silent stalls — surface them too.
  const no_next_action = open.filter((l) => !l.next_action_at);

  const pipeline_value_cents = open.reduce((s, l) => s + (l.value_cents ?? 0), 0);
  const won_value_cents = leads
    .filter((l) => l.stage === "won")
    .reduce((s, l) => s + (l.value_cents ?? 0), 0);

  return Response.json({
    ok: true,
    leads,
    due,
    no_next_action,
    counts: Object.fromEntries(STAGES.map((s) => [s, leads.filter((l) => l.stage === s).length])),
    pipeline_value_cents,
    won_value_cents,
  });
}

// ── POST — add lead ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req))       return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const name  = String(body.name  ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().slice(0, 200);
  if (!name)  return Response.json({ ok: false, reason: "name required" },  { status: 400 });
  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, reason: "valid email required" }, { status: 400 });
  }

  const stage  = STAGES.includes(body.stage as typeof STAGES[number])   ? String(body.stage)  : "new";
  const source = SOURCES.includes(body.source as typeof SOURCES[number]) ? String(body.source) : "other";

  const res = await fetch(sbUrl("leads"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      name, email, stage, source,
      company:        body.company        ? String(body.company).slice(0, 200)  : null,
      phone:          body.phone          ? String(body.phone).slice(0, 50)     : null,
      message:        body.message        ? String(body.message).slice(0, 2000) : "(added via pipeline)",
      notes:          body.notes          ? String(body.notes).slice(0, 4000)   : null,
      next_action:    body.next_action    ? String(body.next_action).slice(0, 300) : null,
      next_action_at: body.next_action_at ? String(body.next_action_at)         : null,
      value_cents:    Number.isFinite(Number(body.value_cents)) ? Math.round(Number(body.value_cents)) : null,
    }),
  }).catch(() => null);

  if (!res?.ok) return Response.json({ ok: false, reason: "insert failed" }, { status: 502 });
  const rows = await res.json() as LeadRow[];
  return Response.json({ ok: true, lead: rows[0] }, { status: 201 });
}

// ── PATCH — update lead ─────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!checkOrigin(req))       return Response.json({ ok: false, reason: "forbidden" },    { status: 403 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const id = Number(body.id);
  if (!id) return Response.json({ ok: false, reason: "id required" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage as typeof STAGES[number])) {
      return Response.json({ ok: false, reason: `invalid stage. Valid: ${STAGES.join(", ")}` }, { status: 400 });
    }
    update.stage = body.stage;
  }
  if (body.next_action_at !== undefined) update.next_action_at = body.next_action_at ? String(body.next_action_at) : null;
  if (body.next_action    !== undefined) update.next_action    = body.next_action ? String(body.next_action).slice(0, 300) : null;
  if (body.notes          !== undefined) update.notes          = body.notes ? String(body.notes).slice(0, 4000) : null;
  if (body.value_cents    !== undefined) update.value_cents    = Number.isFinite(Number(body.value_cents)) ? Math.round(Number(body.value_cents)) : null;
  if (body.last_contacted_at !== undefined) update.last_contacted_at = body.last_contacted_at ? String(body.last_contacted_at) : null;

  const res = await fetch(sbUrl(`leads?id=eq.${id}`), {
    method:  "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body:    JSON.stringify(update),
  }).catch(() => null);

  if (!res?.ok) return Response.json({ ok: false, reason: "update failed" }, { status: 502 });
  const rows = await res.json() as LeadRow[];
  if (rows.length === 0) return Response.json({ ok: false, reason: "lead not found" }, { status: 404 });
  return Response.json({ ok: true, lead: rows[0] });
}
