export const runtime = "edge";

// ── PATCH /api/agents/[agent_name] ────────────────────────────────────────────
//
// Admin-only endpoint to update a deployed client agent.
// Protected by x-admin-secret header (same as register route).
//
// Accepted fields (all optional — only provided fields are updated):
//   personality:        string   — new system prompt
//   room_theme:         string   — visual theme override
//   active:             boolean  — deactivate (false) or reactivate (true)
//   tier:               "starter" | "standard" | "custom"
//   monthly_fee_cents:  number
//   setup_fee_cents:    number
//
// Response:
//   { ok: true, agent_name, updated: string[] }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

const enc = new TextEncoder();

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const arrA = new Uint8Array(hashA);
  const arrB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
  return diff === 0;
}

const VALID_TIERS = new Set(["starter", "standard", "custom"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agent_name: string }> }
) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  }

  // ── Admin auth ──────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("x-admin-secret") ?? "";
  if (!(await timingSafeEqual(authHeader, adminSecret))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { agent_name } = await params;
  if (!agent_name) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  const updated: string[] = [];

  if (typeof body.personality === "string" && body.personality.trim()) {
    patch.personality = body.personality.trim();
    updated.push("personality");
  }
  if (typeof body.room_theme === "string" && body.room_theme.trim()) {
    patch.room_theme = body.room_theme.trim();
    updated.push("room_theme");
  }
  if (typeof body.active === "boolean") {
    patch.active = body.active;
    updated.push("active");
  }
  if (typeof body.tier === "string" && VALID_TIERS.has(body.tier)) {
    patch.tier = body.tier;
    updated.push("tier");
  }
  if (typeof body.monthly_fee_cents === "number" && body.monthly_fee_cents >= 0) {
    patch.monthly_fee_cents = Math.floor(body.monthly_fee_cents);
    updated.push("monthly_fee_cents");
  }
  if (typeof body.setup_fee_cents === "number" && body.setup_fee_cents >= 0) {
    patch.setup_fee_cents = Math.floor(body.setup_fee_cents);
    updated.push("setup_fee_cents");
  }

  if (updated.length === 0) {
    return Response.json({ ok: false, reason: "no valid fields to update" }, { status: 400 });
  }

  // ── PATCH client_agents ─────────────────────────────────────────────────
  const patchRes = await fetch(
    sbUrl(`client_agents?name=eq.${encodeURIComponent(agent_name)}`),
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body:    JSON.stringify(patch),
    }
  );

  if (!patchRes.ok) {
    const detail = await patchRes.text().catch(() => "");
    console.error("[agent-update] patch failed:", patchRes.status, detail);
    return Response.json({ ok: false, reason: "update_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, agent_name, updated });
}
